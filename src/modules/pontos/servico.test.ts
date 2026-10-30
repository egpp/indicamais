import { describe, expect, it, vi } from "vitest";
import {
  CATEGORIAS_REVERSAO,
  criarServicoPontos,
  MENSAGENS_PONTOS,
  type ClienteBancoPontos,
  type LinhaAguardandoAceite,
  type LinhaBeneficioPublico,
  type LinhaDecisaoAdmin,
  type LinhaFalhaAdmin,
  type LinhaLancamentoAdmin,
  type LinhaMeuLancamento,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const PEDIDO = "33333333-3333-4333-8333-333333333333";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const semErro = async () => ({ erro: null });
const comErro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco" },
});
const comErroSimples = (code: string) => async () => ({
  erro: { code, message: "texto interno do banco" },
});

function fake(sobrescrever: Partial<ClienteBancoPontos> = {}) {
  const banco = {
    lerMeuSaldo: vi.fn(ok([])),
    listarMeusLancamentos: vi.fn(ok<LinhaMeuLancamento[]>([])),
    lerParametrosAtuais: vi.fn(ok([{ o_pontos_por_indicacao: 10, o_intervalo_dias: 30 }])),
    definirParametro: vi.fn(semErro),
    reverterCredito: vi.fn(ok<string>(ID2)),
    reprocessarPedido: vi.fn(ok<number>(7)),
    listarLancamentosAdmin: vi.fn(ok<LinhaLancamentoAdmin[]>([])),
    listarSaldosAdmin: vi.fn(ok([])),
    listarDecisoesAdmin: vi.fn(ok<LinhaDecisaoAdmin[]>([])),
    listarFalhasAdmin: vi.fn(ok<LinhaFalhaAdmin[]>([])),
    listarBeneficiosPublicos: vi.fn(ok<LinhaBeneficioPublico[]>([])),
    listarBeneficiosDoPerfil: vi.fn(ok({ beneficios: [], versoes: [], revisoes: [] })),
    listarFilaBeneficios: vi.fn(ok([])),
    criarBeneficio: vi.fn(ok([{ o_beneficio_id: ID, o_versao_id: ID2 }])),
    salvarBeneficio: vi.fn(ok<string>(ID2)),
    enviarVersao: vi.fn(semErro),
    definirBeneficioAtivo: vi.fn(semErro),
    decidirVersao: vi.fn(semErro),
    adminCadastrarBeneficio: vi.fn(ok([{ o_beneficio_id: ID, o_versao_id: ID2 }])),
    adminDefinirBeneficioAtivo: vi.fn(semErro),
    listarAguardandoAceite: vi.fn(ok<LinhaAguardandoAceite[]>([])),
    responderProposta: vi.fn(semErro),
    adminEditarProposta: vi.fn(ok<string>(ID2)),
    ...sobrescrever,
  } satisfies ClienteBancoPontos;
  return banco;
}

const AGORA = new Date("2026-11-10T15:00:00Z"); // 10/11/2026 12:00 em São Paulo
const servico = (b = fake()) => criarServicoPontos(b, { agora: () => AGORA });

const lanc = (o: Partial<LinhaMeuLancamento> = {}): LinhaMeuLancamento => ({
  id: ID,
  tipo: "credito",
  pontos: 10,
  situacao: "creditado",
  destino_tipo: "perfil",
  destino_id: ID2,
  destino_nome: "Padaria Boa",
  categoria: null,
  original_id: null,
  criado_em: "2026-11-01T12:00:00Z",
  ...o,
});

const benef = (o: Partial<LinhaBeneficioPublico> = {}): LinhaBeneficioPublico => ({
  id: ID,
  perfil_id: ID2,
  nome: "Café grátis",
  descricao: "Um café",
  pontos_necessarios: 50,
  condicoes: null,
  limite_total: null,
  limite_por_pessoa: null,
  prazo_resgate_ate: null,
  prazo_uso_dias: null,
  criado_em: "2026-11-01T12:00:00Z",
  ...o,
});

const BENEFICIO = {
  nome: "Café grátis",
  descricao: "Um café",
  pontosNecessarios: 50,
};

describe("saldo e lançamentos do indicador (IM-035)", () => {
  it("sem lançamentos o saldo é zero", async () => {
    const r = await servico().meuSaldo();
    expect(r).toEqual({
      ok: true,
      valor: { saldo: 0, totalCreditado: 0, totalRevertido: 0, ultimoLancamentoEm: null },
    });
  });

  it("lê o saldo da visão", async () => {
    const b = fake({
      lerMeuSaldo: vi.fn(
        ok([
          {
            saldo: 20,
            total_creditado: 30,
            total_revertido: -10,
            ultimo_lancamento_em: "2026-11-01T12:00:00Z",
          },
        ]),
      ),
    });
    const r = await servico(b).meuSaldo();
    expect(r).toEqual({
      ok: true,
      valor: {
        saldo: 20,
        totalCreditado: 30,
        totalRevertido: -10,
        ultimoLancamentoEm: "2026-11-01T12:00:00Z",
      },
    });
  });

  it("lista do mais recente ao mais antigo e descarta linha incompleta", async () => {
    const b = fake({
      listarMeusLancamentos: vi.fn(
        ok([
          lanc({ id: ID, criado_em: "2026-11-01T12:00:00Z" }),
          lanc({ id: ID2, criado_em: "2026-11-03T12:00:00Z" }),
          lanc({ id: PEDIDO, tipo: "estranho" }),
          lanc({ id: PEDIDO, destino_id: null }),
        ]),
      ),
    });
    const r = await servico(b).meusLancamentos();
    expect(r.ok && r.valor.map((l) => l.id)).toEqual([ID2, ID]);
  });

  it("o modelo do indicador não tem conta, WhatsApp, pedido nem decisão (IM-029, IM-041)", async () => {
    const b = fake({
      listarMeusLancamentos: vi.fn(
        ok([
          lanc({
            tipo: "reversao",
            pontos: -10,
            situacao: "reversao",
            categoria: "contato_duplicado",
            original_id: PEDIDO,
          }),
        ]),
      ),
    });
    const r = await servico(b).meusLancamentos();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.valor[0]!).sort()).toEqual(
        [
          "categoria",
          "categoriaRotulo",
          "criadoEm",
          "destinoId",
          "destinoNome",
          "destinoTipo",
          "id",
          "originalId",
          "pontos",
          "situacao",
          "tipo",
        ].sort(),
      );
    }
  });

  it("categoria só aparece na reversão, com rótulo; categoria desconhecida ou crédito não expõem nada", async () => {
    const b = fake({
      listarMeusLancamentos: vi.fn(
        ok([
          lanc({ id: "a", categoria: "fraude", criado_em: "2026-11-01T12:00:00Z" }),
          lanc({
            id: "b",
            tipo: "reversao",
            pontos: -10,
            situacao: "reversao",
            categoria: "contato_duplicado",
            criado_em: "2026-11-02T12:00:00Z",
          }),
          lanc({
            id: "c",
            tipo: "reversao",
            pontos: -10,
            situacao: "reversao",
            categoria: "inventada",
            criado_em: "2026-11-03T12:00:00Z",
          }),
        ]),
      ),
    });
    const r = await servico(b).meusLancamentos();
    expect(r.ok && r.valor.map((l) => [l.id, l.categoria, l.categoriaRotulo])).toEqual([
      ["c", null, null],
      ["b", "contato_duplicado", "Contato duplicado"],
      ["a", null, null],
    ]);
  });

  it("erro do banco vira erro neutro sem o texto do banco", async () => {
    const b = fake({ listarMeusLancamentos: vi.fn(comErro("XX000")) });
    const r = await servico(b).meusLancamentos();
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "ERRO_INTERNO", mensagem: MENSAGENS_PONTOS.generica },
    });
  });

  it("exceção do adaptador vira ERRO_INTERNO", async () => {
    const b = fake({
      lerMeuSaldo: vi.fn(async () => {
        throw new Error("segredo");
      }),
    });
    const r = await servico(b).meuSaldo();
    expect(r.ok === false && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});

describe("parâmetros (IM-030, D-012)", () => {
  it("lê os valores vigentes sem fixar nada no código", async () => {
    const b = fake({
      lerParametrosAtuais: vi.fn(ok([{ o_pontos_por_indicacao: 25, o_intervalo_dias: 45 }])),
    });
    expect(await servico(b).parametrosAtuais()).toEqual({
      ok: true,
      valor: { pontosPorIndicacao: 25, intervaloDias: 45 },
    });
  });

  it("sem linha (não autenticado) é permissão negada", async () => {
    const b = fake({ lerParametrosAtuais: vi.fn(ok([])) });
    const r = await servico(b).parametrosAtuais();
    expect(r.ok === false && r.erro.codigo).toBe("PERMISSAO");
  });

  it("define com motivo", async () => {
    const b = fake();
    const r = await servico(b).definirParametro({
      chave: "intervalo_dias",
      valor: 20,
      motivo: "  ajuste  ",
    });
    expect(r.ok).toBe(true);
    expect(b.definirParametro).toHaveBeenCalledWith({
      chave: "intervalo_dias",
      valor: 20,
      motivo: "ajuste",
    });
  });

  it.each([
    ["sem motivo", { chave: "intervalo_dias", valor: 20 }],
    ["motivo em branco", { chave: "intervalo_dias", valor: 20, motivo: "   " }],
    ["chave desconhecida", { chave: "outra", valor: 20, motivo: "x" }],
    ["valor decimal", { chave: "intervalo_dias", valor: 1.5, motivo: "x" }],
    ["valor zero", { chave: "intervalo_dias", valor: 0, motivo: "x" }],
    ["valor como texto", { chave: "intervalo_dias", valor: "20", motivo: "x" }],
  ])("recusa %s sem chamar o banco", async (_n, entrada) => {
    const b = fake();
    const r = await servico(b).definirParametro(entrada);
    expect(r.ok === false && r.erro.codigo).toBe("VALIDACAO");
    expect(b.definirParametro).not.toHaveBeenCalled();
  });

  it("22023 do banco (fora da faixa) vira mensagem de faixa; 42501 vira permissão", async () => {
    const e1 = await servico(
      fake({ definirParametro: vi.fn(comErroSimples("22023")) }),
    ).definirParametro({
      chave: "intervalo_dias",
      valor: 999,
      motivo: "x",
    });
    expect(e1.ok === false && e1.erro.mensagem).toBe(MENSAGENS_PONTOS.valorForaDaFaixa);
    const e2 = await servico(
      fake({ definirParametro: vi.fn(comErroSimples("42501")) }),
    ).definirParametro({
      chave: "intervalo_dias",
      valor: 20,
      motivo: "x",
    });
    expect(e2.ok === false && e2.erro.codigo).toBe("PERMISSAO");
  });
});

describe("reversão de crédito (IM-077, IM-078)", () => {
  it("reverte com categoria e devolve o id da reversão", async () => {
    const b = fake();
    const r = await servico(b).reverterCredito({
      lancamentoId: ID,
      categoria: "contato_duplicado",
      observacao: "  mesmo contato em 2 pedidos ",
    });
    expect(r).toEqual({ ok: true, valor: { reversaoId: ID2 } });
    expect(b.reverterCredito).toHaveBeenCalledWith({
      lancamentoId: ID,
      categoria: "contato_duplicado",
      observacao: "mesmo contato em 2 pedidos",
      confirmarSaldoNegativo: false,
    });
  });

  it.each(CATEGORIAS_REVERSAO)("aceita a categoria %s", async (categoria) => {
    const r = await servico().reverterCredito({ lancamentoId: ID, categoria, observacao: "x" });
    expect(r.ok).toBe(true);
  });

  it.each([
    ["categoria livre", { lancamentoId: ID, categoria: "porque sim", observacao: "x" }],
    ["sem categoria", { lancamentoId: ID, observacao: "x" }],
    ["sem observação interna", { lancamentoId: ID, categoria: "fraude" }],
    ["observação em branco", { lancamentoId: ID, categoria: "fraude", observacao: "   " }],
    ["id inválido", { lancamentoId: "1", categoria: "fraude", observacao: "x" }],
    [
      "confirmação não booleana",
      { lancamentoId: ID, categoria: "fraude", observacao: "x", confirmarSaldoNegativo: "sim" },
    ],
    ["observação longa", { lancamentoId: ID, categoria: "outro", observacao: "a".repeat(501) }],
  ])("recusa %s sem chamar o banco", async (_n, entrada) => {
    const b = fake();
    const r = await servico(b).reverterCredito(entrada);
    expect(r.ok === false && r.erro.codigo).toBe("VALIDACAO");
    expect(b.reverterCredito).not.toHaveBeenCalled();
  });

  it("P0409 vira JA_REVERTIDO", async () => {
    const r = await servico(fake({ reverterCredito: vi.fn(comErro("P0409")) })).reverterCredito({
      lancamentoId: ID,
      categoria: "fraude",
      observacao: "x",
    });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "JA_REVERTIDO", mensagem: MENSAGENS_PONTOS.jaRevertido },
    });
  });

  it("P0410 pede confirmação e a repetição confirmada passa", async () => {
    const reverter = vi
      .fn()
      .mockImplementationOnce(comErro("P0410"))
      .mockImplementationOnce(ok(ID2));
    const s = servico(fake({ reverterCredito: reverter }));
    const primeira = await s.reverterCredito({
      lancamentoId: ID,
      categoria: "fraude",
      observacao: "x",
    });
    expect(primeira.ok === false && primeira.erro.codigo).toBe("SALDO_NEGATIVO");
    const segunda = await s.reverterCredito({
      lancamentoId: ID,
      categoria: "fraude",
      observacao: "x",
      confirmarSaldoNegativo: true,
    });
    expect(segunda.ok).toBe(true);
    expect(reverter.mock.calls[1]![0].confirmarSaldoNegativo).toBe(true);
  });

  it("P0001 (não é crédito), P0002 e 42501 têm mensagens próprias", async () => {
    const chamar = (code: string) =>
      servico(fake({ reverterCredito: vi.fn(comErro(code)) })).reverterCredito({
        lancamentoId: ID,
        categoria: "outro",
        observacao: "x",
      });
    const a = await chamar("P0001");
    const b = await chamar("P0002");
    const c = await chamar("42501");
    expect(a.ok === false && a.erro.codigo).toBe("ESTADO_INVALIDO");
    expect(b.ok === false && b.erro.codigo).toBe("NAO_ENCONTRADO");
    expect(c.ok === false && c.erro.codigo).toBe("PERMISSAO");
  });

  it("nunca inclui texto do banco no erro", async () => {
    const r = await servico(fake({ reverterCredito: vi.fn(comErro("XX999")) })).reverterCredito({
      lancamentoId: ID,
      categoria: "outro",
      observacao: "x",
    });
    expect(JSON.stringify(r)).not.toContain("texto interno");
  });
});

describe("reprocessamento (IM-028)", () => {
  it("exige motivo e devolve o id da decisão", async () => {
    const b = fake();
    expect(
      await servico(b).reprocessarPedido({ pedidoId: PEDIDO, motivo: "falha de rede" }),
    ).toEqual({
      ok: true,
      valor: { decisaoId: 7 },
    });
    const sem = await servico(b).reprocessarPedido({ pedidoId: PEDIDO, motivo: " " });
    expect(sem.ok === false && sem.erro.codigo).toBe("VALIDACAO");
    expect(b.reprocessarPedido).toHaveBeenCalledTimes(1);
  });

  it("pedido inexistente (P0002)", async () => {
    const r = await servico(fake({ reprocessarPedido: vi.fn(comErro("P0002")) })).reprocessarPedido(
      {
        pedidoId: PEDIDO,
        motivo: "x",
      },
    );
    expect(r.ok === false && r.erro.mensagem).toBe(MENSAGENS_PONTOS.pedidoNaoEncontrado);
  });
});

describe("consultas administrativas", () => {
  it("lançamentos do admin identificam o indicador só por referência opaca", async () => {
    const linha: LinhaLancamentoAdmin = {
      id: ID,
      indicador_ref: "a".repeat(64),
      tipo: "reversao",
      pontos: -10,
      situacao: "reversao",
      destino_tipo: "item",
      destino_id: ID2,
      destino_nome: "Bolo",
      categoria: "contato_duplicado",
      motivo: "mesmo contato em dois pedidos",
      original_id: PEDIDO,
      pedido_id: null,
      confirmou_saldo_negativo: true,
      criado_em: "2026-11-01T12:00:00Z",
    };
    const r = await servico(
      fake({ listarLancamentosAdmin: vi.fn(ok([linha])) }),
    ).lancamentosAdmin();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor[0]).toMatchObject({
        indicadorRef: "a".repeat(64),
        categoria: "contato_duplicado",
        observacao: "mesmo contato em dois pedidos",
        confirmouSaldoNegativo: true,
      });
      const chaves = Object.keys(r.valor[0]!);
      for (const proibida of ["indicadorId", "contaId", "whatsapp", "email", "autorId"]) {
        expect(chaves).not.toContain(proibida);
      }
    }
  });

  const decisao = (o: Partial<LinhaDecisaoAdmin>): LinhaDecisaoAdmin => ({
    id: 1,
    pedido_id: PEDIDO,
    pedido_criado_em: "2026-11-01T10:00:00Z",
    destino_tipo: "perfil",
    destino_id: ID2,
    indicador_ref: "b".repeat(64),
    pontuado: true,
    motivo: "pontuado",
    pontos: 10,
    intervalo_dias: 30,
    decidido_em: "2026-11-01T10:00:01Z",
    ...o,
  });

  it("decisões: rótulo do motivo e filtro de não pontuadas", async () => {
    const b = fake({
      listarDecisoesAdmin: vi.fn(
        ok([
          decisao({ id: 1 }),
          decisao({
            id: 2,
            pontuado: false,
            motivo: "dentro_do_intervalo",
            pontos: 0,
            decidido_em: "2026-11-02T10:00:00Z",
          }),
          decisao({ id: 3, motivo: "motivo_desconhecido" }),
        ]),
      ),
    });
    const todas = await servico(b).decisoesAdmin();
    expect(todas.ok && todas.valor.map((d) => d.id)).toEqual([2, 1]);
    const nao = await servico(b).decisoesAdmin({ somenteNaoPontuadas: true });
    expect(nao.ok && nao.valor.map((d) => [d.id, d.motivoRotulo])).toEqual([
      [2, "Dentro do intervalo do mesmo contato e destino"],
    ]);
  });

  it("falhas: filtra pendentes", async () => {
    const f = (pedido_id: string, pendente: boolean): LinhaFalhaAdmin => ({
      pedido_id,
      falhas: 1,
      ultima_falha_em: "2026-11-01T10:00:00Z",
      ultimo_erro: "XX000: erro",
      pendente,
    });
    const b = fake({ listarFalhasAdmin: vi.fn(ok([f(PEDIDO, true), f(ID, false)])) });
    const r = await servico(b).falhasAdmin({ somentePendentes: true });
    expect(r.ok && r.valor.map((x) => x.pedidoId)).toEqual([PEDIDO]);
  });

  it("não administrador recebe lista vazia (visões vazias), sem erro", async () => {
    const r = await servico().lancamentosAdmin();
    expect(r).toEqual({ ok: true, valor: [] });
  });
});

describe("vitrine pública de benefícios (IM-036, IM-079; sem resgate)", () => {
  it("prazo de resgate vencido sai da vitrine; o último dia ainda vale; sem prazo vale", async () => {
    const b = fake({
      listarBeneficiosPublicos: vi.fn(
        ok([
          benef({ id: "a", nome: "Vencido", prazo_resgate_ate: "2026-11-09" }),
          benef({ id: "b", nome: "Último dia", prazo_resgate_ate: "2026-11-10" }),
          benef({ id: "c", nome: "Sem prazo", prazo_resgate_ate: null }),
          benef({ id: "d", nome: "Futuro", prazo_resgate_ate: "2027-01-01" }),
        ]),
      ),
    });
    const r = await servico(b).listarBeneficiosPublicos();
    expect(r.ok && r.valor.map((x) => x.nome)).toEqual(["Futuro", "Sem prazo", "Último dia"]);
  });

  it("usa o fuso de São Paulo na virada do dia", async () => {
    // 11/11 01:00 UTC = 10/11 22:00 em São Paulo: ainda vale o prazo de 10/11.
    const s = criarServicoPontos(
      fake({ listarBeneficiosPublicos: vi.fn(ok([benef({ prazo_resgate_ate: "2026-11-10" })])) }),
      { agora: () => new Date("2026-11-11T01:00:00Z") },
    );
    const r = await s.listarBeneficiosPublicos();
    expect(r.ok && r.valor).toHaveLength(1);
    // 11/11 04:00 UTC = 11/11 01:00 em São Paulo: venceu.
    const s2 = criarServicoPontos(
      fake({ listarBeneficiosPublicos: vi.fn(ok([benef({ prazo_resgate_ate: "2026-11-10" })])) }),
      { agora: () => new Date("2026-11-11T04:00:00Z") },
    );
    const r2 = await s2.listarBeneficiosPublicos();
    expect(r2.ok && r2.valor).toHaveLength(0);
  });

  it("o modelo público não traz conta nem dado privado e não oferece resgate", async () => {
    const r = await servico(
      fake({ listarBeneficiosPublicos: vi.fn(ok([benef()])) }),
    ).listarBeneficiosPublicos();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.valor[0]!).sort()).toEqual(
        [
          "condicoes",
          "descricao",
          "id",
          "limitePorPessoa",
          "limiteTotal",
          "nome",
          "perfilId",
          "pontosNecessarios",
          "prazoResgateAte",
          "prazoUsoDias",
        ].sort(),
      );
    }
    const servicoSemResgate = servico() as Record<string, unknown>;
    for (const nome of Object.keys(servicoSemResgate)) {
      expect(nome).not.toMatch(/resgat|cupom|sorteio|premio/i);
    }
  });
});

describe("benefícios do responsável e do administrador (IM-036)", () => {
  it("cria com validação e devolve ids", async () => {
    const b = fake();
    const r = await servico(b).criarBeneficio({
      perfilId: ID,
      ...BENEFICIO,
      prazoResgateAte: "2026-12-31",
      prazoUsoDias: 30,
    });
    expect(r).toEqual({ ok: true, valor: { beneficioId: ID, versaoId: ID2 } });
    expect(b.criarBeneficio).toHaveBeenCalledWith({
      perfilId: ID,
      ...BENEFICIO,
      condicoes: null,
      limiteTotal: null,
      limitePorPessoa: null,
      prazoResgateAte: "2026-12-31",
      prazoUsoDias: 30,
    });
  });

  it.each([
    ["sem nome", { ...BENEFICIO, nome: " " }],
    ["pontos zero", { ...BENEFICIO, pontosNecessarios: 0 }],
    ["pontos decimais", { ...BENEFICIO, pontosNecessarios: 1.5 }],
    ["limite por pessoa maior que o total", { ...BENEFICIO, limiteTotal: 5, limitePorPessoa: 6 }],
    ["prazo de uso decimal", { ...BENEFICIO, prazoUsoDias: 1.5 }],
    ["prazo de uso zero", { ...BENEFICIO, prazoUsoDias: 0 }],
    ["prazo de uso como data", { ...BENEFICIO, prazoUsoDias: "2027-01-31" }],
    ["prazo de uso acima de 3650 dias", { ...BENEFICIO, prazoUsoDias: 3651 }],
    ["data impossível", { ...BENEFICIO, prazoResgateAte: "2026-02-30" }],
    ["data em outro formato", { ...BENEFICIO, prazoResgateAte: "31/12/2026" }],
    ["descrição longa demais", { ...BENEFICIO, descricao: "a".repeat(1501) }],
  ])("recusa %s sem chamar o banco", async (_n, extra) => {
    const b = fake();
    const r = await servico(b).criarBeneficio({ perfilId: ID, ...extra });
    expect(r.ok === false && r.erro.codigo).toBe("VALIDACAO");
    expect(b.criarBeneficio).not.toHaveBeenCalled();
  });

  it("prazo de uso em dias (1 e 3650) é aceito, junto do prazo de resgate", async () => {
    for (const prazoUsoDias of [1, 3650]) {
      const r = await servico().criarBeneficio({
        perfilId: ID,
        ...BENEFICIO,
        prazoResgateAte: "2026-12-31",
        prazoUsoDias,
      });
      expect(r.ok).toBe(true);
    }
  });

  it("23514 do banco vira validação; P0002 vira benefício indisponível", async () => {
    const e1 = await servico(fake({ criarBeneficio: vi.fn(comErro("23514")) })).criarBeneficio({
      perfilId: ID,
      ...BENEFICIO,
    });
    expect(e1.ok === false && e1.erro.codigo).toBe("VALIDACAO");
    const e2 = await servico(fake({ criarBeneficio: vi.fn(comErro("P0002")) })).criarBeneficio({
      perfilId: ID,
      ...BENEFICIO,
    });
    expect(e2.ok === false && e2.erro.mensagem).toBe(MENSAGENS_PONTOS.beneficioNaoEncontrado);
  });

  it("salva, envia e ativa; versão em análise (P0001) é estado inválido", async () => {
    const b = fake();
    const s = servico(b);
    expect(await s.salvarBeneficio({ beneficioId: ID, ...BENEFICIO })).toEqual({
      ok: true,
      valor: { versaoId: ID2 },
    });
    expect((await s.enviarVersao({ versaoId: ID2 })).ok).toBe(true);
    expect((await s.definirBeneficioAtivo({ beneficioId: ID, ativo: true })).ok).toBe(true);
    const analise = await servico(
      fake({ salvarBeneficio: vi.fn(comErro("P0001")) }),
    ).salvarBeneficio({
      beneficioId: ID,
      ...BENEFICIO,
    });
    expect(analise.ok === false && analise.erro.codigo).toBe("ESTADO_INVALIDO");
  });

  it("ativar sem versão aprovada (P0001) tem mensagem própria", async () => {
    const r = await servico(
      fake({ definirBeneficioAtivo: vi.fn(comErroSimples("P0001")) }),
    ).definirBeneficioAtivo({
      beneficioId: ID,
      ativo: true,
    });
    expect(r.ok === false && r.erro.mensagem).toBe(MENSAGENS_PONTOS.semVersaoAprovada);
  });

  it("rejeição exige motivo; aprovação não", async () => {
    const b = fake();
    const s = servico(b);
    const sem = await s.decidirBeneficio({ versaoId: ID, aprovar: false });
    expect(sem.ok === false && sem.erro.campos).toEqual({
      motivo: "Informe o motivo da rejeição.",
    });
    expect((await s.decidirBeneficio({ versaoId: ID, aprovar: true })).ok).toBe(true);
    expect(
      (await s.decidirBeneficio({ versaoId: ID, aprovar: false, motivo: "fora das regras" })).ok,
    ).toBe(true);
    expect(b.decidirVersao).toHaveBeenCalledTimes(2);
    expect(b.decidirVersao).toHaveBeenLastCalledWith({
      versaoId: ID,
      aprovar: false,
      motivo: "fora das regras",
    });
  });

  it("o dono decidindo o próprio benefício (42501 do banco) vira permissão", async () => {
    const r = await servico(
      fake({ decidirVersao: vi.fn(comErroSimples("42501")) }),
    ).decidirBeneficio({
      versaoId: ID,
      aprovar: true,
    });
    expect(r.ok === false && r.erro.codigo).toBe("PERMISSAO");
  });

  it("admin cadastra e liga/desliga com motivo obrigatório", async () => {
    const b = fake();
    const s = servico(b);
    expect((await s.adminCadastrarBeneficio({ perfilId: ID, ...BENEFICIO })).ok).toBe(false);
    expect(
      (await s.adminCadastrarBeneficio({ perfilId: ID, ...BENEFICIO, motivo: "parceria" })).ok,
    ).toBe(true);
    expect((await s.adminDefinirBeneficioAtivo({ beneficioId: ID, ativo: false })).ok).toBe(false);
    expect(
      (await s.adminDefinirBeneficioAtivo({ beneficioId: ID, ativo: false, motivo: "denúncia" }))
        .ok,
    ).toBe(true);
    expect(b.adminCadastrarBeneficio).toHaveBeenCalledTimes(1);
    expect(b.adminDefinirBeneficioAtivo).toHaveBeenCalledTimes(1);
  });

  it("lista os benefícios do perfil com versões e motivo da rejeição", async () => {
    const b = fake({
      listarBeneficiosDoPerfil: vi.fn(
        ok({
          beneficios: [
            {
              id: ID,
              perfil_id: ID2,
              ativo: false,
              versao_aprovada_id: null,
              criado_em: "2026-11-01T00:00:00Z",
            },
          ],
          versoes: [
            {
              id: PEDIDO,
              beneficio_id: ID,
              situacao: "rejeitada",
              nome: "Café",
              descricao: "d",
              pontos_necessarios: 5,
              condicoes: null,
              limite_total: null,
              limite_por_pessoa: null,
              prazo_resgate_ate: null,
              prazo_uso_dias: null,
              origem: "responsavel",
              criado_em: "2026-11-01T00:00:00Z",
              enviada_em: "2026-11-01T01:00:00Z",
            },
          ],
          revisoes: [
            {
              versao_id: PEDIDO,
              decisao: "rejeitada",
              motivo: "texto confuso",
              decidida_em: "2026-11-02T00:00:00Z",
            },
          ],
        }),
      ),
    });
    const r = await servico(b).listarBeneficiosDoPerfil({ perfilId: ID2 });
    expect(r.ok && r.valor[0]?.versoes[0]).toMatchObject({
      situacao: "rejeitada",
      motivoRejeicao: "texto confuso",
    });
    expect(b.listarBeneficiosDoPerfil).toHaveBeenCalledWith(ID2);
    expect(JSON.stringify(r)).not.toMatch(/autor/i);
  });

  it("fila do administrador: mais antigo primeiro", async () => {
    const b = fake({
      listarFilaBeneficios: vi.fn(
        ok([
          {
            versao_id: ID,
            beneficio_id: ID,
            perfil_id: ID2,
            nome: "B",
            enviada_em: "2026-11-02T00:00:00Z",
            eh_edicao: false,
          },
          {
            versao_id: ID2,
            beneficio_id: ID,
            perfil_id: ID2,
            nome: "A",
            enviada_em: "2026-11-01T00:00:00Z",
            eh_edicao: true,
          },
        ]),
      ),
    });
    const r = await servico(b).filaBeneficios();
    expect(r.ok && r.valor.map((x) => x.nome)).toEqual(["A", "B"]);
  });
});

describe("proposta do administrador e aceite do responsável (IM-036, IM-079)", () => {
  const versaoAguardando = (id: string, criado: string) => ({
    id,
    beneficio_id: ID,
    situacao: "aguardando_aceite",
    nome: "Café",
    descricao: "d",
    pontos_necessarios: 5,
    condicoes: null,
    limite_total: null,
    limite_por_pessoa: null,
    prazo_resgate_ate: null,
    prazo_uso_dias: 30,
    origem: "administrador",
    criado_em: criado,
    enviada_em: criado,
  });

  it("cadastro do admin cria proposta: nada é ativado nem aprovado pelo serviço", async () => {
    const b = fake();
    const r = await servico(b).adminCadastrarBeneficio({
      perfilId: ID,
      ...BENEFICIO,
      prazoUsoDias: 30,
      motivo: "parceria",
    });
    expect(r).toEqual({ ok: true, valor: { beneficioId: ID, versaoId: ID2 } });
    expect(b.adminCadastrarBeneficio).toHaveBeenCalledWith(
      expect.objectContaining({ prazoUsoDias: 30, motivo: "parceria" }),
    );
    expect(b.definirBeneficioAtivo).not.toHaveBeenCalled();
    expect(b.decidirVersao).not.toHaveBeenCalled();
  });

  it("aceitar chama o banco sem motivo; recusar sem motivo é recusado antes do banco", async () => {
    const b = fake();
    const s = servico(b);
    expect(
      (await s.responderProposta({ versaoId: ID, aceitar: true, motivo: "ignorado" })).ok,
    ).toBe(true);
    expect(b.responderProposta).toHaveBeenLastCalledWith({
      versaoId: ID,
      aceitar: true,
      motivo: null,
    });
    const sem = await s.responderProposta({ versaoId: ID, aceitar: false });
    expect(sem.ok === false && sem.erro.campos).toEqual({ motivo: "Informe o motivo da recusa." });
    const branco = await s.responderProposta({ versaoId: ID, aceitar: false, motivo: "   " });
    expect(branco.ok).toBe(false);
    expect(b.responderProposta).toHaveBeenCalledTimes(1);
    expect(
      (await s.responderProposta({ versaoId: ID, aceitar: false, motivo: "não quero" })).ok,
    ).toBe(true);
    expect(b.responderProposta).toHaveBeenLastCalledWith({
      versaoId: ID,
      aceitar: false,
      motivo: "não quero",
    });
  });

  it.each([
    ["id inválido", { versaoId: "1", aceitar: true }],
    ["sem decisão", { versaoId: ID }],
    ["decisão como texto", { versaoId: ID, aceitar: "sim" }],
  ])("responder recusa %s sem chamar o banco", async (_n, entrada) => {
    const b = fake();
    const r = await servico(b).responderProposta(entrada);
    expect(r.ok === false && r.erro.codigo).toBe("VALIDACAO");
    expect(b.responderProposta).not.toHaveBeenCalled();
  });

  it("quem não é o responsável (42501) e proposta fora de aceite (P0001) têm erros tipados", async () => {
    const chamar = (code: string) =>
      servico(fake({ responderProposta: vi.fn(comErroSimples(code)) })).responderProposta({
        versaoId: ID,
        aceitar: true,
      });
    const a = await chamar("42501");
    const b = await chamar("P0001");
    expect(a.ok === false && a.erro.codigo).toBe("PERMISSAO");
    expect(b.ok === false && b.erro.codigo).toBe("ESTADO_INVALIDO");
    expect(JSON.stringify([a, b])).not.toContain("texto interno");
  });

  it("lista as propostas aguardando aceite do perfil (só essa situação), mais recente primeiro", async () => {
    const b = fake({
      listarBeneficiosDoPerfil: vi.fn(
        ok({
          beneficios: [
            {
              id: ID,
              perfil_id: ID2,
              ativo: false,
              versao_aprovada_id: null,
              criado_em: "2026-11-01T00:00:00Z",
            },
          ],
          versoes: [
            versaoAguardando("a", "2026-11-01T00:00:00Z"),
            versaoAguardando("b", "2026-11-03T00:00:00Z"),
            {
              ...versaoAguardando("c", "2026-11-05T00:00:00Z"),
              situacao: "pendente",
              origem: "responsavel",
            },
            { ...versaoAguardando("d", "2026-11-06T00:00:00Z"), situacao: "substituida" },
          ],
          revisoes: [],
        }),
      ),
    });
    const r = await servico(b).propostasAguardandoAceite({ perfilId: ID2 });
    expect(r.ok && r.valor.map((p) => p.versao.id)).toEqual(["b", "a"]);
    expect(r.ok && r.valor[0]).toMatchObject({
      beneficioId: ID,
      versao: { origem: "administrador", prazoUsoDias: 30 },
    });
    expect(JSON.stringify(r)).not.toMatch(/autor/i);
    const invalido = await servico(b).propostasAguardandoAceite({ perfilId: "x" });
    expect(invalido.ok).toBe(false);
  });

  it("admin edita a proposta do responsável com motivo e recebe o id da nova versão", async () => {
    const b = fake();
    const s = servico(b);
    expect((await s.adminEditarProposta({ versaoId: ID, ...BENEFICIO })).ok).toBe(false);
    const r = await s.adminEditarProposta({
      versaoId: ID,
      ...BENEFICIO,
      prazoUsoDias: 15,
      motivo: "ajuste de texto",
    });
    expect(r).toEqual({ ok: true, valor: { versaoId: ID2 } });
    expect(b.adminEditarProposta).toHaveBeenCalledTimes(1);
    expect(b.adminEditarProposta).toHaveBeenCalledWith(
      expect.objectContaining({ versaoId: ID, motivo: "ajuste de texto", prazoUsoDias: 15 }),
    );
  });

  it("editar proposta que não está em análise (P0001) ou do próprio perfil (42501) é erro tipado", async () => {
    const chamar = (code: string) =>
      servico(fake({ adminEditarProposta: vi.fn(comErro(code)) })).adminEditarProposta({
        versaoId: ID,
        ...BENEFICIO,
        motivo: "x",
      });
    const a = await chamar("P0001");
    const b = await chamar("42501");
    expect(a.ok === false && a.erro.codigo).toBe("ESTADO_INVALIDO");
    expect(b.ok === false && b.erro.codigo).toBe("PERMISSAO");
  });

  it("lista do admin as propostas aguardando aceite, mais antigas primeiro, descartando linha incompleta", async () => {
    const b = fake({
      listarAguardandoAceite: vi.fn(
        ok<LinhaAguardandoAceite[]>([
          {
            versao_id: "b",
            beneficio_id: ID,
            perfil_id: ID2,
            nome: "B",
            enviada_em: "2026-11-02T00:00:00Z",
          },
          {
            versao_id: "a",
            beneficio_id: ID,
            perfil_id: ID2,
            nome: "A",
            enviada_em: "2026-11-01T00:00:00Z",
          },
          { versao_id: null, beneficio_id: ID, perfil_id: ID2, nome: "X", enviada_em: null },
        ]),
      ),
    });
    const r = await servico(b).listarAguardandoAceite();
    expect(r.ok && r.valor.map((x) => x.versaoId)).toEqual(["a", "b"]);
    const vazio = await servico().listarAguardandoAceite();
    expect(vazio).toEqual({ ok: true, valor: [] });
  });
});
