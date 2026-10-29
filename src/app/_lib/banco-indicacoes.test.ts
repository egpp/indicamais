import { describe, expect, it } from "vitest";
import type { ClienteSupabaseFase2 } from "./bancos-supabase";
import {
  COLUNAS_INDICACOES,
  criarBancoIndicacoes,
  criarBancoNotificacoes,
} from "./banco-indicacoes";

/** Cliente supabase-js falso: registra o que foi chamado e devolve o que o teste mandar. */
function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const chamadas: { rpc: [string, unknown][]; selects: [string, string][] } = {
    rpc: [],
    selects: [],
  };
  const pronto = () => {
    if (lancar) throw new Error("rede caiu: segredo-interno");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const cliente = {
    rpc: (nome: string, args: unknown) => {
      chamadas.rpc.push([nome, args]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (tabela: string) => ({
      select: (colunas: string) => {
        chamadas.selects.push([tabela, colunas]);
        return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
      },
    }),
  };
  return { cliente: cliente as unknown as ClienteSupabaseFase2, chamadas };
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("adaptador do banco de indicações (sessão do usuário)", () => {
  it("lê as visões com colunas nomeadas, nunca com '*'", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoIndicacoes(cliente);
    await banco.listarMeusPedidos();
    await banco.listarMinhasIndicacoes();
    await banco.listarMeusLinks();
    await banco.listarFilaContatos();
    await banco.listarParametros();
    expect(chamadas.selects.map(([t]) => t)).toEqual([
      "indicacoes_meus_pedidos",
      "indicacoes_minhas_indicacoes",
      "indicacoes_meus_links",
      "administracao_fila_contatos",
      "indicacoes_parametro",
    ]);
    for (const [, colunas] of chamadas.selects) {
      expect(colunas).not.toMatch(/\*/);
      expect(colunas.trim()).not.toBe("");
    }
  });

  it("a visão do indicador não pede nenhuma coluna do visitante (IM-029)", () => {
    expect(COLUNAS_INDICACOES.minhasIndicacoes.split(", ")).toEqual([
      "id",
      "destino_tipo",
      "destino_id",
      "destino_nome",
      "criado_em",
      "status",
    ]);
    expect(COLUNAS_INDICACOES.meusLinks).not.toMatch(/whatsapp|email|mensagem/);
  });

  it("gerarLink omite o destino que não se aplica e devolve as linhas o_*", async () => {
    const linhas = [{ o_codigo: "a".repeat(32), o_novo: true }];
    const { cliente, chamadas } = falso({ data: linhas });
    const r = await criarBancoIndicacoes(cliente).gerarLink({ perfilId: ID, itemId: null });
    expect(chamadas.rpc).toEqual([["indicacoes_gerar_link", { p_perfil_id: ID }]]);
    expect(r).toEqual({ dados: linhas, erro: null });
    await criarBancoIndicacoes(cliente).gerarLink({ perfilId: null, itemId: ID });
    expect(chamadas.rpc[1]).toEqual(["indicacoes_gerar_link", { p_item_id: ID }]);
  });

  it("enviarContato manda nulo nos opcionais ausentes e devolve as linhas o_*", async () => {
    const linhas = [
      { o_pedido_id: ID, o_whatsapp_responsavel: "+5551999990000", o_repetido: false },
    ];
    const { cliente, chamadas } = falso({ data: linhas });
    const r = await criarBancoIndicacoes(cliente).enviarContato({
      perfilId: ID,
      itemId: null,
      nome: "Carla",
      whatsapp: "+5511987654321",
      chave: "chave-de-teste-0123456789",
      email: null,
      mensagem: null,
      codigo: null,
    });
    expect(r.dados).toEqual(linhas);
    expect(chamadas.rpc[0]).toEqual([
      "indicacoes_enviar_contato",
      {
        p_perfil_id: ID,
        p_item_id: null,
        p_nome: "Carla",
        p_whatsapp: "+5511987654321",
        p_chave: "chave-de-teste-0123456789",
        p_email: null,
        p_mensagem: null,
        p_codigo: null,
      },
    ]);
  });

  it("chama cada RPC com os parâmetros certos", async () => {
    const { cliente, chamadas } = falso();
    const banco = criarBancoIndicacoes(cliente);
    await banco.registrarCompartilhamento({ codigo: "c".repeat(32), canal: "copiar" });
    await banco.solicitarReenvio({ pedidoId: ID, motivo: null });
    await banco.solicitarReenvio({ pedidoId: ID, motivo: "Corrigi o e-mail" });
    await banco.tratarAlerta({ pedidoId: ID, motivo: "Resolvido" });
    await banco.definirParametro({ chave: "contato_limite_por_hora", valor: 8, motivo: "Teste" });
    expect(chamadas.rpc).toEqual([
      ["indicacoes_registrar_compartilhamento", { p_codigo: "c".repeat(32), p_canal: "copiar" }],
      ["indicacoes_solicitar_reenvio", { p_pedido_id: ID }],
      ["indicacoes_solicitar_reenvio", { p_pedido_id: ID, p_motivo: "Corrigi o e-mail" }],
      ["indicacoes_tratar_alerta", { p_pedido_id: ID, p_motivo: "Resolvido" }],
      [
        "indicacoes_definir_parametro",
        { p_chave: "contato_limite_por_hora", p_valor: 8, p_motivo: "Teste" },
      ],
    ]);
  });

  it("erro do banco vira ErroBanco com o código; exceção de rede vira erro genérico sem texto", async () => {
    const comErro = falso({ error: { code: "P0403", message: "x", details: "y" } });
    const r = await criarBancoIndicacoes(comErro.cliente).gerarLink({ perfilId: ID, itemId: null });
    expect(r.erro).toMatchObject({ code: "P0403" });

    const queda = falso({}, true);
    const banco = criarBancoIndicacoes(queda.cliente);
    const a = await banco.listarMeusPedidos();
    const b = await banco.tratarAlerta({ pedidoId: ID, motivo: "x" });
    const c = await banco.enviarContato({
      perfilId: ID,
      itemId: null,
      nome: "Carla",
      whatsapp: "+5511987654321",
      chave: "chave-de-teste-0123456789",
      email: null,
      mensagem: null,
      codigo: null,
    });
    for (const e of [a.erro, b.erro, c.erro]) {
      expect(e).toEqual({ code: "XX000" });
      expect(JSON.stringify(e)).not.toContain("segredo-interno");
    }
  });
});

describe("adaptador do banco de notificações (cliente de serviço do servidor)", () => {
  it("chama só as duas funções reservadas ao servidor", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoNotificacoes(cliente);
    await banco.listarPendentes(20);
    await banco.registrar({
      pedidoId: ID,
      sucesso: false,
      erro: "provedor de e-mail não configurado",
    });
    await banco.registrar({ pedidoId: ID, sucesso: true, erro: null });
    expect(chamadas.rpc).toEqual([
      ["indicacoes_notificacoes_pendentes", { p_limite: 20 }],
      [
        "indicacoes_notificacao_registrar",
        { p_pedido_id: ID, p_sucesso: false, p_erro: "provedor de e-mail não configurado" },
      ],
      ["indicacoes_notificacao_registrar", { p_pedido_id: ID, p_sucesso: true }],
    ]);
    expect(chamadas.selects).toEqual([]);
  });

  it("falha de rede vira erro genérico", async () => {
    const banco = criarBancoNotificacoes(falso({}, true).cliente);
    expect((await banco.listarPendentes(5)).erro).toEqual({ code: "XX000" });
    expect((await banco.registrar({ pedidoId: ID, sucesso: true, erro: null })).erro).toEqual({
      code: "XX000",
    });
  });
});
