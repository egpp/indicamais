import { describe, expect, it, vi } from "vitest";
import {
  criarServicoComissoes,
  type ClienteBancoComissoes,
  type LinhaComissaoAdmin,
  type LinhaNegocioAdmin,
  type LinhaVinculoAdmin,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const comErro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno: tabela comissoes_habilitacao_evento" },
});

/** Só as leituras do administrador importam aqui; o resto do contrato não é tocado. */
function servico(sobrescrever: Partial<ClienteBancoComissoes>, hoje = "2026-11-05T12:00:00Z") {
  const banco = sobrescrever as ClienteBancoComissoes;
  return criarServicoComissoes(banco, { agora: () => new Date(hoje) });
}

const negocio = {
  o_negocio_id: ID,
  o_slug: "padaria-do-ze",
  o_nome: "Padaria do Zé",
  o_publicado: true,
  o_modulo_ativo: true,
  o_estado_desde: "2026-10-01T10:00:00Z",
  o_origem: "solicitacao",
  o_total: 41,
} satisfies LinhaNegocioAdmin;

describe("leituras do administrador: paginação e filtros (IM-061)", () => {
  it("usa 20 por página, deriva o deslocamento e devolve o total do filtro", async () => {
    const listarNegociosAdmin = vi.fn(ok([negocio]));
    const r = await servico({ listarNegociosAdmin }).adminNegocios({ pagina: "3" });
    expect(listarNegociosAdmin).toHaveBeenCalledWith({
      estado: null,
      busca: null,
      limite: 20,
      deslocamento: 40,
    });
    expect(r).toEqual({
      ok: true,
      valor: {
        itens: [
          {
            negocioId: ID,
            slug: "padaria-do-ze",
            nome: "Padaria do Zé",
            publicado: true,
            moduloAtivo: true,
            estadoDesde: "2026-10-01T10:00:00Z",
            origem: "solicitacao",
          },
        ],
        total: 41,
        limite: 20,
        deslocamento: 40,
      },
    });
  });

  it("campos vazios do formulário GET valem como ausentes e a busca é aparada", async () => {
    const listarNegociosAdmin = vi.fn(ok([]));
    const s = servico({ listarNegociosAdmin });
    await s.adminNegocios({ estado: "", busca: "  padaria ", pagina: "", limite: "" });
    expect(listarNegociosAdmin).toHaveBeenCalledWith({
      estado: null,
      busca: "padaria",
      limite: 20,
      deslocamento: 0,
    });
    const vazio = await s.adminNegocios({});
    expect(vazio).toEqual({
      ok: true,
      valor: { itens: [], total: 0, limite: 20, deslocamento: 0 },
    });
  });

  it.each([
    [{ pagina: "0" }],
    [{ pagina: "-1" }],
    [{ pagina: "abc" }],
    [{ pagina: "1.5" }],
    [{ pagina: "10001" }],
    [{ limite: "101" }],
    [{ limite: "0" }],
    [{ estado: "tudo" }],
    [{ busca: "a".repeat(81) }],
    [{ busca: "a\u0000b" }],
  ])("recusa filtro inválido %j sem tocar o banco", async (entrada) => {
    const listarNegociosAdmin = vi.fn(ok([]));
    const r = await servico({ listarNegociosAdmin }).adminNegocios(entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    expect(listarNegociosAdmin).not.toHaveBeenCalled();
  });

  it("filtros por negócio exigem UUID e estados conhecidos", async () => {
    const listarPagamentosAdmin = vi.fn(ok([]));
    const s = servico({ listarPagamentosAdmin });
    const ruim = await s.adminPagamentos({ perfilId: "nao-e-uuid" });
    expect(ruim.ok).toBe(false);
    const estado = await s.adminPagamentos({ estado: "pago" });
    expect(estado.ok).toBe(false);
    expect(listarPagamentosAdmin).not.toHaveBeenCalled();
    await s.adminPagamentos({ perfilId: ID, estado: "estornado", limite: "100", pagina: "2" });
    expect(listarPagamentosAdmin).toHaveBeenCalledWith({
      perfilId: ID,
      estado: "estornado",
      limite: 100,
      deslocamento: 100,
    });
  });

  it("42501 do banco vira SEM_PERMISSAO sem vazar o texto interno", async () => {
    const r = await servico({ listarComissoesAdmin: comErro("42501") }).adminComissoes();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("SEM_PERMISSAO");
      expect(r.erro.mensagem).not.toMatch(/comissoes_|tabela/);
    }
  });

  it("exceção do adaptador vira erro genérico", async () => {
    const r = await servico({
      listarAssinaturasAdmin: vi.fn(async () => {
        throw new Error("boom: service_role");
      }),
    }).adminAssinaturas();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.mensagem).not.toMatch(/boom|service_role/);
  });
});

describe("leituras do administrador: mapeamento sem dado privado (IM-029, IM-041, IM-050)", () => {
  it("negócio não publicado volta sem nome e linhas sem id são descartadas", async () => {
    const r = await servico({
      listarNegociosAdmin: vi.fn(
        ok([
          { ...negocio, o_nome: null as never, o_publicado: false, o_origem: null as never },
          { ...negocio, o_negocio_id: null as never },
        ]),
      ),
    }).adminNegocios();
    expect(r.ok && r.valor.itens).toHaveLength(1);
    if (r.ok)
      expect(r.valor.itens[0]).toMatchObject({ nome: null, publicado: false, origem: null });
  });

  it("comissão do administrador copia só campos conhecidos (coluna extra não vaza)", async () => {
    const linha = {
      o_id: ID,
      o_negocio_id: ID2,
      o_pagamento_id: ID3,
      o_oferta_nome: "Plano mensal",
      o_competencia: "2026-10-01",
      o_indicador_id: ID2,
      o_cliente_id: ID3,
      o_base_centavos: 10000,
      o_percentual_bp: 500,
      o_valor_centavos: 500,
      o_estado: "gerada",
      o_estado_em: "2026-11-01T10:00:00Z",
      o_revertida: false,
      o_reversao_causa: null,
      o_criada_em: "2026-11-01T10:00:00Z",
      o_total: 1,
      telefone: "+5511999990000",
      email: "x@y.com",
      motivo: "texto interno do administrador",
    } as unknown as LinhaComissaoAdmin;
    const r = await servico({ listarComissoesAdmin: vi.fn(ok([linha])) }).adminComissoes();
    expect(r.ok).toBe(true);
    const texto = JSON.stringify(r);
    expect(texto).not.toMatch(/telefone|email|5511999|texto interno|motivo/);
    if (r.ok) {
      expect(r.valor.itens[0]).toMatchObject({
        indicadorId: ID2,
        clienteId: ID3,
        valorCentavos: 500,
        percentualBp: 500,
        estado: "gerada",
        reversaoCausa: null,
      });
    }
  });

  it("estado desconhecido de comissão ou pagamento descarta a linha", async () => {
    const r = await servico({
      listarComissoesAdmin: vi.fn(ok([{ o_id: ID, o_estado: "inventado", o_total: 1 }] as never)),
      listarPagamentosAdmin: vi.fn(ok([{ o_id: ID, o_estado: "inventado", o_total: 1 }] as never)),
    }).adminComissoes();
    expect(r.ok && r.valor.itens).toEqual([]);
  });
});

describe("vínculos: vencido derivado e prazo vigente (IM-068, IM-072)", () => {
  const vinculo = (extra: Partial<LinhaVinculoAdmin>): LinhaVinculoAdmin => ({
    o_id: ID,
    o_negocio_id: ID2,
    o_indicador_id: ID2,
    o_cliente_id: ID3,
    o_situacao: "ativo",
    o_indicador_em_dia: false,
    o_inadimplente_desde: "2026-09-01",
    o_encerra_em: "2026-10-31",
    o_criado_em: "2026-08-01T10:00:00Z",
    o_encerrado_em: null as never,
    o_total: 3,
    ...extra,
  });

  it("marca vencido só se ativo e a data prevista já chegou", async () => {
    const s = servico({
      listarVinculosAdmin: vi.fn(
        ok([
          vinculo({ o_id: ID, o_encerra_em: "2026-11-05" }),
          vinculo({ o_id: ID2, o_encerra_em: "2026-11-06" }),
          vinculo({ o_id: ID3, o_situacao: "encerrado", o_encerra_em: "2026-10-01" }),
        ]),
      ),
    });
    const r = await s.adminVinculos();
    expect(r.ok && r.valor.itens.map((v) => v.vencido)).toEqual([true, false, false]);
  });

  it("lê o prazo atual do banco e falha fechado sem linha", async () => {
    const lerPrazoInadimplencia = vi.fn(
      ok([
        { o_prazo_dias: 45, o_minimo: 1, o_maximo: 365, o_atualizado_em: "2026-11-01T00:00:00Z" },
      ]),
    );
    expect(await servico({ lerPrazoInadimplencia }).adminPrazoInadimplencia()).toEqual({
      ok: true,
      valor: { prazoDias: 45, minimo: 1, maximo: 365, atualizadoEm: "2026-11-01T00:00:00Z" },
    });
    const vazio = await servico({ lerPrazoInadimplencia: vi.fn(ok([])) }).adminPrazoInadimplencia();
    expect(vazio.ok).toBe(false);
    const negado = await servico({
      lerPrazoInadimplencia: comErro("42501"),
    }).adminPrazoInadimplencia();
    expect(negado.ok).toBe(false);
  });
});

describe("nome público para o indicador (IM-072)", () => {
  it("devolve nome e slug, com nulos quando o perfil não é público", async () => {
    const r = await servico({
      listarNegociosVinculados: vi.fn(
        ok([
          { o_negocio_id: ID, o_nome: "Padaria do Zé", o_slug: "padaria-do-ze" },
          { o_negocio_id: ID2, o_nome: null as never, o_slug: null as never },
          { o_negocio_id: null as never, o_nome: "x", o_slug: "x" },
        ]),
      ),
    }).meusNegociosVinculados();
    expect(r).toEqual({
      ok: true,
      valor: [
        { negocioId: ID, nome: "Padaria do Zé", slug: "padaria-do-ze" },
        { negocioId: ID2, nome: null, slug: null },
      ],
    });
  });

  it("erro do banco vira erro tipado", async () => {
    const r = await servico({
      listarNegociosVinculados: comErro("42501"),
    }).meusNegociosVinculados();
    expect(r.ok).toBe(false);
  });
});
