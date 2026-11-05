import { describe, expect, it, vi } from "vitest";
import {
  criarServicoComissoes,
  mapearErroBancoComissoes,
  type ClienteBancoComissoes,
  type LinhaMinhaComissao,
  type LinhaMinhaSituacao,
  type LinhaNegocioComissao,
  type LinhaNegocioVinculo,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const MOTIVO = "Registro conforme combinado com o anunciante.";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const comErro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco: tabela comissoes_x" },
});

function fake(sobrescrever: Partial<ClienteBancoComissoes> = {}) {
  return {
    definirParametro: vi.fn(ok(null)),
    definirHabilitacao: vi.fn(ok<number>(1)),
    registrarVinculo: vi.fn(ok<string>(ID2)),
    registrarAssinatura: vi.fn(ok<string>(ID2)),
    cancelarAssinatura: vi.fn(ok(null)),
    confirmarPagamento: vi.fn(ok<string>(ID3)),
    estornarPagamento: vi.fn(ok<string | null>(ID3)),
    reverterComissao: vi.fn(ok<string>(ID3)),
    avancarRepasse: vi.fn(ok<number>(5)),
    listarVinculosVencidos: vi.fn(ok([])),
    encerrarVinculo: vi.fn(ok(null)),
    criarOferta: vi.fn(ok<string>(ID2)),
    alterarPercentualOferta: vi.fn(ok<number>(2)),
    definirOfertaAtiva: vi.fn(ok<number>(3)),
    listarMinhasComissoes: vi.fn(ok<LinhaMinhaComissao[]>([])),
    lerMeuSaldo: vi.fn(ok([])),
    listarMinhasSituacoes: vi.fn(ok<LinhaMinhaSituacao[]>([])),
    listarMeusNegocios: vi.fn(ok([])),
    listarMinhasOfertas: vi.fn(ok([])),
    listarNegocioComissoes: vi.fn(ok<LinhaNegocioComissao[]>([])),
    listarNegocioVinculos: vi.fn(ok<LinhaNegocioVinculo[]>([])),
    listarSituacoesComoIndicador: vi.fn(ok([])),
    listarSituacoesComoResponsavel: vi.fn(ok([])),
    ...sobrescrever,
  } satisfies ClienteBancoComissoes;
}

const comissaoBase = {
  id: ID,
  negocio_id: ID2,
  oferta_nome: "Plano mensal",
  competencia: "2026-10-01",
  base_centavos: 10000,
  percentual_bp: 500,
  valor_centavos: 500,
  cliente_ref: "abc123",
  estado: "gerada",
  revertida: false,
  reversao_causa: null,
  criada_em: "2026-11-01T10:00:00Z",
} satisfies LinhaMinhaComissao;

describe("mapeamento de erros SQL (IM-073, IM-086)", () => {
  it.each([
    ["42501", "SEM_PERMISSAO"],
    ["22023", "VALIDACAO"],
    ["P0002", "NAO_ENCONTRADO"],
    ["P0001", "REGRA_NEGOCIO"],
    ["P0409", "CONFLITO"],
    ["P0410", "CONFIRMACAO_NECESSARIA"],
    ["XX000", "ERRO_INTERNO"],
  ])("%s vira %s e nunca vaza o texto do banco", (code, esperado) => {
    const e = mapearErroBancoComissoes({ code, message: "comissoes_comissao violada" });
    expect(e.codigo).toBe(esperado);
    expect(e.mensagem).not.toMatch(/comissoes_|violada/);
  });

  it("sem código vira erro interno", () => {
    expect(mapearErroBancoComissoes({}).codigo).toBe("ERRO_INTERNO");
  });
});

describe("validação de entrada: nada chega ao banco quando inválida", () => {
  it("motivo curto (< 10) é recusado em toda ação administrativa", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const curto = "curto";
    const rs = await Promise.all([
      s.definirParametro({ chave: "prazo_inadimplencia_dias", valor: 60, motivo: curto }),
      s.definirHabilitacao({ perfilId: ID, ativa: true, origem: "espontanea", motivo: curto }),
      s.registrarVinculo({ perfilId: ID, indicadorId: ID, clienteId: ID2, motivo: curto }),
      s.registrarAssinatura({
        ofertaId: ID,
        clienteId: ID2,
        valorCentavos: 1000,
        inicio: "2026-10-01",
        motivo: curto,
      }),
      s.cancelarAssinatura({ assinaturaId: ID, motivo: curto }),
      s.confirmarPagamento({
        assinaturaId: ID,
        competencia: "2026-10",
        valorCentavos: 1000,
        motivo: curto,
      }),
      s.estornarPagamento({ pagamentoId: ID, motivo: curto }),
      s.reverterComissao({ comissaoId: ID, causa: "correcao", motivo: curto }),
      s.avancarRepasse({ comissaoId: ID, estado: "paga", motivo: curto }),
      s.encerrarVinculo({ vinculoId: ID, motivo: curto }),
    ]);
    for (const r of rs) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    }
    for (const f of Object.values(b)) expect(f).not.toHaveBeenCalled();
  });

  it("motivo só com espaços não conta como 10 caracteres", async () => {
    const b = fake();
    const r = await criarServicoComissoes(b).cancelarAssinatura({
      assinaturaId: ID,
      motivo: "          x",
    });
    expect(r.ok).toBe(false);
    expect(b.cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("recusa UUID inválido", async () => {
    const b = fake();
    const r = await criarServicoComissoes(b).encerrarVinculo({ vinculoId: "123", motivo: MOTIVO });
    expect(r.ok).toBe(false);
    expect(b.encerrarVinculo).not.toHaveBeenCalled();
  });

  it.each([
    ["decimal", 10.5],
    ["zero", 0],
    ["negativo", -100],
    ["acima do máximo", 100_000_001],
    ["texto", "1000"],
    ["NaN", Number.NaN],
  ])("valor em centavos inválido (%s)", async (_n, valor) => {
    const b = fake();
    const r = await criarServicoComissoes(b).confirmarPagamento({
      assinaturaId: ID,
      competencia: "2026-10",
      valorCentavos: valor,
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.campos).toHaveProperty("valorCentavos");
    expect(b.confirmarPagamento).not.toHaveBeenCalled();
  });

  it.each(["2026-13", "2026-00", "2026-10-01", "26-10", "outubro", ""])(
    "competência inválida %j",
    async (competencia) => {
      const b = fake();
      const r = await criarServicoComissoes(b).confirmarPagamento({
        assinaturaId: ID,
        competencia,
        valorCentavos: 1000,
        motivo: MOTIVO,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.campos).toHaveProperty("competencia");
      expect(b.confirmarPagamento).not.toHaveBeenCalled();
    },
  );

  it.each([0, 10001, 12.5, -5])(
    "percentual fora de 1..10000 pontos-base (%s) é recusado",
    async (bp) => {
      const b = fake();
      const s = criarServicoComissoes(b);
      const r1 = await s.criarOferta({
        perfilId: ID,
        itemId: ID2,
        nome: "Plano",
        percentualBp: bp,
      });
      const r2 = await s.alterarPercentualOferta({ ofertaId: ID, percentualBp: bp });
      expect(r1.ok || r2.ok).toBe(false);
      expect(b.criarOferta).not.toHaveBeenCalled();
      expect(b.alterarPercentualOferta).not.toHaveBeenCalled();
    },
  );

  it("aceita os limites do percentual (1 e 10000)", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    expect((await s.alterarPercentualOferta({ ofertaId: ID, percentualBp: 1 })).ok).toBe(true);
    expect((await s.alterarPercentualOferta({ ofertaId: ID, percentualBp: 10000 })).ok).toBe(true);
  });

  it("vínculo com indicador igual ao cliente é recusado", async () => {
    const b = fake();
    const r = await criarServicoComissoes(b).registrarVinculo({
      perfilId: ID,
      indicadorId: ID2,
      clienteId: ID2,
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
    expect(b.registrarVinculo).not.toHaveBeenCalled();
  });

  it("assinatura com data inexistente ou fim antes do início é recusada", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const base = { ofertaId: ID, clienteId: ID2, valorCentavos: 1000, motivo: MOTIVO };
    expect((await s.registrarAssinatura({ ...base, inicio: "2026-02-30" })).ok).toBe(false);
    expect(
      (await s.registrarAssinatura({ ...base, inicio: "2026-10-01", fim: "2026-09-01" })).ok,
    ).toBe(false);
    expect(b.registrarAssinatura).not.toHaveBeenCalled();
  });

  it("causa de reversão e estado de repasse fora da lista são recusados", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    expect((await s.reverterComissao({ comissaoId: ID, causa: "outra", motivo: MOTIVO })).ok).toBe(
      false,
    );
    expect((await s.avancarRepasse({ comissaoId: ID, estado: "gerada", motivo: MOTIVO })).ok).toBe(
      false,
    );
    expect(b.reverterComissao).not.toHaveBeenCalled();
    expect(b.avancarRepasse).not.toHaveBeenCalled();
  });

  it("nome de oferta vazio ou acima de 100 caracteres é recusado", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const base = { perfilId: ID, itemId: ID2, percentualBp: 500 };
    expect((await s.criarOferta({ ...base, nome: "   " })).ok).toBe(false);
    expect((await s.criarOferta({ ...base, nome: "x".repeat(101) })).ok).toBe(false);
    expect(b.criarOferta).not.toHaveBeenCalled();
  });
});

describe("ações válidas chamam o banco com os argumentos normalizados", () => {
  it("confirmarPagamento converte AAAA-MM em dia 1 e devolve o id", async () => {
    const b = fake();
    const r = await criarServicoComissoes(b).confirmarPagamento({
      assinaturaId: ID,
      competencia: "2026-10",
      valorCentavos: 9900,
      motivo: `  ${MOTIVO}  `,
    });
    expect(r).toEqual({ ok: true, valor: { id: ID3 } });
    expect(b.confirmarPagamento).toHaveBeenCalledWith({
      assinaturaId: ID,
      competencia: "2026-10-01",
      valorCentavos: 9900,
      motivo: MOTIVO,
    });
  });

  it("registrarAssinatura sem fim envia fim nulo", async () => {
    const b = fake();
    await criarServicoComissoes(b).registrarAssinatura({
      ofertaId: ID,
      clienteId: ID2,
      valorCentavos: 9900,
      inicio: "2026-10-01",
      motivo: MOTIVO,
    });
    expect(b.registrarAssinatura).toHaveBeenCalledWith(expect.objectContaining({ fim: null }));
  });

  it("estornarPagamento não confirma comissão já paga por padrão", async () => {
    const b = fake();
    await criarServicoComissoes(b).estornarPagamento({ pagamentoId: ID, motivo: MOTIVO });
    expect(b.estornarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ confirmarJaPaga: false }),
    );
  });

  it("estornarPagamento sem comissão devolve reversaoId nulo", async () => {
    const b = fake({ estornarPagamento: vi.fn(ok<string | null>(null)) });
    const r = await criarServicoComissoes(b).estornarPagamento({ pagamentoId: ID, motivo: MOTIVO });
    expect(r).toEqual({ ok: true, valor: { reversaoId: null } });
  });

  it("estorno de comissão já paga sem confirmação vira CONFIRMACAO_NECESSARIA (P0410)", async () => {
    const b = fake({ estornarPagamento: comErro("P0410") });
    const r = await criarServicoComissoes(b).estornarPagamento({ pagamentoId: ID, motivo: MOTIVO });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("CONFIRMACAO_NECESSARIA");
  });

  it("reverter comissão já revertida vira CONFLITO (P0409), sem duplicar", async () => {
    const b = fake({ reverterComissao: comErro("P0409") });
    const r = await criarServicoComissoes(b).reverterComissao({
      comissaoId: ID,
      causa: "cancelamento",
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("CONFLITO");
  });

  it("reverterComissao devolve reversaoId", async () => {
    const r = await criarServicoComissoes(fake()).reverterComissao({
      comissaoId: ID,
      causa: "correcao",
      motivo: MOTIVO,
      confirmarJaPaga: true,
    });
    expect(r).toEqual({ ok: true, valor: { reversaoId: ID3 } });
  });

  it("não-administrador (42501) recebe SEM_PERMISSAO e nenhum texto do banco", async () => {
    const b = fake({ definirParametro: comErro("42501") });
    const r = await criarServicoComissoes(b).definirParametro({
      chave: "prazo_inadimplencia_dias",
      valor: 90,
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("SEM_PERMISSAO");
      expect(JSON.stringify(r.erro)).not.toContain("tabela");
    }
  });

  it("módulo desabilitado no negócio (P0001) vira REGRA_NEGOCIO", async () => {
    const b = fake({ criarOferta: comErro("P0001") });
    const r = await criarServicoComissoes(b).criarOferta({
      perfilId: ID,
      itemId: ID2,
      nome: "Plano",
      percentualBp: 500,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("REGRA_NEGOCIO");
  });

  it("ação sem id devolvido pelo banco é erro interno (não finge sucesso)", async () => {
    const b = fake({ registrarVinculo: vi.fn(ok<string>("")) });
    const r = await criarServicoComissoes(b).registrarVinculo({
      perfilId: ID,
      indicadorId: ID2,
      clienteId: ID3,
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
  });

  it("exceção do adaptador vira ERRO_INTERNO sem vazar", async () => {
    const b = fake({
      cancelarAssinatura: vi.fn(async () => {
        throw new Error("senha=segredo");
      }),
    });
    const r = await criarServicoComissoes(b).cancelarAssinatura({
      assinaturaId: ID,
      motivo: MOTIVO,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("ERRO_INTERNO");
      expect(JSON.stringify(r.erro)).not.toContain("segredo");
    }
  });

  it("listarVinculosVencidos sem entrada manda perfil nulo e mapeia linhas completas", async () => {
    const b = fake({
      listarVinculosVencidos: vi.fn(
        ok([
          {
            o_vinculo_id: ID,
            o_perfil_id: ID2,
            o_indicador_ref: "ref",
            o_inadimplente_desde: "2026-08-01",
            o_prazo_dias: 60,
            o_vence_em: "2026-09-30",
          },
          {
            o_vinculo_id: ID2,
            o_perfil_id: ID2,
            o_indicador_ref: "ref",
            o_inadimplente_desde: null,
            o_prazo_dias: 60,
            o_vence_em: null,
          },
        ] as never),
      ),
    });
    const r = await criarServicoComissoes(b).listarVinculosVencidos();
    expect(b.listarVinculosVencidos).toHaveBeenCalledWith({ perfilId: null });
    expect(r.ok && r.valor).toEqual([
      {
        vinculoId: ID,
        negocioId: ID2,
        indicadorRef: "ref",
        inadimplenteDesde: "2026-08-01",
        prazoDias: 60,
        venceEm: "2026-09-30",
      },
    ]);
  });
});

describe("leituras: sem dados privados e sem inventar valores (IM-029, IM-041, IM-050, IM-065)", () => {
  it("minhasComissoes copia só campos conhecidos, ordena e descarta estado inválido", async () => {
    const b = fake({
      listarMinhasComissoes: vi.fn(
        ok<LinhaMinhaComissao[]>([
          { ...comissaoBase, id: ID, criada_em: "2026-10-01T00:00:00Z" },
          {
            ...comissaoBase,
            id: ID2,
            criada_em: "2026-11-01T00:00:00Z",
            // campos que não existem no tipo, simulando coluna indevida da visão
            ...({
              telefone: "+5511999999999",
              email: "a@b.c",
              cliente_nome: "Fulano de Tal",
            } as object),
          },
          { ...comissaoBase, id: ID3, estado: "inventado" },
        ]),
      ),
    });
    const r = await criarServicoComissoes(b).minhasComissoes();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.map((c) => c.id)).toEqual([ID2, ID]);
    const texto = JSON.stringify(r.valor);
    expect(texto).not.toMatch(/telefone|email|Fulano|\+55/);
  });

  it("comissão revertida tem líquido zero e causa; não revertida mantém valor", async () => {
    const b = fake({
      listarMinhasComissoes: vi.fn(
        ok<LinhaMinhaComissao[]>([
          { ...comissaoBase, id: ID, revertida: true, reversao_causa: "estorno" },
          { ...comissaoBase, id: ID2, reversao_causa: "xpto" },
        ]),
      ),
    });
    const r = await criarServicoComissoes(b).minhasComissoes();
    if (!r.ok) throw new Error("esperava ok");
    const rev = r.valor.find((c) => c.id === ID);
    const normal = r.valor.find((c) => c.id === ID2);
    expect(rev).toMatchObject({ revertida: true, reversaoCausa: "estorno", liquidoCentavos: 0 });
    expect(normal).toMatchObject({ revertida: false, reversaoCausa: null, liquidoCentavos: 500 });
  });

  it("meuSaldo sem linhas devolve zeros; com linha converte para o modelo", async () => {
    const vazio = await criarServicoComissoes(fake()).meuSaldo();
    expect(vazio).toEqual({
      ok: true,
      valor: {
        totalGeradoCentavos: 0,
        liquidoCentavos: 0,
        geradaCentavos: 0,
        pendenteRepasseCentavos: 0,
        pagaCentavos: 0,
        revertidaAposPagaCentavos: 0,
        quantidade: 0,
      },
    });
    const b = fake({
      lerMeuSaldo: vi.fn(
        ok([
          {
            total_gerado_centavos: 1500,
            liquido_centavos: 1000,
            gerada_centavos: 500,
            pendente_repasse_centavos: 0,
            paga_centavos: 500,
            revertida_apos_paga_centavos: 500,
            quantidade: 3,
          },
        ]),
      ),
    });
    const r = await criarServicoComissoes(b).meuSaldo();
    expect(r.ok && r.valor.liquidoCentavos).toBe(1000);
    expect(r.ok && r.valor.revertidaAposPagaCentavos).toBe(500);
  });

  it("minhaSituacao deriva o aviso: inadimplente dentro do prazo avisa; vencido ou em dia não", async () => {
    const linha = (negocio: string, extra: Partial<LinhaMinhaSituacao>): LinhaMinhaSituacao => ({
      negocio_id: negocio,
      modulo_ativo: true,
      clientes_ativos: 1,
      clientes_encerrados: 0,
      em_dia: true,
      inadimplente_desde: null,
      encerra_em: null,
      prazo_dias: 60,
      ...extra,
    });
    const b = fake({
      listarMinhasSituacoes: vi.fn(
        ok([
          linha(ID, { em_dia: false, inadimplente_desde: "2026-10-01", encerra_em: "2026-11-30" }),
          linha(ID2, { em_dia: false, inadimplente_desde: "2026-08-01", encerra_em: "2026-09-30" }),
          linha(ID3, {}),
        ]),
      ),
    });
    const r = await criarServicoComissoes(b, {
      agora: () => new Date("2026-11-05T12:00:00Z"),
    }).minhaSituacao();
    if (!r.ok) throw new Error("esperava ok");
    const por = Object.fromEntries(r.valor.map((s) => [s.negocioId, s.emAviso]));
    expect(por).toEqual({ [ID]: true, [ID2]: false, [ID3]: false });
  });

  it("negocioComissoes e negocioVinculos expõem só referências opacas", async () => {
    const b = fake({
      listarNegocioComissoes: vi.fn(
        ok<LinhaNegocioComissao[]>([
          {
            ...comissaoBase,
            indicador_ref: "ind-ref",
            ...({ indicador_id: "conta-secreta", cliente_telefone: "+5511988887777" } as object),
          },
        ]),
      ),
      listarNegocioVinculos: vi.fn(
        ok<LinhaNegocioVinculo[]>([
          {
            id: ID,
            negocio_id: ID2,
            indicador_ref: "ind-ref",
            cliente_ref: "cli-ref",
            situacao: "ativo",
            indicador_em_dia: false,
            inadimplente_desde: "2026-09-01",
            encerra_em: "2026-10-31",
            criado_em: "2026-01-01T00:00:00Z",
            encerrado_em: null,
          },
          {
            id: ID3,
            negocio_id: ID2,
            indicador_ref: "x",
            cliente_ref: "y",
            situacao: "outra",
            indicador_em_dia: true,
            inadimplente_desde: null,
            encerra_em: null,
            criado_em: "2026-01-01T00:00:00Z",
            encerrado_em: null,
          },
        ]),
      ),
    });
    const s = criarServicoComissoes(b);
    const c = await s.negocioComissoes();
    const v = await s.negocioVinculos();
    expect(JSON.stringify(c)).not.toMatch(/conta-secreta|telefone|\+55/);
    expect(c.ok && c.valor[0]?.indicadorRef).toBe("ind-ref");
    expect(v.ok && v.valor).toHaveLength(1);
    expect(v.ok && v.valor[0]).toMatchObject({ situacao: "ativo", indicadorEmDia: false });
  });

  it("erro de leitura vira erro tipado", async () => {
    const b = fake({ listarMeusNegocios: comErro("42501") });
    const r = await criarServicoComissoes(b).meusNegocios();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("SEM_PERMISSAO");
  });

  it("situacoesComoIndicador/Responsavel mapeiam o invólucro e ignoram linha sem vínculo", async () => {
    const linhas = [
      { o_vinculo_id: ID, o_em_dia: false, o_inadimplente_desde: "2026-09-01" },
      { o_vinculo_id: null, o_em_dia: true, o_inadimplente_desde: null },
    ];
    const b = fake({
      listarSituacoesComoIndicador: vi.fn(ok(linhas as never)),
      listarSituacoesComoResponsavel: vi.fn(ok(linhas as never)),
    });
    const s = criarServicoComissoes(b);
    const esperado = [{ vinculoId: ID, emDia: false, inadimplenteDesde: "2026-09-01" }];
    expect(await s.situacoesComoIndicador()).toEqual({ ok: true, valor: esperado });
    expect(await s.situacoesComoResponsavel()).toEqual({ ok: true, valor: esperado });
  });
});

describe("isolamento (IM-065, IM-090)", () => {
  it("o serviço só expõe operações de comissões: sem cobrança, repasse automático ou pontos", () => {
    const s = criarServicoComissoes(fake());
    const nomes = Object.keys(s).join(" ").toLowerCase();
    expect(nomes).not.toMatch(/cobrar|cobranca|pontos|curtir|gateway|pix|automatic/);
  });
});
