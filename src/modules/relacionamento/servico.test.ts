import { describe, expect, it, vi } from "vitest";
import {
  criarServicoRelacionamento,
  MENSAGENS_RELACIONAMENTO,
  type ClienteBancoRelacionamento,
  type LinhaMeuMembro,
  type LinhaMinhaParticipacao,
} from "./index";

const PERFIL = "11111111-1111-4111-8111-111111111111";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const comErro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco: segredo" },
});

function fake(sobrescrever: Partial<ClienteBancoRelacionamento> = {}) {
  const banco = {
    curtir: vi.fn(ok(true)),
    descurtir: vi.fn(ok(true)),
    sairDaBase: vi.fn(ok(true)),
    listarMeusMembros: vi.fn(ok<LinhaMeuMembro[]>([])),
    lerMeuResumo: vi.fn(ok([])),
    listarMinhasParticipacoes: vi.fn(ok<LinhaMinhaParticipacao[]>([])),
    ...sobrescrever,
  };
  return { banco, servico: criarServicoRelacionamento(banco as ClienteBancoRelacionamento) };
}

describe("curtir, descurtir e sair da base (IM-043, IM-045)", () => {
  it("curtir chama o banco com o perfil validado e informa que alterou", async () => {
    const { banco, servico } = fake();
    const r = await servico.curtir({ perfilId: PERFIL });
    expect(r).toEqual({ ok: true, valor: { alterou: true } });
    expect(banco.curtir).toHaveBeenCalledWith({ perfilId: PERFIL });
  });

  it("repetir é idempotente: false do banco vira alterou: false, sem erro", async () => {
    const { servico } = fake({ curtir: ok(false) });
    expect(await servico.curtir({ perfilId: PERFIL })).toEqual({
      ok: true,
      valor: { alterou: false },
    });
  });

  it("descurtir e sair da base usam suas próprias RPCs", async () => {
    const { banco, servico } = fake();
    await servico.descurtir({ perfilId: PERFIL });
    await servico.sairDaBase({ perfilId: PERFIL });
    expect(banco.descurtir).toHaveBeenCalledTimes(1);
    expect(banco.sairDaBase).toHaveBeenCalledTimes(1);
    expect(banco.curtir).not.toHaveBeenCalled();
  });

  it("rejeita entrada inválida sem tocar no banco", async () => {
    const { banco, servico } = fake();
    for (const entrada of [null, {}, { perfilId: "abc" }, { perfilId: 5 }]) {
      const r = await servico.curtir(entrada);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    }
    expect(banco.curtir).not.toHaveBeenCalled();
  });

  it("sem login (42501) devolve mensagem neutra", async () => {
    const { servico } = fake({ curtir: comErro("42501") });
    const r = await servico.curtir({ perfilId: PERFIL });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "NAO_AUTENTICADO", mensagem: MENSAGENS_RELACIONAMENTO.semLogin },
    });
  });

  it("perfil indisponível (P0002), próprio perfil (P0403) e limite (P0429)", async () => {
    const casos: [string, string][] = [
      ["P0002", "INDISPONIVEL"],
      ["P0403", "PROPRIO_PERFIL"],
      ["P0429", "LIMITE"],
    ];
    for (const [code, codigo] of casos) {
      const { servico } = fake({ curtir: comErro(code) });
      const r = await servico.curtir({ perfilId: PERFIL });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe(codigo);
    }
  });

  it("limite excedido não altera nada além do erro e a mensagem não vaza texto do banco", async () => {
    const { servico } = fake({ descurtir: comErro("P0429") });
    const r = await servico.descurtir({ perfilId: PERFIL });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "LIMITE", mensagem: MENSAGENS_RELACIONAMENTO.limite },
    });
    expect(JSON.stringify(r)).not.toContain("segredo");
  });

  it("erro desconhecido ou exceção viram erro genérico", async () => {
    const a = fake({ sairDaBase: comErro("XX000") });
    expect((await a.servico.sairDaBase({ perfilId: PERFIL })).ok).toBe(false);
    const b = fake({
      sairDaBase: async () => {
        throw new Error("segredo");
      },
    });
    const r = await b.servico.sairDaBase({ perfilId: PERFIL });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "ERRO_INTERNO", mensagem: MENSAGENS_RELACIONAMENTO.generica },
    });
  });

  it("perfil alheio: o banco responde P0002 (neutro) e nada é exposto", async () => {
    const { servico } = fake({ descurtir: comErro("P0002") });
    const r = await servico.descurtir({ perfilId: PERFIL });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.mensagem).toBe(MENSAGENS_RELACIONAMENTO.perfilIndisponivel);
  });
});

const membro = (o: Partial<LinhaMeuMembro> = {}): LinhaMeuMembro => ({
  id: "m1",
  perfil_id: PERFIL,
  perfil_nome: "Padaria Boa",
  pessoa_nome: "Maria S.",
  curtiu: true,
  curtida_em: "2026-10-30T10:00:00Z",
  indicou: false,
  primeira_indicacao_em: null,
  ultima_indicacao_em: null,
  indicacoes_validas: 0,
  interacoes: 1,
  entrou_em: "2026-10-30T10:00:00Z",
  ...o,
});

describe("leitura do responsável (IM-039, IM-041)", () => {
  it("lista membros mais recentes primeiro e usa 'Pessoa' sem nome", async () => {
    const { servico } = fake({
      listarMeusMembros: ok([
        membro({ id: "a", entrou_em: "2026-10-01T00:00:00Z" }),
        membro({ id: "b", entrou_em: "2026-10-20T00:00:00Z", pessoa_nome: null }),
      ]),
    });
    const r = await servico.listarMembros();
    expect(r.ok && r.valor.map((m) => [m.id, m.pessoaNome])).toEqual([
      ["b", "Pessoa"],
      ["a", "Maria S."],
    ]);
  });

  it("o modelo não tem conta_id, WhatsApp, e-mail nem nome completo, mesmo se a linha trouxer", async () => {
    const suja = {
      ...membro(),
      conta_id: "conta-secreta",
      whatsapp_e164: "+5511999999999",
      email: "x@y.com",
      nome_exibicao: "Maria Souza Silva",
    } as LinhaMeuMembro;
    const { servico } = fake({ listarMeusMembros: ok([suja]) });
    const r = await servico.listarMembros();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.valor[0]!).sort()).toEqual(
        [
          "curtidaEm",
          "curtiu",
          "entrouEm",
          "id",
          "indicacoesValidas",
          "indicou",
          "interacoes",
          "perfilId",
          "perfilNome",
          "pessoaNome",
          "primeiraIndicacaoEm",
          "ultimaIndicacaoEm",
        ].sort(),
      );
      const texto = JSON.stringify(r.valor);
      for (const proibido of ["conta-secreta", "+5511", "x@y.com", "Maria Souza Silva"]) {
        expect(texto).not.toContain(proibido);
      }
    }
  });

  it("descarta linhas incompletas e trata contagens nulas como zero", async () => {
    const { servico } = fake({
      listarMeusMembros: ok([
        membro({ id: null }),
        membro({ id: "ok", interacoes: null, indicacoes_validas: null }),
      ]),
    });
    const r = await servico.listarMembros();
    expect(r.ok && r.valor).toHaveLength(1);
    expect(r.ok && r.valor[0]!.interacoes).toBe(0);
  });

  it("resumo mapeia totais por perfil, inclusive saídas", async () => {
    const { servico } = fake({
      lerMeuResumo: ok([
        {
          perfil_id: PERFIL,
          perfil_nome: "Padaria Boa",
          membros: 3,
          curtidas_ativas: 2,
          indicadores: 1,
          interacoes: 4,
          saidas: 5,
        },
        { perfil_id: null } as never,
      ]),
    });
    const r = await servico.resumo();
    expect(r).toEqual({
      ok: true,
      valor: [
        {
          perfilId: PERFIL,
          perfilNome: "Padaria Boa",
          membros: 3,
          curtidasAtivas: 2,
          indicadores: 1,
          interacoes: 4,
          saidas: 5,
        },
      ],
    });
  });

  it("sem login a leitura devolve erro neutro", async () => {
    const { servico } = fake({ listarMeusMembros: comErro("42501") });
    const r = await servico.listarMembros();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("NAO_AUTENTICADO");
  });
});

describe("participações da pessoa (IM-043, IM-045)", () => {
  it("mapeia as bases da pessoa", async () => {
    const { servico } = fake({
      listarMinhasParticipacoes: ok<LinhaMinhaParticipacao[]>([
        {
          perfil_id: PERFIL,
          perfil_slug: "padaria-boa",
          perfil_nome: "Padaria Boa",
          curtiu: true,
          curtida_em: "2026-10-30T10:00:00Z",
          indicou: true,
          indicacoes_validas: 2,
          entrou_em: "2026-10-30T10:00:00Z",
        },
      ]),
    });
    const r = await servico.minhasParticipacoes();
    expect(r.ok && r.valor[0]).toMatchObject({
      perfilSlug: "padaria-boa",
      curtiu: true,
      indicacoesValidas: 2,
    });
  });
});
