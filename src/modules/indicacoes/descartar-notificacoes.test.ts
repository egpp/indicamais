import { describe, expect, it, vi } from "vitest";
import {
  criarServicoIndicacoes,
  MENSAGENS_INDICACOES,
  type ClienteBancoIndicacoes,
  type LinhaNotificacaoDescartavel,
} from "./index";

/** Descarte em lote de notificações de contato (IM-103, IM-027, IM-028, IM-086). */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const MOTIVO = "Notificações de teste do ambiente";
const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const erroDb = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "relation secreta.tabela_interna violates x", details: "linha 7" },
});
const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

type Fake = Espioes;
type Espioes = {
  descartarNotificacoes: ReturnType<typeof vi.fn>;
  listarNotificacoesDescartaveis: ReturnType<typeof vi.fn>;
};
function fake(sobrescrever: Partial<ClienteBancoIndicacoes> = {}) {
  const base = {
    descartarNotificacoes: ok(2),
    listarNotificacoesDescartaveis: ok({ linhas: [], total: 0 }),
    ...sobrescrever,
  };
  return {
    descartarNotificacoes: vi.fn(base.descartarNotificacoes),
    listarNotificacoesDescartaveis: vi.fn(base.listarNotificacoesDescartaveis),
  } as unknown as Fake;
}
const servico = (b: Fake = fake()) =>
  criarServicoIndicacoes(b as unknown as ClienteBancoIndicacoes, {
    urlBase: "https://exemplo.com.br",
  });
const descartar = (b: Fake, entrada: unknown) => servico(b).descartarNotificacoes(entrada);

describe("descartarNotificacoes", () => {
  it("chama a RPC com ids únicos e motivo aparado; devolve a contagem do banco", async () => {
    const b = fake();
    const r = await descartar(b, { pedidoIds: [A, B, A], motivo: `  ${MOTIVO}  ` });
    expect(r).toEqual({ ok: true, valor: { descartadas: 2 } });
    expect(b.descartarNotificacoes).toHaveBeenCalledWith({ pedidoIds: [A, B], motivo: MOTIVO });
  });

  it("contagem 0 (já enviadas ou descartadas) é sucesso com zero", async () => {
    const b = fake({ descartarNotificacoes: ok(0) });
    expect(await descartar(b, { pedidoIds: [A], motivo: MOTIVO })).toEqual({
      ok: true,
      valor: { descartadas: 0 },
    });
  });

  it.each([
    ["motivo curto", { pedidoIds: [A], motivo: "curto" }],
    ["motivo só com espaços", { pedidoIds: [A], motivo: "          " }],
    ["motivo com 9 caracteres após o trim", { pedidoIds: [A], motivo: "  123456789  " }],
    ["motivo acima de 500", { pedidoIds: [A], motivo: "x".repeat(501) }],
    ["lista vazia", { pedidoIds: [], motivo: MOTIVO }],
    ["mais de 500 ids", { pedidoIds: ids(501), motivo: MOTIVO }],
    ["id que não é uuid", { pedidoIds: ["abc"], motivo: MOTIVO }],
    ["sem lista", { motivo: MOTIVO }],
    ["entrada nula", null],
  ])("%s: recusa antes de chamar o banco", async (_n, entrada) => {
    const b = fake();
    const r = await descartar(b, entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    expect(b.descartarNotificacoes).not.toHaveBeenCalled();
  });

  it("aceita exatamente 500 ids e motivo de exatamente 10 e 500 caracteres", async () => {
    const b = fake();
    expect((await descartar(b, { pedidoIds: ids(500), motivo: "1234567890" })).ok).toBe(true);
    expect((await descartar(b, { pedidoIds: [A], motivo: "x".repeat(500) })).ok).toBe(true);
  });

  it("22023 vira mensagem em português; 42501 vira sem permissão; sem vazar texto do banco", async () => {
    const r1 = await descartar(fake({ descartarNotificacoes: erroDb("22023") }), {
      pedidoIds: [A],
      motivo: MOTIVO,
    });
    const r2 = await descartar(fake({ descartarNotificacoes: erroDb("42501") }), {
      pedidoIds: [A],
      motivo: MOTIVO,
    });
    expect(r1).toEqual({
      ok: false,
      erro: { codigo: "VALIDACAO", mensagem: MENSAGENS_INDICACOES.descarteDadosInvalidos },
    });
    expect(r2).toEqual({
      ok: false,
      erro: { codigo: "PERMISSAO", mensagem: MENSAGENS_INDICACOES.semPermissao },
    });
    expect(JSON.stringify([r1, r2])).not.toMatch(/secreta|tabela_interna/);
  });

  it.each(["XX000", "P0001", "23505", "57014", undefined])(
    "erro inesperado (%s) vira a mensagem genérica, sem texto do banco",
    async (code) => {
      const b = fake({
        descartarNotificacoes: async () => ({
          dados: null,
          erro: { code, message: "segredo-interno tabela_x", details: "d" },
        }),
      });
      const r = await descartar(b, { pedidoIds: [A], motivo: MOTIVO });
      expect(r).toEqual({
        ok: false,
        erro: { codigo: "ERRO_INTERNO", mensagem: MENSAGENS_INDICACOES.generica },
      });
      expect(JSON.stringify(r)).not.toMatch(/segredo|tabela_x/);
    },
  );

  it("RPC inexistente (migração não aplicada): falha graciosa com aviso próprio", async () => {
    for (const code of ["PGRST202", "42883"]) {
      const r = await descartar(fake({ descartarNotificacoes: erroDb(code) }), {
        pedidoIds: [A],
        motivo: MOTIVO,
      });
      expect(r).toEqual({
        ok: false,
        erro: { codigo: "INDISPONIVEL", mensagem: MENSAGENS_INDICACOES.descarteIndisponivel },
      });
      expect(JSON.stringify(r)).not.toMatch(/secreta|tabela_interna/);
    }
  });

  it("exceção do banco não escapa; contagem inválida do banco vira erro genérico", async () => {
    const lanca = fake({
      descartarNotificacoes: async () => {
        throw new Error("rede: segredo");
      },
    });
    const r = await descartar(lanca, { pedidoIds: [A], motivo: MOTIVO });
    expect(r).toMatchObject({ ok: false, erro: { codigo: "ERRO_INTERNO" } });
    expect(JSON.stringify(r)).not.toMatch(/segredo/);
    const estranha = fake({ descartarNotificacoes: ok(-1) });
    expect((await descartar(estranha, { pedidoIds: [A], motivo: MOTIVO })).ok).toBe(false);
  });
});

const linha = (o: Partial<LinhaNotificacaoDescartavel> = {}): LinhaNotificacaoDescartavel => ({
  id: A,
  criado_em: "2026-11-09T15:00:00Z",
  notificacao_estado: "falhou",
  tentativas: 3,
  destino_nome: "Padaria da Ana",
  ...o,
});

describe("listarNotificacoesDescartaveis", () => {
  it("pagina de 50 em 50, filtra por estado e mapeia só campos seguros", async () => {
    const suja = {
      ...linha(),
      nome: "Carla",
      whatsapp_e164: "+5511999999999",
      email: "c@x.com",
      mensagem: "recado privado",
    };
    const b = fake({
      listarNotificacoesDescartaveis: ok({
        linhas: [suja, linha({ notificacao_estado: "pendente", tentativas: null, id: B })],
        total: 120,
      }),
    });
    const r = await servico(b).listarNotificacoesDescartaveis({ estado: "falhou", pagina: 3 });
    expect(b.listarNotificacoesDescartaveis).toHaveBeenCalledWith({
      estado: "falhou",
      limite: 50,
      deslocamento: 100,
    });
    expect(r.ok && r.valor.total).toBe(120);
    expect(r.ok && r.valor.itens).toEqual([
      {
        id: A,
        criadoEm: "2026-11-09T15:00:00Z",
        estado: "falhou",
        tentativas: 3,
        destinoNome: "Padaria da Ana",
      },
      {
        id: B,
        criadoEm: "2026-11-09T15:00:00Z",
        estado: "pendente",
        tentativas: 0,
        destinoNome: "Padaria da Ana",
      },
    ]);
    expect(JSON.stringify(r)).not.toMatch(/Carla|5511999|c@x\.com|recado privado/);
  });

  it("ignora linhas de enviada/descartada, que não podem ser escolhidas", async () => {
    const b = fake({
      listarNotificacoesDescartaveis: ok({
        linhas: [
          linha({ notificacao_estado: "enviada" }),
          linha({ notificacao_estado: "descartada" }),
        ],
        total: 2,
      }),
    });
    const r = await servico(b).listarNotificacoesDescartaveis();
    expect(r.ok && r.valor.itens).toEqual([]);
  });

  it("lista vazia, estado inválido e página inválida", async () => {
    const b = fake();
    const vazio = await servico(b).listarNotificacoesDescartaveis({});
    expect(vazio).toMatchObject({
      ok: true,
      valor: { itens: [], total: 0, pagina: 1, porPagina: 50 },
    });
    expect(b.listarNotificacoesDescartaveis).toHaveBeenCalledWith({
      estado: null,
      limite: 50,
      deslocamento: 0,
    });
    expect((await servico(b).listarNotificacoesDescartaveis({ estado: "enviada" })).ok).toBe(false);
    expect((await servico(b).listarNotificacoesDescartaveis({ pagina: 0 })).ok).toBe(false);
    expect(b.listarNotificacoesDescartaveis).toHaveBeenCalledTimes(1);
  });

  it("erro do banco vira mensagem do módulo, sem vazar", async () => {
    const r = await servico(
      fake({ listarNotificacoesDescartaveis: erroDb("42501") }),
    ).listarNotificacoesDescartaveis();
    expect(r).toMatchObject({ ok: false, erro: { codigo: "PERMISSAO" } });
    expect(JSON.stringify(r)).not.toMatch(/secreta/);
    const x = await servico(
      fake({ listarNotificacoesDescartaveis: erroDb("XX000") }),
    ).listarNotificacoesDescartaveis();
    expect(x).toMatchObject({ ok: false, erro: { codigo: "ERRO_INTERNO" } });
  });
});
