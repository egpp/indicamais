import { describe, expect, it, vi } from "vitest";
import {
  MENSAGENS_CICLO_CONTA,
  criarServicoCicloVidaConta,
  paraEstadoDaConta,
  type ClienteBancoCicloVidaConta,
} from "./index";

const ate = "2026-11-29T12:00:00Z";
const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const erro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "SEGREDO interno tabela contas_ciclo_vida" },
});

function fake(sobrescrever: Partial<ClienteBancoCicloVidaConta> = {}) {
  const banco = {
    lerMeuEstado: vi.fn(
      ok([
        {
          o_situacao: "ativa",
          o_acesso_permitido: true,
          o_encerramento_executar_apos: null as never,
        },
      ]),
    ),
    solicitarEncerramento: vi.fn(ok(ate)),
    cancelarEncerramento: vi.fn(async () => ({ erro: null })),
    ...sobrescrever,
  } satisfies ClienteBancoCicloVidaConta;
  return { banco, servico: criarServicoCicloVidaConta(banco) };
}

describe("estado da conta (IM-080)", () => {
  it("ativa com acesso", async () => {
    const r = await fake().servico.obterMeuEstado();
    expect(r).toEqual({
      ok: true,
      valor: { situacao: "ativa", acessoPermitido: true, encerramentoExecutarApos: null },
    });
  });

  it("suspensa e anonimizada: acesso NEGADO mesmo que a flag venha verdadeira (falha fechado)", () => {
    for (const s of ["suspensa", "anonimizada"]) {
      expect(
        paraEstadoDaConta({
          o_situacao: s,
          o_acesso_permitido: true,
          o_encerramento_executar_apos: null as never,
        })?.acessoPermitido,
      ).toBe(false);
    }
  });

  it("em carência: entra, e mostra o fim da carência", () => {
    const e = paraEstadoDaConta({
      o_situacao: "encerramento_solicitado",
      o_acesso_permitido: true,
      o_encerramento_executar_apos: ate,
    });
    expect(e).toEqual({
      situacao: "encerramento_solicitado",
      acessoPermitido: true,
      encerramentoExecutarApos: ate,
    });
  });

  it("anônimo (zero linhas) = null; situação desconhecida = null (nunca vira ativa)", async () => {
    expect(await fake({ lerMeuEstado: ok([]) }).servico.obterMeuEstado()).toEqual({
      ok: true,
      valor: null,
    });
    expect(
      paraEstadoDaConta({
        o_situacao: "outra",
        o_acesso_permitido: true,
        o_encerramento_executar_apos: null as never,
      }),
    ).toBeNull();
  });

  it("falha do banco não vira 'ativa'", async () => {
    const r = await fake({ lerMeuEstado: erro("XX000") }).servico.obterMeuEstado();
    expect(r.ok).toBe(false);
    const lanca = await fake({
      lerMeuEstado: async () => {
        throw new Error("rede");
      },
    }).servico.obterMeuEstado();
    expect(lanca.ok).toBe(false);
  });
});

describe("solicitar encerramento (IM-081)", () => {
  it("palavra ENCERRAR (sem diferenciar caixa e espaços) devolve o fim da carência", async () => {
    const { servico, banco } = fake();
    const r = await servico.solicitarEncerramento({ confirmacao: "  encerrar " });
    expect(r).toEqual({ ok: true, valor: { executarApos: ate } });
    expect(banco.solicitarEncerramento).toHaveBeenCalledWith({ confirmacao: "encerrar" });
  });

  it.each(["", "ENCERRA", "sim", "ENCERRAR conta", undefined, null, 5])(
    "palavra errada (%s): recusa e NÃO chama o banco",
    async (confirmacao) => {
      const { servico, banco } = fake();
      const r = await servico.solicitarEncerramento({ confirmacao });
      expect(!r.ok && r.erro.codigo).toBe("CONFIRMACAO_INVALIDA");
      expect(!r.ok && r.erro.mensagem).toBe(MENSAGENS_CICLO_CONTA.confirmacaoInvalida);
      expect(banco.solicitarEncerramento).not.toHaveBeenCalled();
    },
  );

  it("sem login (42501), administrador geral (P0001), 22023 e erro interno: mensagens do módulo", async () => {
    const e = { confirmacao: "ENCERRAR" };
    const a = await fake({ solicitarEncerramento: erro("42501") }).servico.solicitarEncerramento(e);
    expect(!a.ok && a.erro.codigo).toBe("NAO_AUTENTICADO");
    const b = await fake({ solicitarEncerramento: erro("P0001") }).servico.solicitarEncerramento(e);
    expect(!b.ok && b.erro.mensagem).toBe(MENSAGENS_CICLO_CONTA.adminGeral);
    const c = await fake({ solicitarEncerramento: erro("22023") }).servico.solicitarEncerramento(e);
    expect(!c.ok && c.erro.codigo).toBe("CONFIRMACAO_INVALIDA");
    const d = await fake({ solicitarEncerramento: erro("XX000") }).servico.solicitarEncerramento(e);
    expect(d.ok).toBe(false);
    for (const r of [a, b, c, d])
      expect(JSON.stringify(r)).not.toMatch(/SEGREDO|contas_ciclo_vida/);
  });

  it("resposta sem data é erro interno, não sucesso", async () => {
    const r = await fake({
      solicitarEncerramento: ok(null as never),
    }).servico.solicitarEncerramento({ confirmacao: "ENCERRAR" });
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
  });
});

describe("cancelar encerramento (IM-081)", () => {
  it("cancela dentro da carência", async () => {
    expect(await fake().servico.cancelarEncerramento()).toEqual({ ok: true, valor: null });
  });

  it("sem encerramento solicitado (P0001) e sem login (42501)", async () => {
    const a = await fake({
      cancelarEncerramento: async () => ({ erro: { code: "P0001" } }),
    }).servico.cancelarEncerramento();
    expect(!a.ok && a.erro.mensagem).toBe(MENSAGENS_CICLO_CONTA.semEncerramento);
    const b = await fake({
      cancelarEncerramento: async () => ({ erro: { code: "42501" } }),
    }).servico.cancelarEncerramento();
    expect(!b.ok && b.erro.codigo).toBe("NAO_AUTENTICADO");
  });
});
