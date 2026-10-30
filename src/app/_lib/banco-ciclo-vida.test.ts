import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLUNAS_CICLO_VIDA,
  criarBancoCicloVida,
  criarBancoCicloVidaConta,
} from "./banco-ciclo-vida";

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
  return { cliente: cliente as unknown as SupabaseClient<never>, chamadas };
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("adaptador do ciclo de vida (sessão do usuário)", () => {
  it("lê as visões certas com colunas nomeadas, sem '*'", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const b = criarBancoCicloVida(cliente as never);
    await b.listarMinhasPermissoes();
    await b.listarPermissoesConcedidas();
    await b.listarFilaDenuncias();
    await b.listarDecisoesDenuncia();
    await b.listarContasCicloVida();
    await b.listarIndicacoesInvalidadas();
    expect(chamadas.selects.map((s) => s[0])).toEqual([
      "administracao_minhas_permissoes",
      "administracao_permissoes_concedidas",
      "administracao_fila_denuncias",
      "administracao_denuncia_decisoes",
      "administracao_contas_ciclo_vida",
      "administracao_indicacoes_invalidadas",
    ]);
    for (const c of Object.values(COLUNAS_CICLO_VIDA)) {
      expect(c).not.toContain("*");
      expect(c).not.toMatch(/email|telefone|whatsapp|denunciante_id|autor_id/);
    }
  });

  it("só as visões de alvo de ação trazem conta_id", () => {
    const comConta = Object.entries(COLUNAS_CICLO_VIDA)
      .filter(([, c]) => c.split(", ").includes("conta_id"))
      .map(([k]) => k);
    expect(comConta.sort()).toEqual(["contasCicloVida", "permissoesConcedidas"]);
  });

  it("chama as RPCs com os parâmetros certos", async () => {
    const { cliente, chamadas } = falso({ data: ID });
    const b = criarBancoCicloVida(cliente as never);
    await b.concederPermissao({ contaId: ID, permissao: "suspender", motivo: "m" });
    await b.revogarPermissao({ contaId: ID, permissao: "suspender", motivo: "m" });
    await b.decidirDenuncia({ denunciaId: ID, decisao: "procedente", motivo: "m" });
    await b.suspenderConta({ contaId: ID, motivo: "m" });
    await b.reativarConta({ contaId: ID, motivo: "m" });
    expect(
      (await b.invalidarIndicacao({ pedidoId: ID, motivo: "m", confirmarSaldoNegativo: true }))
        .dados,
    ).toBe(ID);
    expect(chamadas.rpc).toEqual([
      [
        "administracao_conceder_permissao",
        { p_conta: ID, p_permissao: "suspender", p_motivo: "m" },
      ],
      ["administracao_revogar_permissao", { p_conta: ID, p_permissao: "suspender", p_motivo: "m" }],
      [
        "administracao_decidir_denuncia",
        { p_denuncia_id: ID, p_decisao: "procedente", p_motivo: "m" },
      ],
      ["administracao_suspender_conta", { p_conta: ID, p_motivo: "m" }],
      ["administracao_reativar_conta", { p_conta: ID, p_motivo: "m" }],
      [
        "administracao_invalidar_indicacao",
        { p_pedido_id: ID, p_motivo: "m", p_confirmar_saldo_negativo: true },
      ],
    ]);
  });

  it("denunciar só envia o que existe (sem 'undefined' nem null nos opcionais)", async () => {
    const { cliente, chamadas } = falso();
    const b = criarBancoCicloVida(cliente as never);
    await b.denunciar({
      alvoTipo: "perfil",
      alvoId: ID,
      tipo: "spam_fraude",
      texto: null,
      origem: null,
      site: null,
    });
    expect(chamadas.rpc[0]).toEqual([
      "administracao_denunciar",
      { p_alvo_tipo: "perfil", p_alvo_id: ID, p_tipo: "spam_fraude" },
    ]);
  });

  it("repassa o código do erro e converte exceção em erro desconhecido, sem vazar a mensagem", async () => {
    const e = falso({ error: { code: "P0410", message: "x" } });
    const r = await criarBancoCicloVida(e.cliente as never).invalidarIndicacao({
      pedidoId: ID,
      motivo: "m",
      confirmarSaldoNegativo: false,
    });
    expect(r.erro?.code).toBe("P0410");
    const l = falso({}, true);
    const b = criarBancoCicloVida(l.cliente as never);
    const r2 = await b.suspenderConta({ contaId: ID, motivo: "m" });
    expect(r2.erro).toEqual({ code: "XX000" });
    const r3 = await b.listarFilaDenuncias();
    expect(r3.erro).toEqual({ code: "XX000" });
  });

  it("conta: estado e encerramento chamam as RPCs certas", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const b = criarBancoCicloVidaConta(cliente as never);
    await b.lerMeuEstado();
    await b.solicitarEncerramento({ confirmacao: "ENCERRAR" });
    await b.cancelarEncerramento();
    expect(chamadas.rpc).toEqual([
      ["contas_meu_estado", undefined],
      ["contas_solicitar_encerramento", { p_confirmacao: "ENCERRAR" }],
      ["contas_cancelar_encerramento", undefined],
    ]);
  });
});
