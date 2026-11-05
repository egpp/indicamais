/**
 * Verificação independente do PR #57 (IM-072, IM-068, IM-028): campo de antecedência do aviso em
 * /administracao/comissoes. SOMENTE LEITURA contra o DEV: nunca clica em salvar nem escreve em comissoes_*.
 * Sem service_role. Só imprime status.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, entrar, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const COLUNAS = "chave,valor,minimo,maximo,atualizado_em,descricao";

async function tokenDe(request: APIRequestContext, papel: Papel): Promise<string | null> {
  if (nomesFaltando(papel).length > 0) return null;
  const { email, senha } = credenciais(papel);
  const r = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    data: { email, password: senha },
  });
  return r.ok() ? ((await r.json()) as { access_token: string }).access_token : null;
}
const ler = (request: APIRequestContext, token?: string) =>
  request.get(
    `${URL_SUPABASE}/rest/v1/comissoes_parametro?select=${COLUNAS}&chave=eq.aviso_encerramento_antecedencia_dias`,
    { headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${token ?? CHAVE_ANON}` } },
  );

test.describe("PR #57 · leitura do parâmetro (RLS)", () => {
  test.beforeEach(() => {
    test.skip(!URL_SUPABASE || !CHAVE_ANON, "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
  });
  test("admin lê as 6 colunas; anon, dono e indicador não leem", async ({ request }) => {
    const ta = await tokenDe(request, "admin");
    test.skip(!ta, "Sem conta E2E_ADMIN.");
    const r = await ler(request, ta!);
    expect(r.status()).toBe(200);
    const l = (await r.json()) as Record<string, unknown>[];
    expect(l.length).toBe(1);
    expect(Object.keys(l[0]!).sort()).toEqual(COLUNAS.split(",").sort());
    const anon = await ler(request);
    const ca = anon.ok() ? ((await anon.json()) as unknown[]).length : 0;
    expect(ca).toBe(0);
    for (const papel of ["dono", "indicador"] as const) {
      const tk = await tokenDe(request, papel);
      if (!tk) continue;
      const o = await ler(request, tk);
      expect(o.ok() ? ((await o.json()) as unknown[]).length : 0).toBe(0);
    }
  });
});

test.describe("PR #57 · tela do administrador em 360px", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test.describe.configure({ timeout: 90_000 });
  test("campo visível, rótulo, valor vigente, sem rolagem horizontal, validação sem gravar", async ({
    page,
  }) => {
    test.skip(nomesFaltando("admin").length > 0, "Sem conta E2E_ADMIN.");
    await entrar(page, "admin");
    await page.goto("/administracao/comissoes");
    await expect(page.getByText(/Antecedência do aviso de encerramento atual/)).toBeVisible();
    const abrir = page.getByText("Abrir formulário");
    for (let i = 0; i < (await abrir.count()); i++) await abrir.nth(i).click();
    const campo = page.getByLabel(/^Antecedência do aviso de encerramento/);
    await expect(campo).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    ).toBe(false);
    // foco visível por teclado
    await campo.focus();
    const contorno = await campo.evaluate((e) => {
      const s = getComputedStyle(e);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(contorno).not.toMatch(/^none\|0px\|none$/);
    // valor fora da faixa + sem confirmação: recusado NO CLIENTE, nada enviado
    let posts = 0;
    page.on("request", (q) => {
      if (q.method() === "POST" && /administracao\/comissoes/.test(q.url())) posts++;
    });
    await campo.fill("400");
    const formulario = campo.locator("xpath=ancestor::form");
    await formulario.getByLabel(/^Motivo/).fill("Teste de leitura da validacao");
    await formulario.getByRole("button", { name: "Salvar antecedência" }).click();
    await expect(page.getByText(/entre 1 e 365/).first()).toBeVisible();
    await expect(page.getByText(/Marque a confirmação/).first()).toBeVisible();
    expect(posts).toBe(0);
    await expect(page.getByText(/permission denied|pgrst|sqlstate|violates/i)).toHaveCount(0);
  });

  test("dono recebe 404 na tela", async ({ page }) => {
    test.skip(nomesFaltando("dono").length > 0, "Sem conta E2E_DONO.");
    await entrar(page, "dono");
    const r = await page.goto("/administracao/comissoes");
    expect(r?.status()).toBe(404);
  });
});
