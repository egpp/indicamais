/**
 * Fase 7 · efeito real no DESENVOLVIMENTO (IM-061..IM-073), SOMENTE LEITURA.
 * As tabelas comissoes_* são só-inserção e imutáveis (inclusive para service_role): este spec nunca insere,
 * nunca chama função que grava com dados reais e nunca altera comissoes_parametro. Chamadas RPC usam UUID zero
 * (ou o perfil do dono de teste só quando o módulo NÃO está habilitado, o que a recusa prova).
 * Sem service_role; credenciais só de variáveis de ambiente (D-011). Nada é impresso além de status e códigos.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const Z = "00000000-0000-4000-8000-000000000000";

const TABELAS = [
  "comissoes_parametro",
  "comissoes_habilitacao_evento",
  "comissoes_rede",
  "comissoes_oferta",
  "comissoes_oferta_percentual",
  "comissoes_oferta_estado",
  "comissoes_vinculo",
  "comissoes_vinculo_encerramento",
  "comissoes_assinatura",
  "comissoes_assinatura_cancelamento",
  "comissoes_pagamento",
  "comissoes_pagamento_estorno",
  "comissoes_decisao",
  "comissoes_comissao",
  "comissoes_comissao_estado",
  "comissoes_lancamento",
];
const VISOES = [
  "comissoes_minhas_comissoes",
  "comissoes_meu_saldo",
  "comissoes_minha_situacao",
  "comissoes_meus_negocios",
  "comissoes_minhas_ofertas",
  "comissoes_negocio_comissoes",
  "comissoes_negocio_vinculos",
];
// Todas as funções com EXECUTE para authenticated, com argumentos nulos/zero (anon nem chega a executá-las).
const FUNCOES: Record<string, object> = {
  comissoes_definir_parametro: { p_chave: "prazo_inadimplencia_dias", p_valor: 60, p_motivo: "x" },
  comissoes_definir_habilitacao: { p_perfil: Z, p_ativa: false, p_origem: "x", p_motivo: "x" },
  comissoes_criar_oferta: { p_perfil: Z, p_item_id: Z, p_nome: "x", p_percentual_bp: 100 },
  comissoes_alterar_percentual_oferta: { p_oferta: Z, p_percentual_bp: 100 },
  comissoes_definir_oferta_ativa: { p_oferta: Z, p_ativa: false },
  comissoes_registrar_vinculo: { p_perfil: Z, p_indicador: Z, p_cliente: Z, p_motivo: "x" },
  comissoes_registrar_assinatura: {
    p_oferta: Z,
    p_cliente: Z,
    p_valor_centavos: 100,
    p_inicio: "2026-01-01",
    p_fim: null,
    p_motivo: "x",
  },
  comissoes_cancelar_assinatura: { p_assinatura: Z, p_motivo: "x" },
  comissoes_confirmar_pagamento: {
    p_assinatura: Z,
    p_competencia: "2026-01-01",
    p_valor_centavos: 100,
    p_motivo: "x",
  },
  comissoes_estornar_pagamento: { p_pagamento: Z, p_motivo: "x", p_confirmar_ja_paga: false },
  comissoes_reverter_comissao: {
    p_comissao: Z,
    p_causa: "x",
    p_motivo: "x",
    p_confirmar_ja_paga: false,
  },
  comissoes_avancar_repasse: { p_comissao: Z, p_estado: "x", p_motivo: "x" },
  comissoes_listar_vinculos_vencidos: { p_perfil: Z },
  comissoes_encerrar_vinculo: { p_vinculo: Z, p_motivo: "x" },
  comissoes_situacoes_como_indicador: {},
  comissoes_situacoes_como_responsavel: {},
};
const FUNCOES_ADMIN = ["comissoes_definir_parametro", "comissoes_definir_habilitacao"];

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

async function ler(
  request: APIRequestContext,
  rel: string,
  token?: string,
  qs = "select=*&limit=5",
) {
  const r = await request.get(`${URL_SUPABASE}/rest/v1/${rel}?${qs}`, { headers: cab(token) });
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    /* vazio */
  }
  return { status: r.status(), corpo };
}

async function rpc(request: APIRequestContext, nome: string, args: object, token?: string) {
  const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${nome}`, {
    headers: { ...cab(token), "Content-Type": "application/json" },
    data: args,
  });
  let corpo: { code?: string; message?: string } = {};
  try {
    corpo = await r.json();
  } catch {
    /* vazio */
  }
  return { status: r.status(), code: corpo.code, message: corpo.message ?? "" };
}

test.describe("Fase 7 · comissões no dev (somente leitura)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Sem tela: só no projeto desktop.");
    test.skip(!URL_SUPABASE || !CHAVE_ANON, "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
  });

  test("anon: toda tabela e visão recusada (401/403, nunca 404 nem 200)", async ({ request }) => {
    for (const rel of [...TABELAS, ...VISOES]) {
      const r = await ler(request, rel);
      expect([401, 403], `anon lendo ${rel}`).toContain(r.status);
    }
  });

  test("anon: toda função comissoes_* recusada por permissão (42501), nada executa", async ({
    request,
  }) => {
    for (const [nome, args] of Object.entries(FUNCOES)) {
      const r = await rpc(request, nome, args);
      expect([401, 403], `anon rpc ${nome}`).toContain(r.status);
      expect(r.code, `anon rpc ${nome}`).toBe("42501");
    }
  });

  test("anon: internas e de manutenção também não executáveis", async ({ request }) => {
    for (const nome of [
      "comissoes_hoje",
      "comissoes_modulo_ativo",
      "comissoes_inserir_reversao",
      "comissoes_avaliar_pagamento",
      "comissoes_situacao_indicador",
    ]) {
      const r = await rpc(request, nome, {});
      // 42501 (sem EXECUTE) ou 404/PGRST202 (assinatura não exposta): nunca 200.
      expect([401, 403, 404], `anon rpc ${nome}`).toContain(r.status);
    }
  });

  test("dono: as 7 visões respondem 200 (sem erro de permissão) e são só dele", async ({
    request,
  }) => {
    test.skip(nomesFaltando("dono").length > 0, "Faltam E2E_DONO_*.");
    const token = await tokenDe(request, "dono");
    expect(token, "login do dono").not.toBeNull();
    for (const v of VISOES) {
      const r = await ler(request, v, token!);
      expect(r.status, `dono lendo ${v}`).toBe(200);
      expect(Array.isArray(r.corpo), `${v} é lista`).toBe(true);
    }
    // Tabelas cruas: política só admite administrador. Dono recebe 200 vazio (RLS) ou 401/403, nunca linhas.
    for (const t of TABELAS) {
      const r = await ler(request, t, token!);
      if (r.status === 200) expect(r.corpo, `dono lendo ${t}`).toEqual([]);
      else expect([401, 403], `dono lendo ${t}`).toContain(r.status);
    }
  });

  test("dono: funções de admin recusadas; de anunciante recusadas sem criar nada", async ({
    request,
  }) => {
    test.skip(nomesFaltando("dono").length > 0, "Faltam E2E_DONO_*.");
    const token = (await tokenDe(request, "dono"))!;
    for (const nome of FUNCOES_ADMIN) {
      const r = await rpc(request, nome, FUNCOES[nome], token);
      expect(r.status, `dono rpc ${nome}`).toBeGreaterThanOrEqual(400);
    }
    // Perfil inexistente / alheio: recusa de responsável. Nada é gravado.
    for (const nome of [
      "comissoes_criar_oferta",
      "comissoes_alterar_percentual_oferta",
      "comissoes_definir_oferta_ativa",
    ]) {
      const r = await rpc(request, nome, FUNCOES[nome], token);
      expect(r.status, `dono rpc ${nome} com UUID zero`).toBeGreaterThanOrEqual(400);
    }
    // Com o perfil real do dono: só chama criar_oferta se o módulo NÃO estiver habilitado (a recusa prova IM-061).
    const negocios = (await ler(request, "comissoes_meus_negocios", token)).corpo as {
      negocio_id: string;
      modulo_ativo: boolean;
    }[];
    const perfis = await ler(request, "perfis_meus_perfis", token, "select=id&limit=1");
    const perfilId = (perfis.corpo as { id: string }[] | null)?.[0]?.id;
    const habilitado = negocios.some((n) => n.modulo_ativo && n.negocio_id === perfilId);
    test.skip(
      !perfilId || habilitado,
      "Sem perfil de teste ou módulo habilitado: não chamar (gravaria).",
    );
    const r = await rpc(
      request,
      "comissoes_criar_oferta",
      { p_perfil: perfilId, p_item_id: Z, p_nome: "x", p_percentual_bp: 100 },
      token,
    );
    expect(r.status, "criar_oferta com módulo desabilitado").toBeGreaterThanOrEqual(400);
    expect(r.message).toContain("não habilitado");
  });

  test("indicador: minhas_comissoes/minha_situacao vazias e meu_saldo zerado; funções admin recusadas", async ({
    request,
  }) => {
    test.skip(nomesFaltando("indicador").length > 0, "Faltam E2E_INDICADOR_*.");
    const token = (await tokenDe(request, "indicador"))!;
    expect(token, "login do indicador").not.toBeNull();
    for (const v of [
      "comissoes_minhas_comissoes",
      "comissoes_meu_saldo",
      "comissoes_minha_situacao",
    ]) {
      const r = await ler(request, v, token);
      expect(r.status, `indicador lendo ${v}`).toBe(200);
      if (v === "comissoes_meu_saldo") {
        // Agregado do próprio usuário: uma linha de zeros (sem comissões).
        const l = r.corpo as Record<string, number>[];
        expect(l.length, `${v} no máximo uma linha`).toBeLessThanOrEqual(1);
        for (const n of Object.values(l[0] ?? {})) expect(n, `${v} zerada`).toBe(0);
      } else {
        expect(r.corpo, `${v} vazia`).toEqual([]);
      }
    }
    for (const nome of FUNCOES_ADMIN) {
      const r = await rpc(request, nome, FUNCOES[nome], token);
      expect(r.status, `indicador rpc ${nome}`).toBeGreaterThanOrEqual(400);
    }
    const s = await ler(request, "comissoes_parametro", token);
    if (s.status === 200) expect(s.corpo).toEqual([]);
  });

  test("admin: lê as 16 tabelas (schema existe) e prazo_inadimplencia_dias = 60 (sem alterar)", async ({
    request,
  }) => {
    test.skip(nomesFaltando("admin").length > 0, "Faltam E2E_ADMIN_*.");
    const token = (await tokenDe(request, "admin"))!;
    expect(token, "login do admin").not.toBeNull();
    expect(TABELAS).toHaveLength(16);
    for (const t of TABELAS) {
      const r = await ler(request, t, token, "select=*&limit=1");
      expect(r.status, `admin lendo ${t}`).toBe(200);
    }
    const p = await ler(
      request,
      "comissoes_parametro",
      token,
      "select=*&chave=eq.prazo_inadimplencia_dias",
    );
    expect(p.status).toBe(200);
    const linhas = p.corpo as { chave: string; valor: number }[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].valor).toBe(60);
  });
});
