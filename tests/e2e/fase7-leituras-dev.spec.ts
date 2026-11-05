/**
 * Fase 7 · efeito real das leituras administrativas no DESENVOLVIMENTO (IM-061..IM-073), SOMENTE LEITURA.
 * Migração 20261105140000. Só chama funções de leitura (stable); nunca escreve em comissoes_*.
 * Sem service_role; credenciais só de variáveis de ambiente (D-011). Só imprime status e códigos.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// [função, filtro de estado, valores válidos, valor inválido]
const LISTAS: [string, string, string[]][] = [
  ["comissoes_admin_listar_negocios", "p_estado", ["habilitado", "nao_habilitado"]],
  ["comissoes_admin_listar_assinaturas", "p_situacao", ["ativa", "encerrada", "cancelada"]],
  ["comissoes_admin_listar_pagamentos", "p_estado", ["confirmado", "estornado"]],
  ["comissoes_admin_listar_comissoes", "p_estado", ["gerada", "pendente_repasse", "paga"]],
  ["comissoes_admin_listar_vinculos", "p_situacao", ["ativo", "encerrado"]],
];
const ADMIN_FUNCOES = [...LISTAS.map((l) => l[0]), "comissoes_admin_prazo_inadimplencia"];
const TODAS = [...ADMIN_FUNCOES, "comissoes_meus_negocios_vinculados"];
const PROIBIDAS = /nome_completo|telefone|phone|e-?mail|email|whatsapp|cpf|motivo/i;

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
async function rpc(request: APIRequestContext, nome: string, args: object, token?: string) {
  const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${nome}`, {
    headers: { ...cab(token), "Content-Type": "application/json" },
    data: args,
  });
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    /* vazio */
  }
  const c = corpo as { code?: string } | null;
  return { status: r.status(), code: c && !Array.isArray(c) ? c.code : undefined, corpo };
}
function linhas(corpo: unknown): Record<string, unknown>[] {
  expect(Array.isArray(corpo)).toBe(true);
  return corpo as Record<string, unknown>[];
}

test.describe("Fase 7 · leituras administrativas no dev (somente leitura)", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Sem tela: só no projeto desktop.");
    test.skip(!URL_SUPABASE || !CHAVE_ANON, "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
  });

  test("anon: as 7 funções recusadas (401/403/42501)", async ({ request }) => {
    for (const f of TODAS) {
      const r = await rpc(request, f, {});
      expect([401, 403], `anon em ${f}`).toContain(r.status);
      if (r.code) expect(r.code, f).toBe("42501");
    }
  });

  for (const papel of ["dono", "indicador"] as const) {
    test(`${papel}: 6 funções de admin recusam com 42501; negócios vinculados responde`, async ({
      request,
    }) => {
      const token = await tokenDe(request, papel);
      test.skip(!token, `Sem conta E2E_${papel.toUpperCase()}.`);
      for (const f of ADMIN_FUNCOES) {
        const r = await rpc(request, f, {}, token!);
        expect(r.code, `${papel} em ${f}`).toBe("42501");
      }
      const v = await rpc(request, "comissoes_meus_negocios_vinculados", {}, token!);
      expect(v.status).toBe(200);
      const l = linhas(v.corpo);
      for (const x of l)
        expect(Object.keys(x).sort()).toEqual(["o_negocio_id", "o_nome", "o_slug"]);
    });
  }

  test("admin: listas respondem, filtros válidos, inválido 22023, paginação e busca", async ({
    request,
  }) => {
    const t = await tokenDe(request, "admin");
    test.skip(!t, "Sem conta E2E_ADMIN.");
    for (const [f, campo, validos] of LISTAS) {
      const base = await rpc(request, f, {}, t!);
      expect(base.status, f).toBe(200);
      const l0 = linhas(base.corpo);
      for (const x of l0) {
        expect(Object.keys(x).join(","), `${f} colunas`).not.toMatch(PROIBIDAS);
        expect(Number(x.o_total)).toBeGreaterThanOrEqual(l0.length);
      }
      expect(l0.length).toBeLessThanOrEqual(50);
      for (const v of validos) {
        const r = await rpc(request, f, { [campo]: v }, t!);
        expect(r.status, `${f} ${v}`).toBe(200);
        linhas(r.corpo);
      }
      const inv = await rpc(request, f, { [campo]: "valor_invalido" }, t!);
      expect(inv.code, `${f} filtro inválido`).toBe("22023");
      for (const lim of [0, 1, 1000, null]) {
        const r = await rpc(request, f, { p_limite: lim }, t!);
        expect(r.status, `${f} limite ${lim}`).toBe(200);
        const n = linhas(r.corpo).length;
        expect(n).toBeLessThanOrEqual(lim === 1000 ? 100 : lim === 0 || lim === 1 ? 1 : 50);
      }
      const desl = await rpc(request, f, { p_deslocamento: -5 }, t!);
      expect(desl.status, `${f} deslocamento negativo`).toBe(200);
      linhas(desl.corpo);
    }
    for (const busca of ["%", "_", "%_%", "' or 1=1 --"]) {
      const r = await rpc(request, "comissoes_admin_listar_negocios", { p_busca: busca }, t!);
      expect(r.status, `busca ${busca}`).toBe(200);
      // busca literal (sem LIKE): coringas não casam tudo
      const l = linhas(r.corpo);
      for (const x of l) {
        const alvo = `${x.o_slug ?? ""} ${x.o_nome ?? ""}`.toLowerCase();
        expect(alvo).toContain(busca.toLowerCase().trim());
      }
    }
  });

  test("admin: prazo de inadimplência 60/1/365 e sem dados pessoais", async ({ request }) => {
    const t = await tokenDe(request, "admin");
    test.skip(!t, "Sem conta E2E_ADMIN.");
    const r = await rpc(request, "comissoes_admin_prazo_inadimplencia", {}, t!);
    expect(r.status).toBe(200);
    const l = linhas(r.corpo);
    expect(l).toHaveLength(1);
    expect([l[0].o_prazo_dias, l[0].o_minimo, l[0].o_maximo]).toEqual([60, 1, 365]);
    expect(Object.keys(l[0]).join(",")).not.toMatch(PROIBIDAS);
  });
});
