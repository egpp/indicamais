import { describe, expect, it, vi } from "vitest";
import {
  MENSAGENS_CICLO,
  criarServicoCicloVida,
  mapearErroBancoCiclo,
  type ClienteBancoCicloVida,
  type OperacaoCiclo,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ORIGEM = "a".repeat(64);

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const semErro = async () => ({ erro: null });
const erroBanco = (code: string, message = "texto interno do banco: tabela x, uuid 123") => ({
  code,
  message,
});
const comErro = (code: string, message?: string) => async () => ({
  dados: null,
  erro: erroBanco(code, message),
});
const comErroSimples = (code: string, message?: string) => async () => ({
  erro: erroBanco(code, message),
});

function fake(sobrescrever: Partial<ClienteBancoCicloVida> = {}) {
  const banco = {
    listarMinhasPermissoes: vi.fn(ok([])),
    listarPermissoesConcedidas: vi.fn(ok([])),
    concederPermissao: vi.fn(semErro),
    revogarPermissao: vi.fn(semErro),
    denunciar: vi.fn(semErro),
    listarFilaDenuncias: vi.fn(ok([])),
    listarDecisoesDenuncia: vi.fn(ok([])),
    decidirDenuncia: vi.fn(semErro),
    suspenderConta: vi.fn(semErro),
    reativarConta: vi.fn(semErro),
    listarContasCicloVida: vi.fn(ok([])),
    invalidarIndicacao: vi.fn(ok<string | null>(ID2)),
    listarIndicacoesInvalidadas: vi.fn(ok([])),
    ...sobrescrever,
  } satisfies ClienteBancoCicloVida;
  return { banco, servico: criarServicoCicloVida(banco) };
}

describe("permissões (IM-077)", () => {
  it("lista as minhas: só permissões válidas, sem repetição, em ordem estável", async () => {
    const { servico } = fake({
      listarMinhasPermissoes: ok([
        { permissao: "suspender", criado_em: "2026-10-30T10:00:00Z" },
        { permissao: "aprovar", criado_em: "2026-10-30T10:00:00Z" },
        { permissao: "aprovar", criado_em: "2026-10-30T10:00:00Z" },
        { permissao: "inventada", criado_em: "2026-10-30T10:00:00Z" },
        { permissao: null, criado_em: null },
      ]),
    });
    const r = await servico.listarMinhasPermissoes();
    expect(r).toEqual({ ok: true, valor: ["aprovar", "suspender"] });
  });

  it("sem permissão nenhuma: lista vazia (não é erro)", async () => {
    const { servico } = fake();
    expect(await servico.listarMinhasPermissoes()).toEqual({ ok: true, valor: [] });
  });

  it("concedidas: copia só os campos do modelo e ignora linha incompleta", async () => {
    const { servico } = fake({
      listarPermissoesConcedidas: ok([
        {
          conta_id: ID,
          permissao: "suspender",
          concedida_por_ref: "r".repeat(64),
          criado_em: "2026-10-30T10:00:00Z",
          email: "x@y.com",
          telefone: "+5551999999999",
        } as never,
        {
          conta_id: null,
          permissao: "suspender",
          concedida_por_ref: "r",
          criado_em: "2026-10-30T10:00:00Z",
        },
      ]),
    });
    const r = await servico.listarPermissoesConcedidas();
    expect(r.ok && r.valor).toHaveLength(1);
    expect(JSON.stringify(r)).not.toMatch(/email|telefone|5551999/);
  });

  it("conceder: valida e chama o banco com os dados limpos", async () => {
    const { servico, banco } = fake();
    const r = await servico.concederPermissao({
      contaId: ID,
      permissao: "suspender",
      motivo: "  equipe de suporte  ",
    });
    expect(r.ok).toBe(true);
    expect(banco.concederPermissao).toHaveBeenCalledWith({
      contaId: ID,
      permissao: "suspender",
      motivo: "equipe de suporte",
    });
  });

  it.each([
    ["sem motivo", { contaId: ID, permissao: "suspender", motivo: "   " }],
    ["permissão inexistente", { contaId: ID, permissao: "tudo", motivo: "x" }],
    ["conta inválida", { contaId: "abc", permissao: "suspender", motivo: "x" }],
    ["lixo", null],
  ])("conceder/revogar recusa entrada inválida (%s) sem chamar o banco", async (_n, entrada) => {
    const { servico, banco } = fake();
    expect((await servico.concederPermissao(entrada)).ok).toBe(false);
    expect((await servico.revogarPermissao(entrada)).ok).toBe(false);
    expect(banco.concederPermissao).not.toHaveBeenCalled();
    expect(banco.revogarPermissao).not.toHaveBeenCalled();
  });

  it("sem motivo o erro é MOTIVO_OBRIGATORIO", async () => {
    const { servico } = fake();
    const r = await servico.revogarPermissao({ contaId: ID, permissao: "aprovar", motivo: "" });
    expect(!r.ok && r.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
  });

  it("quem não é administrador geral (42501) recebe 'sem permissão'", async () => {
    const { servico } = fake({
      concederPermissao: comErroSimples("42501", "acesso restrito a administradores"),
    });
    const r = await servico.concederPermissao({ contaId: ID, permissao: "aprovar", motivo: "x" });
    expect(!r.ok && r.erro).toEqual({
      codigo: "SEM_PERMISSAO",
      mensagem: MENSAGENS_CICLO.semPermissao,
    });
  });

  it("revogar permissão que não existe (P0002) e conceder a conta inativa (P0001) têm mensagens próprias", async () => {
    const a = await fake({
      revogarPermissao: comErroSimples("P0002", "permissão não encontrada"),
    }).servico.revogarPermissao({ contaId: ID, permissao: "aprovar", motivo: "x" });
    expect(!a.ok && a.erro.mensagem).toBe(MENSAGENS_CICLO.permissaoNaoEncontrada);
    const b = await fake({
      concederPermissao: comErroSimples("P0001", "a conta não está ativa"),
    }).servico.concederPermissao({ contaId: ID, permissao: "aprovar", motivo: "x" });
    expect(!b.ok && b.erro.codigo).toBe("ESTADO_INVALIDO");
  });
});

describe("denunciar (IM-076)", () => {
  const base = { alvoTipo: "perfil", alvoId: ID, tipo: "spam_fraude" };

  it("aceita e devolve a mensagem neutra; origem e texto seguem ao banco", async () => {
    const { servico, banco } = fake();
    const r = await servico.denunciar({
      ...base,
      texto: "  parece golpe ",
      origem: ORIGEM,
      site: "",
    });
    expect(r).toEqual({ ok: true, valor: { mensagem: MENSAGENS_CICLO.denunciaRecebida } });
    expect(banco.denunciar).toHaveBeenCalledWith({
      alvoTipo: "perfil",
      alvoId: ID,
      tipo: "spam_fraude",
      texto: "parece golpe",
      origem: ORIGEM,
      site: null,
    });
  });

  it("anônimo sem texto nem origem também funciona", async () => {
    const { servico, banco } = fake();
    expect((await servico.denunciar(base)).ok).toBe(true);
    expect(banco.denunciar).toHaveBeenCalledWith(
      expect.objectContaining({ texto: null, origem: null }),
    );
  });

  it("campo-armadilha preenchido: responde igual a uma aceita e NÃO chama o banco", async () => {
    const { servico, banco } = fake();
    const robo = await servico.denunciar({ ...base, site: "http://spam.example" });
    const normal = await fake().servico.denunciar(base);
    expect(robo).toEqual(normal);
    expect(banco.denunciar).not.toHaveBeenCalled();
  });

  it("mesma resposta para denúncia nova, repetida e alvo inexistente (o banco descarta em silêncio)", async () => {
    const respostas = await Promise.all(
      [ID, ID, ID2].map((alvoId) => fake().servico.denunciar({ ...base, alvoId })),
    );
    expect(new Set(respostas.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("limite de tentativas (P0429): 'muitas tentativas', sem texto do banco", async () => {
    const { servico } = fake({ denunciar: comErroSimples("P0429", "limite de denúncias SEGREDO") });
    const r = await servico.denunciar(base);
    expect(!r.ok && r.erro.codigo).toBe("LIMITE");
    expect(!r.ok && r.erro.mensagem).toBe(MENSAGENS_CICLO.denunciaLimite);
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
  });

  it("conta suspensa (42501) e erro interno não revelam o motivo: mensagem neutra", async () => {
    for (const code of ["42501", "XX000", "P0002", "P0001"]) {
      const r = await fake({ denunciar: comErroSimples(code) }).servico.denunciar(base);
      expect(!r.ok && r.erro.mensagem).toBe(MENSAGENS_CICLO.denunciaIndisponivel);
    }
  });

  it.each([
    ["alvo_tipo inválido", { ...base, alvoTipo: "usuario" }],
    ["alvo sem uuid", { ...base, alvoId: "123" }],
    ["tipo inválido", { ...base, tipo: "chato" }],
    ["texto longo", { ...base, texto: "x".repeat(501) }],
    ["texto com controle", { ...base, texto: "a\u0000b" }],
    ["origem que não é hash (IP cru)", { ...base, origem: "200.1.2.3" }],
    ["vazio", {}],
  ])("recusa %s sem chamar o banco", async (_n, entrada) => {
    const { servico, banco } = fake();
    const r = await servico.denunciar(entrada);
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(banco.denunciar).not.toHaveBeenCalled();
  });

  it("nenhuma suspensão nem decisão automática: só chama denunciar", async () => {
    const { servico, banco } = fake();
    await servico.denunciar(base);
    expect(banco.suspenderConta).not.toHaveBeenCalled();
    expect(banco.decidirDenuncia).not.toHaveBeenCalled();
  });
});

describe("fila e decisão de denúncias (IM-076)", () => {
  const linha = (o: Record<string, unknown> = {}) => ({
    id: ID,
    alvo_tipo: "perfil",
    alvo_id: ID2,
    tipo: "spam_fraude",
    texto: "golpe",
    situacao: "aberta",
    denunciante_tipo: "anonimo",
    denunciante_ref: "h".repeat(64),
    total_no_alvo: 3,
    alvo_nome: "Loja X",
    criado_em: "2026-10-30T10:00:00Z",
    atualizado_em: "2026-10-30T10:00:00Z",
    ...o,
  });

  it("ordena abertas antes de em análise e antigas antes; sem dado de denunciante além do tipo e da chave", async () => {
    const { servico } = fake({
      listarFilaDenuncias: ok([
        linha({ id: "a1", situacao: "em_analise", criado_em: "2026-10-01T00:00:00Z" }),
        linha({ id: "b2", criado_em: "2026-10-20T00:00:00Z" }),
        linha({
          id: "c3",
          criado_em: "2026-10-10T00:00:00Z",
          denunciante_tipo: "conta",
          denunciante_id: ID,
          email: "a@b.c",
        }),
        linha({ id: "d4", situacao: "estranha" }),
      ] as never),
    });
    const r = await servico.listarFilaDenuncias();
    expect(r.ok && r.valor.map((d) => d.id)).toEqual(["c3", "b2", "a1"]);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/denunciante_id|denuncianteId|email|a@b\.c|telefone/);
  });

  it("sem permissão analisar_denuncias o banco devolve zero linhas: fila vazia", async () => {
    const { servico } = fake();
    expect(await servico.listarFilaDenuncias()).toEqual({ ok: true, valor: [] });
  });

  it("decide com os 3 destinos e exige motivo", async () => {
    for (const decisao of ["em_analise", "procedente", "improcedente"]) {
      const { servico, banco } = fake();
      const r = await servico.decidirDenuncia({ denunciaId: ID, decisao, motivo: " ok " });
      expect(r.ok).toBe(true);
      expect(banco.decidirDenuncia).toHaveBeenCalledWith({ denunciaId: ID, decisao, motivo: "ok" });
    }
    const { servico, banco } = fake();
    const sem = await servico.decidirDenuncia({
      denunciaId: ID,
      decisao: "procedente",
      motivo: " ",
    });
    expect(!sem.ok && sem.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    const aberta = await servico.decidirDenuncia({
      denunciaId: ID,
      decisao: "aberta",
      motivo: "x",
    });
    expect(aberta.ok).toBe(false);
    expect(banco.decidirDenuncia).not.toHaveBeenCalled();
  });

  it("decidir denúncia sobre o próprio conteúdo (42501 'próprio') => mensagem própria, não 'sem permissão'", async () => {
    const { servico } = fake({
      decidirDenuncia: comErroSimples(
        "42501",
        "não é possível decidir denúncia sobre o próprio conteúdo",
      ),
    });
    const r = await servico.decidirDenuncia({ denunciaId: ID, decisao: "procedente", motivo: "x" });
    expect(!r.ok && r.erro).toEqual({
      codigo: "AUTO_APROVACAO",
      mensagem: MENSAGENS_CICLO.proprioConteudo,
    });
  });

  it("sem permissão (42501), inexistente (P0002), já decidida (P0001)", async () => {
    const e = { denunciaId: ID, decisao: "procedente", motivo: "x" };
    const a = await fake({
      decidirDenuncia: comErroSimples("42501", "acesso restrito a administradores"),
    }).servico.decidirDenuncia(e);
    expect(!a.ok && a.erro.codigo).toBe("SEM_PERMISSAO");
    const b = await fake({ decidirDenuncia: comErroSimples("P0002") }).servico.decidirDenuncia(e);
    expect(!b.ok && b.erro.mensagem).toBe(MENSAGENS_CICLO.denunciaNaoEncontrada);
    const c = await fake({ decidirDenuncia: comErroSimples("P0001") }).servico.decidirDenuncia(e);
    expect(!c.ok && c.erro.codigo).toBe("JA_DECIDIDA");
  });

  it("decisões: só ref do autor", async () => {
    const { servico } = fake({
      listarDecisoesDenuncia: ok([
        {
          denuncia_id: ID,
          de_situacao: "aberta",
          para_situacao: "procedente",
          motivo: "m",
          autor_ref: "z".repeat(64),
          criado_em: "2026-10-30T10:00:00Z",
        },
      ]),
    });
    const r = await servico.listarDecisoesDenuncia();
    expect(r.ok && r.valor[0]?.autorRef).toBe("z".repeat(64));
  });
});

describe("suspender e reativar (IM-080)", () => {
  it("suspende com motivo e aciona o aplicador de bloqueio; falha dele não desfaz", async () => {
    const aoSuspender = vi.fn(async () => {
      throw new Error("Admin API fora");
    });
    const aoReativar = vi.fn(async () => {});
    const banco = fake().banco;
    const servico = criarServicoCicloVida(banco, {
      aplicadorBloqueio: { aoSuspender, aoReativar },
    });
    expect((await servico.suspenderConta({ contaId: ID, motivo: "fraude confirmada" })).ok).toBe(
      true,
    );
    expect(aoSuspender).toHaveBeenCalledWith(ID);
    expect((await servico.reativarConta({ contaId: ID, motivo: "recurso aceito" })).ok).toBe(true);
    expect(aoReativar).toHaveBeenCalledWith(ID);
  });

  it("recusado pelo banco: o aplicador NÃO é acionado", async () => {
    const aoSuspender = vi.fn(async () => {});
    const servico = criarServicoCicloVida(fake({ suspenderConta: comErroSimples("42501") }).banco, {
      aplicadorBloqueio: { aoSuspender, aoReativar: vi.fn(async () => {}) },
    });
    const r = await servico.suspenderConta({ contaId: ID, motivo: "x" });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    expect(aoSuspender).not.toHaveBeenCalled();
  });

  it("exige motivo e uuid", async () => {
    const { servico, banco } = fake();
    expect((await servico.suspenderConta({ contaId: ID, motivo: "" })).ok).toBe(false);
    expect((await servico.reativarConta({ contaId: "x", motivo: "a" })).ok).toBe(false);
    expect(banco.suspenderConta).not.toHaveBeenCalled();
    expect(banco.reativarConta).not.toHaveBeenCalled();
  });

  it("erros: P0002, conta não suspensa, conta encerrada, conta de administração", async () => {
    const e = { contaId: ID, motivo: "x" };
    const a = await fake({ suspenderConta: comErroSimples("P0002") }).servico.suspenderConta(e);
    expect(!a.ok && a.erro.mensagem).toBe(MENSAGENS_CICLO.contaNaoEncontrada);
    const b = await fake({ reativarConta: comErroSimples("P0001") }).servico.reativarConta(e);
    expect(!b.ok && b.erro.mensagem).toBe(MENSAGENS_CICLO.contaNaoSuspensa);
    const c = await fake({
      suspenderConta: comErroSimples("P0001", "conta já encerrada"),
    }).servico.suspenderConta(e);
    expect(!c.ok && c.erro.mensagem).toBe(MENSAGENS_CICLO.contaEncerrada);
    const d = await fake({
      suspenderConta: comErroSimples("42501", "esta conta não pode ser suspensa por esta função"),
    }).servico.suspenderConta(e);
    expect(!d.ok && d.erro.mensagem).toBe(MENSAGENS_CICLO.contaProtegida);
  });

  it("lista contas fora do normal sem nome, telefone nem e-mail", async () => {
    const { servico } = fake({
      listarContasCicloVida: ok([
        {
          conta_id: ID,
          situacao: "suspensa",
          suspensa_em: "2026-10-30T10:00:00Z",
          encerramento_solicitado_em: null,
          encerramento_executar_apos: null,
          anonimizada_em: null,
          atualizado_em: "2026-10-30T10:00:00Z",
          email: "a@b.c",
          whatsapp_e164: "+5551999999999",
        } as never,
        {
          conta_id: ID2,
          situacao: "ativa",
          suspensa_em: null,
          encerramento_solicitado_em: null,
          encerramento_executar_apos: null,
          anonimizada_em: null,
          atualizado_em: "2026-10-30T10:00:00Z",
        },
      ]),
    });
    const r = await servico.listarContasCicloVida();
    expect(r.ok && r.valor).toHaveLength(1);
    expect(JSON.stringify(r)).not.toMatch(/a@b\.c|5551999|email|whatsapp/);
  });
});

describe("invalidar indicação (IM-077, IM-035, IM-078, IM-042)", () => {
  it("invalida com motivo e devolve o id da reversão (ou null sem crédito)", async () => {
    const a = fake();
    const r = await a.servico.invalidarIndicacao({ pedidoId: ID, motivo: " fraude " });
    expect(r).toEqual({ ok: true, valor: { reversaoId: ID2 } });
    expect(a.banco.invalidarIndicacao).toHaveBeenCalledWith({
      pedidoId: ID,
      motivo: "fraude",
      confirmarSaldoNegativo: false,
    });
    const b = await fake({
      invalidarIndicacao: ok<string | null>(null),
    }).servico.invalidarIndicacao({
      pedidoId: ID,
      motivo: "x",
    });
    expect(b).toEqual({ ok: true, valor: { reversaoId: null } });
  });

  it("P0410: saldo negativo pede confirmação; a repetição confirmada passa", async () => {
    const f = vi.fn().mockImplementationOnce(comErro("P0410")).mockImplementationOnce(ok(ID2));
    const { servico } = fake({ invalidarIndicacao: f });
    const primeira = await servico.invalidarIndicacao({ pedidoId: ID, motivo: "x" });
    expect(!primeira.ok && primeira.erro.codigo).toBe("SALDO_NEGATIVO");
    expect(!primeira.ok && primeira.erro.mensagem).toBe(MENSAGENS_CICLO.saldoNegativo);
    const segunda = await servico.invalidarIndicacao({
      pedidoId: ID,
      motivo: "x",
      confirmarSaldoNegativo: true,
    });
    expect(segunda.ok).toBe(true);
    expect(f).toHaveBeenLastCalledWith(expect.objectContaining({ confirmarSaldoNegativo: true }));
  });

  it("sem motivo não chega ao banco; participante (42501 'participa') e inexistente (P0002)", async () => {
    const { servico, banco } = fake();
    const sem = await servico.invalidarIndicacao({ pedidoId: ID, motivo: "" });
    expect(!sem.ok && sem.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    expect(banco.invalidarIndicacao).not.toHaveBeenCalled();
    const part = await fake({
      invalidarIndicacao: comErro(
        "42501",
        "não é possível invalidar indicação em que a própria conta participa",
      ),
    }).servico.invalidarIndicacao({ pedidoId: ID, motivo: "x" });
    expect(!part.ok && part.erro.codigo).toBe("AUTO_APROVACAO");
    const nao = await fake({ invalidarIndicacao: comErro("P0002") }).servico.invalidarIndicacao({
      pedidoId: ID,
      motivo: "x",
    });
    expect(!nao.ok && nao.erro.mensagem).toBe(MENSAGENS_CICLO.indicacaoNaoEncontrada);
  });

  it("só toca em pontos: não chama nada de suspensão ou denúncia", async () => {
    const { servico, banco } = fake();
    await servico.invalidarIndicacao({ pedidoId: ID, motivo: "x" });
    expect(banco.suspenderConta).not.toHaveBeenCalled();
    expect(banco.decidirDenuncia).not.toHaveBeenCalled();
  });

  it("lista invalidadas: só ref do autor, sem dado do visitante", async () => {
    const { servico } = fake({
      listarIndicacoesInvalidadas: ok([
        {
          pedido_id: ID,
          motivo: "m",
          tem_reversao: true,
          autor_ref: "q".repeat(64),
          criado_em: "2026-10-30T10:00:00Z",
          nome: "Fulano",
          whatsapp: "+55",
        } as never,
      ]),
    });
    const r = await servico.listarIndicacoesInvalidadas();
    expect(r.ok && r.valor[0]).toEqual({
      pedidoId: ID,
      motivo: "m",
      temReversao: true,
      autorRef: "q".repeat(64),
      criadoEm: "2026-10-30T10:00:00Z",
    });
  });
});

describe("mapeamento de erros", () => {
  const ops: OperacaoCiclo[] = [
    "leitura",
    "permissao",
    "denunciar",
    "decidir_denuncia",
    "suspender",
    "reativar",
    "invalidar",
  ];
  it("nunca vaza texto do banco e sempre usa mensagem do módulo", () => {
    for (const code of [
      "42501",
      "22023",
      "P0002",
      "P0001",
      "P0429",
      "P0410",
      "P0412",
      "23505",
      "XX000",
    ]) {
      for (const op of ops) {
        const { mensagem } = mapearErroBancoCiclo(
          erroBanco(code, "SEGREDO tabela administracao_ uuid"),
          op,
        );
        expect(mensagem).not.toMatch(/SEGREDO|administracao_|uuid/);
        expect(Object.values(MENSAGENS_CICLO)).toContain(mensagem);
      }
    }
  });

  it("erro sem código e exceção do banco viram genérico", async () => {
    expect(mapearErroBancoCiclo({ message: "x" }, "invalidar").mensagem).toBe(
      MENSAGENS_CICLO.generica,
    );
    const { servico } = fake({
      listarFilaDenuncias: async () => {
        throw new Error("rede SEGREDO");
      },
    });
    const r = await servico.listarFilaDenuncias();
    expect(!r.ok && r.erro.mensagem).toBe(MENSAGENS_CICLO.generica);
  });
});
