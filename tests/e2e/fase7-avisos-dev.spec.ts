/**
 * Fase 7 · efeito real dos avisos de inadimplência no DESENVOLVIMENTO (IM-072, IM-051, IM-052, IM-065, IM-086), SOMENTE LEITURA.
 * Migração 20261105150000. Lê a visão notificacoes_meus_avisos, tenta marcar um id inexistente (recusa sem gravar)
 * e lê parâmetros como administrador. Nunca escreve em comissoes_*. Sem service_role (D-011).
 * Só imprime status e códigos.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, entrar, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const COLUNAS = [
  "ator_nome",
  "criado_em",
  "destino_id",
  "destino_nome",
  "destino_tipo",
  "lida",
  "lida_em",
  "origem",
  "origem_id",
  "tipo",
];
const PROIBIDAS = /telefone|phone|e-?mail|email|whatsapp|cpf|valor|centavos|nome_completo/i;
const PAPEIS: Papel[] = ["dono", "indicador", "admin"];

function cab(token?: string) {
  return { apikey: CHAVE_ANON, Authorization: `Bearer ${token ?? CHAVE_ANON}` };
}
async function tokenDe(request: APIRequestContext, papel: Papel): Promise<string | null> {
  if (nomesFaltando(papel).length > 0) return null;
  const { email, senha } = credenciais(papel);
  const r = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    data: { email, password: senha },
  });
  return r.ok() ? ((await r.json()) as { access_token: string }).access_token : null;
}
async function lerJson(r: Awaited<ReturnType<APIRequestContext["get"]>>) {
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    /* vazio */
  }
  const c = corpo as { code?: string; message?: string } | null;
  return {
    status: r.status(),
    code: c && !Array.isArray(c) ? c.code : undefined,
    message: c && !Array.isArray(c) ? c.message : undefined,
    corpo,
  };
}
const ler = async (request: APIRequestContext, caminho: string, token?: string) =>
  lerJson(await request.get(`${URL_SUPABASE}/rest/v1/${caminho}`, { headers: cab(token) }));

test.describe("Fase 7 · avisos de inadimplência no dev (somente leitura)", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeEach(({}, info) => {
    test.skip(!URL_SUPABASE || !CHAVE_ANON, "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
    test.skip(
      info.title.startsWith("sino") ? false : info.project.name !== "desktop",
      "Só desktop.",
    );
  });

  test("anon não lê notificacoes_meus_avisos nem marca lida", async ({ request }) => {
    const r = await ler(request, "notificacoes_meus_avisos?select=*&limit=1");
    expect([401, 403]).toContain(r.status);
    if (r.code) expect(r.code).toBe("42501");
    const m = await lerJson(
      await request.post(`${URL_SUPABASE}/rest/v1/rpc/notificacoes_marcar_lida`, {
        headers: { ...cab(), "Content-Type": "application/json" },
        data: { p_origem: "inadimplencia", p_origem_id: "00000000-0000-4000-8000-000000000001" },
      }),
    );
    expect([401, 403]).toContain(m.status);
  });

  for (const papel of PAPEIS) {
    test(`${papel}: visão responde 200, colunas esperadas, sem dados privados`, async ({
      request,
    }) => {
      const token = await tokenDe(request, papel);
      test.skip(!token, `Sem conta E2E_${papel.toUpperCase()}.`);
      const r = await ler(request, "notificacoes_meus_avisos?select=*&limit=200", token!);
      expect(r.status, `${papel} status`).toBe(200);
      expect(r.code, `${papel} permissão`).toBeUndefined();
      expect(Array.isArray(r.corpo)).toBe(true);
      const linhas = r.corpo as Record<string, unknown>[];
      console.log(
        `${papel}: ${linhas.length} aviso(s), ${linhas.filter((x) => x.origem === "inadimplencia").length} de inadimplencia`,
      );
      for (const x of linhas) {
        expect(Object.keys(x).sort()).toEqual(COLUNAS);
        expect(x.ator_nome).toBeNull();
        expect(Object.keys(x).join(",")).not.toMatch(PROIBIDAS);
        if (x.origem === "inadimplencia")
          expect(JSON.stringify(x), "texto livre sem contato").not.toMatch(/@|\+55|R\$/);
      }
    });
  }

  test("marcar_lida com origem inadimplencia e id inexistente: P0002 neutro, sem gravar", async ({
    request,
  }) => {
    for (const papel of PAPEIS) {
      const token = await tokenDe(request, papel);
      test.skip(!token, `Sem conta E2E_${papel.toUpperCase()}.`);
      const antes = await ler(
        request,
        "notificacoes_meus_avisos?select=origem_id&lida=eq.true",
        token!,
      );
      const r = await lerJson(
        await request.post(`${URL_SUPABASE}/rest/v1/rpc/notificacoes_marcar_lida`, {
          headers: { ...cab(token!), "Content-Type": "application/json" },
          data: { p_origem: "inadimplencia", p_origem_id: "00000000-0000-4000-8000-0000000000aa" },
        }),
      );
      expect(r.code, `${papel}`).toBe("P0002");
      expect(r.message ?? "").not.toMatch(/inadimpl|comissoes|valor|@/i);
      const depois = await ler(
        request,
        "notificacoes_meus_avisos?select=origem_id&lida=eq.true",
        token!,
      );
      expect((depois.corpo as unknown[]).length).toBe((antes.corpo as unknown[]).length);
    }
  });

  test("admin lê aviso_encerramento_antecedencia_dias=7 e prazo_inadimplencia_dias=60", async ({
    request,
  }) => {
    const t = await tokenDe(request, "admin");
    test.skip(!t, "Sem conta E2E_ADMIN.");
    const r = await ler(
      request,
      "comissoes_parametro?select=chave,valor&chave=in.(aviso_encerramento_antecedencia_dias,prazo_inadimplencia_dias)",
      t!,
    );
    expect(r.status).toBe(200);
    const m = Object.fromEntries(
      (r.corpo as { chave: string; valor: number }[]).map((x) => [x.chave, Number(x.valor)]),
    );
    expect(m.aviso_encerramento_antecedencia_dias).toBe(7);
    expect(m.prazo_inadimplencia_dias).toBe(60);
    // dono e indicador não leem a tabela de parâmetros (RLS)
    for (const papel of ["dono", "indicador"] as const) {
      const tk = await tokenDe(request, papel);
      if (!tk) continue;
      const o = await ler(request, "comissoes_parametro?select=chave,valor", tk);
      expect(o.status === 200 ? (o.corpo as unknown[]).length : 0).toBe(0);
    }
  });

  for (const papel of PAPEIS) {
    test(`sino: ${papel} carrega /avisos sem erro`, async ({ page }) => {
      test.skip(nomesFaltando(papel).length > 0, `Sem conta E2E_${papel.toUpperCase()}.`);
      const erros: string[] = [];
      page.on("pageerror", (e) => erros.push(e.message));
      await entrar(page, papel);
      await page.waitForLoadState("networkidle");
      await page.goto("/");
      const sino = page.locator("a.sino[href='/avisos']").first();
      await expect(sino).toBeVisible();
      await sino.click();
      await expect(page).toHaveURL(/\/avisos/);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(
        page.getByText(/algo deu errado|application error|permission denied/i),
      ).toHaveCount(0);
      expect(erros).toEqual([]);
    });
  }
});
