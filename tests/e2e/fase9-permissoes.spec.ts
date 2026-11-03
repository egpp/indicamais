/**
 * Fase 9 · permissão individual (IM-077, D-014) no DEV. Cria pela tela /cadastro uma conta de teste "E2E Analista"
 * (Confirm email está desligado no dev), o administrador geral concede SÓ analisar_denuncias em /administracao/permissoes
 * com motivo, a conta vê no menu somente "Denúncias" e recebe 404 nas demais telas administrativas; depois a permissão é
 * revogada e a tela de denúncias volta a ser 404. O id da conta vem do JWT do cookie da própria sessão de teste (sem
 * service_role). Cada rodada cria UMA conta nova (e-mail único em example.com); ela permanece sem permissão alguma.
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const SUFIXO = Date.now().toString(36);
const EMAIL = `e2e-analista-${SUFIXO}@example.com`;
const SENHA = `E2e-${SUFIXO}-Senha1`;
const FOTO = (n: string) => `test-results/fase9/${n}.png`;

const OUTRAS_TELAS_ADMIN = [
  "/administracao/revisao",
  "/administracao/permissoes",
  "/administracao/pontos",
  "/administracao/beneficios",
  "/administracao/parametros",
  "/administracao/patrocinadores",
  "/administracao/categorias",
  "/administracao/pedidos",
  "/administracao/negocios",
  "/administracao/estilos",
  "/administracao/contas",
  "/administracao/indicacoes",
];

/** Lê o id (sub) do JWT guardado no cookie de sessão do Supabase. Não imprime o token. */
async function idDaConta(ctx: BrowserContext): Promise<string> {
  const cookies = (await ctx.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  expect(cookies.length, "cookie de sessão do Supabase").toBeGreaterThan(0);
  const bruto = cookies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => decodeURIComponent(c.value))
    .join("");
  const json = bruto.startsWith("base64-")
    ? Buffer.from(bruto.slice(7), "base64url").toString("utf8")
    : bruto;
  const jwt = (JSON.parse(json) as { access_token: string }).access_token;
  const sub = (
    JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf8")) as { sub: string }
  ).sub;
  expect(sub).toMatch(/^[0-9a-f-]{36}$/);
  return sub;
}

test("IM-077: conta com UMA permissão (analisar_denuncias) vê só Denúncias e 404 no resto; revogada, perde o acesso", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "Só no desktop.");
  test.setTimeout(240_000);
  exigirConta("admin");

  // 1) cadastro pela UI
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  a.setDefaultTimeout(30_000);
  await a.goto("/cadastro");
  await a.getByLabel("Nome (opcional)").fill("E2E Analista");
  await a.getByLabel("E-mail").fill(EMAIL);
  await a.getByLabel("Senha", { exact: true }).fill(SENHA);
  await a.getByRole("button", { name: "Criar conta" }).click();
  await expect(a).not.toHaveURL(/\/cadastro/, { timeout: 45_000 });
  await a.goto("/minha-conta");
  await expect(a.getByRole("heading", { level: 1, name: "Minha conta" })).toBeVisible();
  const contaId = await idDaConta(ctxA);

  // 2) sem permissão: nada de administração (nem o grupo no menu)
  await expect(a.locator("summary", { hasText: "Administração" })).toHaveCount(0);
  for (const rota of ["/administracao/denuncias", ...OUTRAS_TELAS_ADMIN]) {
    expect((await a.goto(rota))?.status(), `sem permissão ${rota}`).toBe(404);
  }

  // 3) administrador concede só analisar_denuncias, com motivo
  const ctxB = await browser.newContext();
  const adm = await ctxB.newPage();
  adm.setDefaultTimeout(30_000);
  await entrar(adm, "admin");
  await adm.goto("/administracao/permissoes");
  await adm.getByLabel("Identificador da conta").fill(contaId);
  await adm.getByLabel("Permissão", { exact: true }).selectOption("analisar_denuncias");
  // Motivo é obrigatório: sem ele não concede.
  await adm.getByRole("button", { name: "Conceder permissão" }).click();
  await expect(adm.locator(".erro-campo, [role=alert]").first()).toBeVisible();
  await expect(adm.getByText(contaId)).toHaveCount(0);
  await adm.getByLabel("Motivo").fill("E2E Fase 9: verificar permissão individual (será revogada)");
  await adm.getByRole("button", { name: "Conceder permissão" }).click();
  await expect(adm.getByText(`Conta: ${contaId}`)).toBeVisible({ timeout: 30_000 });
  await adm.screenshot({ path: FOTO("b5-permissao-concedida") });

  try {
    // 4) a conta vê só Denúncias na administração
    await a.goto("/minha-conta");
    await a.locator("summary", { hasText: "Administração" }).first().click();
    const hrefsAdmin = await a
      .locator('a[href^="/administracao"]')
      .evaluateAll((as) => [...new Set(as.map((x) => x.getAttribute("href")))]);
    expect(hrefsAdmin).toEqual(["/administracao/denuncias"]);
    await a.screenshot({ path: FOTO("b5-menu-so-denuncias") });
    const r = await a.goto("/administracao/denuncias");
    expect(r?.status()).toBe(200);
    await expect(a.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    for (const rota of OUTRAS_TELAS_ADMIN) {
      expect((await a.goto(rota))?.status(), `só denúncias: ${rota}`).toBe(404);
    }
  } finally {
    // 5) revoga (sempre)
    await adm.goto("/administracao/permissoes");
    const cartao = adm.locator("li.cartao", { hasText: contaId });
    await cartao.locator("summary", { hasText: "Revogar" }).click();
    await cartao.getByLabel("Motivo").fill("E2E Fase 9: fim da verificação");
    await cartao
      .getByRole("button", { name: /Revogar/ })
      .last()
      .click();
    await expect(adm.locator("li.cartao", { hasText: contaId })).toHaveCount(0, {
      timeout: 30_000,
    });
    await adm.screenshot({ path: FOTO("b5-permissao-revogada") });
  }

  // 6) depois de revogar, denúncias volta a 404
  expect((await a.goto("/administracao/denuncias"))?.status()).toBe(404);
  const hrefsDepois = await a.locator('a[href^="/administracao"]').count();
  expect(hrefsDepois).toBe(0);
  await ctxA.close();
  await ctxB.close();
});
