/**
 * Fase 3 · privacidade e permissões VISTAS PELA API (PostgREST) com a chave anon pública e com a sessão de
 * contas de teste de dev (D-011). Nenhum teste usa service_role nem cria usuários. As credenciais vêm só de
 * variáveis de ambiente e nunca são impressas. Cobre IM-029, IM-041, IM-050, IM-086.
 *
 * Nenhum caso cria dados: todas as chamadas de escrita são recusadas ou falham na validação.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Roda uma vez (a API não depende do viewport).
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "Sem tela: executa só no projeto desktop.");
  test.skip(
    !URL_SUPABASE || !CHAVE_ANON,
    "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no .env.local.",
  );
});

const TABELAS = [
  "indicacoes_parametro",
  "indicacoes_link",
  "indicacoes_pedido_contato",
  "indicacoes_notificacao",
  "indicacoes_notificacao_historico",
  "indicacoes_evento",
];
const VISOES = [
  "indicacoes_meus_pedidos",
  "indicacoes_minhas_indicacoes",
  "indicacoes_meus_links",
  "administracao_fila_contatos",
];
const UUID_ZERO = "00000000-0000-4000-8000-000000000000";

function cabecalhos(token?: string) {
  return {
    apikey: CHAVE_ANON,
    Authorization: `Bearer ${token ?? CHAVE_ANON}`,
    "Content-Type": "application/json",
  };
}

async function tokenDe(request: APIRequestContext, papel: Papel): Promise<string | null> {
  if (nomesFaltando(papel).length > 0) return null;
  const { email, senha } = credenciais(papel);
  const r = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    data: { email, password: senha },
  });
  if (!r.ok()) return null;
  return ((await r.json()) as { access_token?: string }).access_token ?? null;
}

const negado = (status: number) => [401, 403, 404].includes(status);

test.describe("anônimo (chave anon, sem login)", () => {
  for (const nome of [...TABELAS, ...VISOES]) {
    test(`não lê ${nome}`, async ({ request }) => {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/${nome}?select=*&limit=1`, {
        headers: cabecalhos(),
      });
      expect(negado(r.status()), `status ${r.status()}`).toBe(true);
      expect(Array.isArray(await r.json())).toBe(false);
    });
  }

  for (const nome of TABELAS) {
    test(`não escreve em ${nome}`, async ({ request }) => {
      const r = await request.post(`${URL_SUPABASE}/rest/v1/${nome}`, {
        headers: cabecalhos(),
        data: {},
      });
      expect(negado(r.status()), `status ${r.status()}`).toBe(true);
    });
  }

  const FUNCOES_FECHADAS: [string, Record<string, unknown>][] = [
    ["indicacoes_gerar_link", { p_perfil_id: UUID_ZERO }],
    ["indicacoes_registrar_compartilhamento", { p_codigo: "a".repeat(32), p_canal: "copiar" }],
    ["indicacoes_solicitar_reenvio", { p_pedido_id: UUID_ZERO }],
    ["indicacoes_tratar_alerta", { p_pedido_id: UUID_ZERO, p_motivo: "x" }],
    ["indicacoes_definir_parametro", { p_chave: "x", p_valor: 1, p_motivo: "x" }],
    ["indicacoes_notificacoes_pendentes", { p_limite: 5 }],
    ["indicacoes_notificacao_registrar", { p_pedido_id: UUID_ZERO, p_sucesso: true }],
    ["indicacoes_resolver_destino", { p_perfil_id: UUID_ZERO, p_item_id: null }],
    ["indicacoes_parametro_valor", { p_chave: "contato_janela_repeticao_minutos" }],
    ["indicacoes_eh_responsavel_do_pedido", { p_pedido_id: UUID_ZERO }],
  ];
  for (const [fn, args] of FUNCOES_FECHADAS) {
    test(`não executa ${fn}`, async ({ request }) => {
      const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${fn}`, {
        headers: cabecalhos(),
        data: args,
      });
      expect(negado(r.status()), `status ${r.status()}`).toBe(true);
    });
  }

  // indicacoes_enviar_contato é a ÚNICA função aberta ao anônimo: só entradas inválidas aqui (não criam dado).
  const base = {
    p_perfil_id: UUID_ZERO,
    p_item_id: null,
    p_nome: "E2E Invalido",
    p_whatsapp: "+5511999990002",
    p_chave: "e2e-chave-invalida-0001",
  };
  const INVALIDAS: [string, Record<string, unknown>][] = [
    ["WhatsApp com dígitos de largura total", { ...base, p_whatsapp: "+55１１９９９９９０００２" }],
    ["WhatsApp com letras", { ...base, p_whatsapp: "+5511abcde0002" }],
    ["WhatsApp sem +55", { ...base, p_whatsapp: "11999990002" }],
    ["WhatsApp com invisível", { ...base, p_whatsapp: "+5511999990002​" }],
    ["WhatsApp com quebra de linha final", { ...base, p_whatsapp: "+5511999990002\n" }],
    ["nome com zero-width", { ...base, p_nome: "E2E​Teste" }],
    ["nome de 1 caractere", { ...base, p_nome: "E" }],
    ["e-mail inválido", { ...base, p_email: "sem-arroba" }],
    ["mensagem com caractere de controle", { ...base, p_mensagem: "oi\u0001" }],
    ["chave curta", { ...base, p_chave: "curta" }],
    ["chave com caractere inválido", { ...base, p_chave: "chave com espaco 123456" }],
    ["sem destino", { ...base, p_perfil_id: null }],
    ["dois destinos", { ...base, p_item_id: UUID_ZERO }],
    ["destino inexistente (indisponível)", { ...base }],
  ];
  for (const [rotulo, args] of INVALIDAS) {
    test(`enviar_contato recusa: ${rotulo}`, async ({ request }) => {
      const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/indicacoes_enviar_contato`, {
        headers: cabecalhos(),
        data: args,
      });
      expect(r.ok(), `status ${r.status()}`).toBe(false);
      // A resposta de erro não devolve nenhum número de WhatsApp.
      expect(await r.text()).not.toMatch(/\+55[0-9]{10}/);
    });
  }
});

for (const papel of ["indicador", "dono"] as const) {
  test.describe(`autenticado como ${papel} (sessão real, sem service_role)`, () => {
    let token: string | null = null;
    test.beforeAll(async ({ playwright }) => {
      const ctx = await playwright.request.newContext();
      token = await tokenDe(ctx, papel);
      await ctx.dispose();
    });
    test.beforeEach(() => {
      test.skip(!token, `Conta ${papel} ausente ou login recusado (variáveis E2E_*).`);
    });

    for (const nome of TABELAS.filter(
      (t) => t !== "indicacoes_parametro" && t !== "indicacoes_evento",
    )) {
      test(`sem privilégio de tabela em ${nome}`, async ({ request }) => {
        const r = await request.get(`${URL_SUPABASE}/rest/v1/${nome}?select=*&limit=1`, {
          headers: cabecalhos(token!),
        });
        expect(negado(r.status()), `status ${r.status()}`).toBe(true);
      });
    }

    for (const nome of [
      "indicacoes_parametro",
      "indicacoes_evento",
      "administracao_fila_contatos",
    ]) {
      test(`${nome} vem vazio para quem não é administrador`, async ({ request }) => {
        const r = await request.get(`${URL_SUPABASE}/rest/v1/${nome}?select=*&limit=5`, {
          headers: cabecalhos(token!),
        });
        expect(r.status()).toBe(200);
        expect(await r.json()).toEqual([]);
      });
    }

    test("indicacoes_minhas_indicacoes só tem destino, data e status (sem dado do visitante)", async ({
      request,
    }) => {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/indicacoes_minhas_indicacoes?select=*`, {
        headers: cabecalhos(token!),
      });
      expect(r.status()).toBe(200);
      const linhas = (await r.json()) as Record<string, unknown>[];
      const permitidas = new Set([
        "id",
        "destino_tipo",
        "destino_id",
        "destino_nome",
        "criado_em",
        "status",
      ]);
      for (const l of linhas)
        for (const k of Object.keys(l)) expect(permitidas.has(k), k).toBe(true);
      const texto = JSON.stringify(linhas);
      expect(texto).not.toMatch(/E2E Teste|99999-?0002|\+55[0-9]{10}|indicador_id|solicitante_id/);
    });

    test("não pede colunas privadas por select explícito nas visões do indicador", async ({
      request,
    }) => {
      for (const coluna of [
        "nome",
        "whatsapp_e164",
        "email",
        "mensagem",
        "indicador_id",
        "solicitante_id",
      ]) {
        for (const visao of ["indicacoes_minhas_indicacoes", "indicacoes_meus_links"]) {
          const r = await request.get(`${URL_SUPABASE}/rest/v1/${visao}?select=${coluna}`, {
            headers: cabecalhos(token!),
          });
          expect(r.ok(), `${visao}.${coluna}`).toBe(false);
        }
      }
    });

    test("indicacoes_meus_links não expõe id de conta", async ({ request }) => {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/indicacoes_meus_links?select=*`, {
        headers: cabecalhos(token!),
      });
      expect(r.status()).toBe(200);
      for (const l of (await r.json()) as Record<string, unknown>[]) {
        expect(Object.keys(l).sort()).toEqual(
          [
            "codigo",
            "criado_em",
            "destino_id",
            "destino_nome",
            "destino_tipo",
            "disponivel",
            "id",
          ].sort(),
        );
      }
    });

    test("indicacoes_meus_pedidos (responsável) não traz id de conta", async ({ request }) => {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/indicacoes_meus_pedidos?select=*`, {
        headers: cabecalhos(token!),
      });
      expect(r.status()).toBe(200);
      for (const l of (await r.json()) as Record<string, unknown>[]) {
        for (const k of Object.keys(l)) {
          expect(/(^|_)(indicador|solicitante|conta|responsavel)_id$/.test(k), k).toBe(false);
        }
      }
    });

    const PROIBIDAS: [string, Record<string, unknown>][] = [
      ["indicacoes_notificacoes_pendentes", { p_limite: 5 }],
      ["indicacoes_notificacao_registrar", { p_pedido_id: UUID_ZERO, p_sucesso: true }],
      ["indicacoes_resolver_destino", { p_perfil_id: UUID_ZERO, p_item_id: null }],
      ["indicacoes_parametro_valor", { p_chave: "contato_janela_repeticao_minutos" }],
    ];
    for (const [fn, args] of PROIBIDAS) {
      test(`não executa ${fn} (só service_role)`, async ({ request }) => {
        const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${fn}`, {
          headers: cabecalhos(token!),
          data: args,
        });
        expect(negado(r.status()), `status ${r.status()}`).toBe(true);
      });
    }

    test("não altera parâmetro nem trata alerta (administrador apenas)", async ({ request }) => {
      const a = await request.post(`${URL_SUPABASE}/rest/v1/rpc/indicacoes_definir_parametro`, {
        headers: cabecalhos(token!),
        data: { p_chave: "contato_janela_repeticao_minutos", p_valor: 10, p_motivo: "e2e" },
      });
      expect(a.ok()).toBe(false);
      const b = await request.post(`${URL_SUPABASE}/rest/v1/rpc/indicacoes_tratar_alerta`, {
        headers: cabecalhos(token!),
        data: { p_pedido_id: UUID_ZERO, p_motivo: "e2e" },
      });
      expect(b.ok()).toBe(false);
    });

    test("reenvio de pedido que não é seu é recusado", async ({ request }) => {
      const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/indicacoes_solicitar_reenvio`, {
        headers: cabecalhos(token!),
        data: { p_pedido_id: UUID_ZERO },
      });
      expect(r.ok()).toBe(false);
    });

    test("compartilhamento de código alheio/inexistente é recusado", async ({ request }) => {
      const r = await request.post(
        `${URL_SUPABASE}/rest/v1/rpc/indicacoes_registrar_compartilhamento`,
        {
          headers: cabecalhos(token!),
          data: { p_codigo: "f".repeat(32), p_canal: "copiar" },
        },
      );
      expect(r.ok()).toBe(false);
    });

    test("não escreve direto nas tabelas (insert/update/delete)", async ({ request }) => {
      // PATCH com corpo vazio é no-op no PostgREST: usa coluna real e filtro que não casa com linha alguma.
      const ALVOS: Record<string, { coluna: string; valor: unknown; nenhum: string }> = {
        indicacoes_parametro: { coluna: "valor", valor: 1, nenhum: "chave=eq.__inexistente__" },
        indicacoes_link: {
          coluna: "codigo",
          valor: "a".repeat(32),
          nenhum: "criado_em=lt.1900-01-01",
        },
        indicacoes_pedido_contato: {
          coluna: "nome",
          valor: "x",
          nenhum: "criado_em=lt.1900-01-01",
        },
        indicacoes_notificacao: {
          coluna: "estado",
          valor: "enviada",
          nenhum: "atualizado_em=lt.1900-01-01",
        },
        indicacoes_notificacao_historico: {
          coluna: "erro",
          valor: "x",
          nenhum: "criado_em=lt.1900-01-01",
        },
        indicacoes_evento: { coluna: "canal", valor: "copiar", nenhum: "criado_em=lt.1900-01-01" },
      };
      for (const nome of TABELAS) {
        const a = ALVOS[nome]!;
        const i = await request.post(`${URL_SUPABASE}/rest/v1/${nome}`, {
          headers: cabecalhos(token!),
          data: { [a.coluna]: a.valor },
        });
        expect(i.ok(), `insert ${nome} -> ${i.status()}`).toBe(false);
        const u = await request.patch(`${URL_SUPABASE}/rest/v1/${nome}?${a.nenhum}`, {
          headers: cabecalhos(token!),
          data: { [a.coluna]: a.valor },
        });
        expect(u.ok(), `update ${nome} -> ${u.status()}`).toBe(false);
        const d = await request.delete(`${URL_SUPABASE}/rest/v1/${nome}?${a.nenhum}`, {
          headers: cabecalhos(token!),
        });
        expect(d.ok(), `delete ${nome} -> ${d.status()}`).toBe(false);
      }
    });
  });
}
