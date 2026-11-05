import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as publico from "./index";
import {
  criarServicoComissoes,
  mapearErroBancoComissoes,
  type ClienteBancoComissoes,
} from "./index";

/**
 * Verificação independente (entradas hostis, privacidade, escopo). O banco é um fake: se a validação deixar passar,
 * o espião é chamado e o teste falha. IM-029, IM-041, IM-050, IM-065, IM-073, IM-086, IM-090.
 */
const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const MOTIVO = "Registro conforme combinado com o anunciante.";
const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });

function fake() {
  return {
    definirParametro: vi.fn(ok(null)),
    definirHabilitacao: vi.fn(ok<number>(1)),
    registrarVinculo: vi.fn(ok<string>(ID2)),
    registrarAssinatura: vi.fn(ok<string>(ID2)),
    cancelarAssinatura: vi.fn(ok(null)),
    confirmarPagamento: vi.fn(ok<string>(ID2)),
    estornarPagamento: vi.fn(ok<string | null>(ID2)),
    reverterComissao: vi.fn(ok<string>(ID2)),
    avancarRepasse: vi.fn(ok<number>(1)),
    listarVinculosVencidos: vi.fn(ok([])),
    encerrarVinculo: vi.fn(ok(null)),
    criarOferta: vi.fn(ok<string>(ID2)),
    alterarPercentualOferta: vi.fn(ok<number>(1)),
    definirOfertaAtiva: vi.fn(ok<number>(1)),
    listarMinhasComissoes: vi.fn(ok([])),
    lerMeuSaldo: vi.fn(ok([])),
    listarMinhasSituacoes: vi.fn(ok([])),
    listarMeusNegocios: vi.fn(ok([])),
    listarMinhasOfertas: vi.fn(ok([])),
    listarNegocioComissoes: vi.fn(ok([])),
    listarNegocioVinculos: vi.fn(ok([])),
    listarSituacoesComoIndicador: vi.fn(ok([])),
    listarSituacoesComoResponsavel: vi.fn(ok([])),
    listarNegociosAdmin: vi.fn(ok([])),
    listarAssinaturasAdmin: vi.fn(ok([])),
    listarPagamentosAdmin: vi.fn(ok([])),
    listarComissoesAdmin: vi.fn(ok([])),
    listarVinculosAdmin: vi.fn(ok([])),
    lerPrazoInadimplencia: vi.fn(ok([])),
    listarNegociosVinculados: vi.fn(ok([])),
  } satisfies ClienteBancoComissoes;
}

const base = {
  assinatura: {
    ofertaId: ID,
    clienteId: ID2,
    valorCentavos: 1000,
    inicio: "2026-10-01",
    motivo: MOTIVO,
  },
  pagamento: { assinaturaId: ID, competencia: "2026-10", valorCentavos: 1000, motivo: MOTIVO },
  oferta: { perfilId: ID, itemId: ID2, nome: "Plano", percentualBp: 500 },
};

type Caso = [string, (s: ReturnType<typeof criarServicoComissoes>) => Promise<{ ok: boolean }>];
const hostis: Caso[] = [
  ["uuid inválido", (s) => s.cancelarAssinatura({ assinaturaId: "não-é-uuid", motivo: MOTIVO })],
  [
    "uuid com SQL",
    (s) => s.cancelarAssinatura({ assinaturaId: `${ID}'; drop table x;--`, motivo: MOTIVO }),
  ],
  ["centavos negativos", (s) => s.registrarAssinatura({ ...base.assinatura, valorCentavos: -1 })],
  ["centavos zero", (s) => s.confirmarPagamento({ ...base.pagamento, valorCentavos: 0 })],
  ["centavos fracionados", (s) => s.confirmarPagamento({ ...base.pagamento, valorCentavos: 10.5 })],
  ["centavos enormes", (s) => s.confirmarPagamento({ ...base.pagamento, valorCentavos: 1e15 })],
  [
    "centavos acima do máximo",
    (s) => s.registrarAssinatura({ ...base.assinatura, valorCentavos: 100_000_001 }),
  ],
  ["centavos NaN", (s) => s.registrarAssinatura({ ...base.assinatura, valorCentavos: NaN })],
  [
    "centavos Infinity",
    (s) => s.registrarAssinatura({ ...base.assinatura, valorCentavos: Infinity }),
  ],
  ["centavos string", (s) => s.registrarAssinatura({ ...base.assinatura, valorCentavos: "1000" })],
  ["percentual 0", (s) => s.criarOferta({ ...base.oferta, percentualBp: 0 })],
  ["percentual 10001", (s) => s.criarOferta({ ...base.oferta, percentualBp: 10001 })],
  ["percentual fracionado", (s) => s.alterarPercentualOferta({ ofertaId: ID, percentualBp: 5.5 })],
  ["percentual negativo", (s) => s.alterarPercentualOferta({ ofertaId: ID, percentualBp: -5 })],
  [
    "competência 2026-13",
    (s) => s.confirmarPagamento({ ...base.pagamento, competencia: "2026-13" }),
  ],
  [
    "competência 2026-00",
    (s) => s.confirmarPagamento({ ...base.pagamento, competencia: "2026-00" }),
  ],
  [
    "competência com dia",
    (s) => s.confirmarPagamento({ ...base.pagamento, competencia: "2026-10-15" }),
  ],
  [
    "competência com quebra de linha",
    (s) => s.confirmarPagamento({ ...base.pagamento, competencia: "2026-10\n" }),
  ],
  ["data inexistente", (s) => s.registrarAssinatura({ ...base.assinatura, inicio: "2026-02-30" })],
  [
    "datas invertidas",
    (s) => s.registrarAssinatura({ ...base.assinatura, inicio: "2026-10-10", fim: "2026-10-09" }),
  ],
  [
    "motivo de 9 caracteres",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: "123456789" }),
  ],
  [
    "motivo de 501 caracteres",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: "a".repeat(501) }),
  ],
  ["motivo só espaços", (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: " ".repeat(50) })],
  [
    "motivo só tabs e quebras",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: "\t\n\r".repeat(10) }),
  ],
  [
    "motivo com caractere de controle",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: `${MOTIVO}\u0000` }),
  ],
  [
    "motivo gigante (1 MB)",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: "x".repeat(1_000_000) }),
  ],
  [
    "motivo não-string",
    (s) => s.cancelarAssinatura({ assinaturaId: ID, motivo: { toString: () => MOTIVO } }),
  ],
  ["nome de oferta gigante", (s) => s.criarOferta({ ...base.oferta, nome: "n".repeat(100_000) })],
  [
    "chave de parâmetro hostil",
    (s) => s.definirParametro({ chave: "x'; --", valor: 1, motivo: MOTIVO }),
  ],
  [
    "chave de parâmetro gigante",
    (s) => s.definirParametro({ chave: "a".repeat(100_000), valor: 1, motivo: MOTIVO }),
  ],
  [
    "valor de parâmetro fracionado",
    (s) => s.definirParametro({ chave: "prazo_inadimplencia_dias", valor: 1.5, motivo: MOTIVO }),
  ],
  [
    "causa de reversão fora da lista",
    (s) => s.reverterComissao({ comissaoId: ID, causa: "outra", motivo: MOTIVO }),
  ],
  [
    "estado de repasse 'gerada'",
    (s) => s.avancarRepasse({ comissaoId: ID, estado: "gerada", motivo: MOTIVO }),
  ],
  [
    "origem de habilitação inválida",
    (s) => s.definirHabilitacao({ perfilId: ID, ativa: true, origem: "x", motivo: MOTIVO }),
  ],
  ["ativa como string", (s) => s.definirOfertaAtiva({ ofertaId: ID, ativa: "true" })],
  [
    "vínculo indicador = cliente",
    (s) => s.registrarVinculo({ perfilId: ID, indicadorId: ID, clienteId: ID, motivo: MOTIVO }),
  ],
  ["entrada null", (s) => s.cancelarAssinatura(null)],
  ["entrada undefined", (s) => s.estornarPagamento(undefined)],
  ["entrada string", (s) => s.encerrarVinculo("texto")],
  ["entrada array", (s) => s.criarOferta([ID])],
  ["listarVencidos com uuid inválido", (s) => s.listarVinculosVencidos({ perfilId: "x" })],
];

describe("entradas hostis: recusadas antes do banco", () => {
  it.each(hostis)("%s", async (_n, chamar) => {
    const b = fake();
    const r = await chamar(criarServicoComissoes(b));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const e = (r as unknown as { erro: { codigo: string; mensagem: string } }).erro;
      expect(e.codigo).toBe("VALIDACAO");
      expect(e.mensagem).not.toMatch(/comissoes_|select |insert /i);
    }
    for (const f of Object.values(b)) expect(f).not.toHaveBeenCalled();
  });

  it("limites exatos do motivo: 10 e 500 passam; 9 e 501 não", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const r = await Promise.all(
      [9, 10, 500, 501].map((n) =>
        s.cancelarAssinatura({ assinaturaId: ID, motivo: "m".repeat(n) }),
      ),
    );
    expect(r.map((x) => x.ok)).toEqual([false, true, true, false]);
    expect(b.cancelarAssinatura).toHaveBeenCalledTimes(2);
  });

  it("motivo é aparado antes de ir ao banco", async () => {
    const b = fake();
    await criarServicoComissoes(b).cancelarAssinatura({
      assinaturaId: ID,
      motivo: `   ${MOTIVO}   `,
    });
    expect(b.cancelarAssinatura).toHaveBeenCalledWith({ assinaturaId: ID, motivo: MOTIVO });
  });

  it("prototype pollution: __proto__/constructor na entrada não polui nem chega ao banco", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const malicioso = JSON.parse(
      `{"assinaturaId":"${ID}","motivo":"${MOTIVO}","__proto__":{"polluido":true,"confirmarJaPaga":true},"constructor":{"prototype":{"polluido":true}}}`,
    );
    const r = await s.cancelarAssinatura(malicioso);
    expect(r.ok).toBe(true);
    expect(b.cancelarAssinatura).toHaveBeenCalledWith({ assinaturaId: ID, motivo: MOTIVO });
    expect(({} as Record<string, unknown>).polluido).toBeUndefined();
    const arg = (b.cancelarAssinatura.mock.calls as unknown as Record<string, unknown>[][])[0]![0]!;
    expect(Object.keys(arg).sort()).toEqual(["assinaturaId", "motivo"]);
    expect(arg.polluido).toBeUndefined();
  });

  it("prototype pollution não liga confirmarJaPaga (D-025: padrão false)", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const m = JSON.parse(
      `{"pagamentoId":"${ID}","motivo":"${MOTIVO}","__proto__":{"confirmarJaPaga":true}}`,
    );
    await s.estornarPagamento(m);
    await s.reverterComissao(
      JSON.parse(
        `{"comissaoId":"${ID}","causa":"correcao","motivo":"${MOTIVO}","__proto__":{"confirmarJaPaga":true}}`,
      ),
    );
    expect(
      (b.estornarPagamento.mock.calls as unknown as [{ confirmarJaPaga: boolean }][])[0]![0]
        .confirmarJaPaga,
    ).toBe(false);
    expect(
      (b.reverterComissao.mock.calls as unknown as [{ confirmarJaPaga: boolean }][])[0]![0]
        .confirmarJaPaga,
    ).toBe(false);
  });

  it("chaves extras (service_role, id de conta, preço) são descartadas, não repassadas", async () => {
    const b = fake();
    await criarServicoComissoes(b).confirmarPagamento({
      ...base.pagamento,
      service_role: "segredo",
      indicadorId: ID,
      comissaoCentavos: 999999,
    });
    expect((b.confirmarPagamento.mock.calls as unknown[][])[0]![0]).toEqual({
      assinaturaId: ID,
      competencia: "2026-10-01",
      valorCentavos: 1000,
      motivo: MOTIVO,
    });
  });

  it("confirmarJaPaga não-booleano é recusado (não vira true por 'truthy')", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    const r1 = await s.estornarPagamento({
      pagamentoId: ID,
      motivo: MOTIVO,
      confirmarJaPaga: "false",
    });
    const r2 = await s.reverterComissao({
      comissaoId: ID,
      causa: "estorno",
      motivo: MOTIVO,
      confirmarJaPaga: 1,
    });
    expect(r1.ok || r2.ok).toBe(false);
    expect(b.estornarPagamento).not.toHaveBeenCalled();
    expect(b.reverterComissao).not.toHaveBeenCalled();
  });

  it("confirmarJaPaga explícito true é repassado; padrão é false", async () => {
    const b = fake();
    const s = criarServicoComissoes(b);
    await s.estornarPagamento({ pagamentoId: ID, motivo: MOTIVO });
    await s.estornarPagamento({ pagamentoId: ID, motivo: MOTIVO, confirmarJaPaga: true });
    const enviados = (
      b.estornarPagamento.mock.calls as unknown as [{ confirmarJaPaga: boolean }][]
    ).map((c) => c[0].confirmarJaPaga);
    expect(enviados).toEqual([false, true]);
  });
});

describe("mapeamento de erros: todos os códigos, sem texto do banco", () => {
  const PERIGOSO =
    'violates constraint "comissoes_comissao_pkey" DETAIL: Key (id)=(abc) senha=segredo';
  it.each(["22023", "42501", "P0002", "P0001", "P0409", "P0410", "23505", "XX000", "", undefined])(
    "código %s",
    (code) => {
      const e = mapearErroBancoComissoes({ code, message: PERIGOSO });
      expect(JSON.stringify(e)).not.toMatch(/comissoes_|constraint|senha|segredo|abc|DETAIL/);
      expect(e.mensagem.length).toBeGreaterThan(5);
    },
  );
  it("código desconhecido e erro nulo no objeto vão para ERRO_INTERNO", () => {
    expect(mapearErroBancoComissoes({ code: "99999", message: PERIGOSO }).codigo).toBe(
      "ERRO_INTERNO",
    );
  });
});

describe("privacidade: leituras só com referências opacas (IM-029, IM-041, IM-050)", () => {
  it("campos privados extras na linha do banco não aparecem em nenhuma saída", async () => {
    const intruso = {
      nome: "Maria da Silva",
      nome_completo: "Maria da Silva Souza",
      telefone: "+5511999998888",
      email: "maria@exemplo.com",
      cliente_id: ID,
      indicador_id: ID2,
      motivo: "motivo interno do admin",
      user_id: ID,
    };
    const b = fake();
    b.listarMinhasComissoes = vi.fn(
      ok([
        {
          id: ID,
          negocio_id: ID2,
          oferta_nome: "Plano",
          competencia: "2026-10-01",
          base_centavos: 1,
          percentual_bp: 1,
          valor_centavos: 1,
          cliente_ref: "ref1",
          estado: "gerada",
          revertida: false,
          reversao_causa: null,
          criada_em: "2026-11-01T00:00:00Z",
          ...intruso,
        },
      ]),
    ) as never;
    b.listarNegocioComissoes = vi.fn(
      ok([
        {
          id: ID,
          negocio_id: ID2,
          oferta_nome: "Plano",
          competencia: "2026-10-01",
          base_centavos: 1,
          percentual_bp: 1,
          valor_centavos: 1,
          indicador_ref: "ind1",
          cliente_ref: "ref1",
          estado: "paga",
          revertida: true,
          reversao_causa: "estorno",
          criada_em: "2026-11-01T00:00:00Z",
          ...intruso,
        },
      ]),
    ) as never;
    b.listarNegocioVinculos = vi.fn(
      ok([
        {
          id: ID,
          negocio_id: ID2,
          indicador_ref: "ind1",
          cliente_ref: "ref1",
          situacao: "ativo",
          indicador_em_dia: true,
          inadimplente_desde: null,
          encerra_em: null,
          criado_em: "2026-11-01T00:00:00Z",
          encerrado_em: null,
          ...intruso,
        },
      ]),
    ) as never;
    b.listarVinculosVencidos = vi.fn(
      ok([
        {
          o_vinculo_id: ID,
          o_perfil_id: ID2,
          o_indicador_ref: "ind1",
          o_inadimplente_desde: "2026-08-01",
          o_prazo_dias: 60,
          o_vence_em: "2026-10-01",
          ...intruso,
        },
      ]),
    ) as never;
    const s = criarServicoComissoes(b);
    const saidas = JSON.stringify([
      await s.minhasComissoes(),
      await s.negocioComissoes(),
      await s.negocioVinculos(),
      await s.listarVinculosVencidos(),
    ]);
    expect(saidas).toContain("ref1");
    for (const proibido of [
      "Maria",
      "+5511",
      "maria@",
      "motivo interno",
      "cliente_id",
      "indicador_id",
      "user_id",
      "telefone",
      "email",
    ])
      expect(saidas).not.toContain(proibido);
  });

  it("os tipos de saída não têm campo de nome, telefone, e-mail nem id de conta", () => {
    const fonte = readFileSync(join(__dirname, "modelos.ts"), "utf8");
    const modelos = fonte.slice(
      fonte.indexOf("export type MinhaComissao"),
      fonte.indexOf("export function paraMinhaComissao"),
    );
    expect(modelos).not.toMatch(
      /\b(nomeCompleto|nomeCliente|nomeIndicador|telefone|email|clienteId|indicadorId|contaId|userId|motivo)\??:/,
    );
  });
});

describe("escopo (IM-065, IM-090, IM-074 futuro)", () => {
  const dir = __dirname;
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const codigo = arquivos.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("não importa pontos, relacionamento, social, pagamentos nem service_role", () => {
    const imports = [...codigo.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const i of imports) {
      expect(i).not.toMatch(
        /modules\/(pontos|relacionamento|social|pagamentos|planos|remarketing)/,
      );
      expect(i).not.toMatch(/supabase\/(admin|service)/);
    }
    expect(semComentarios).not.toMatch(
      /service_role|SERVICE_ROLE|fetch\(|stripe|mercadopago|pagarme|asaas|pix\b|boleto|webhook/i,
    );
  });

  it("a API pública não tem cobrança, repasse automático, transferência nem gateway", () => {
    const nomes = [...Object.keys(publico), ...Object.keys(criarServicoComissoes(fake()))].join(
      " ",
    );
    expect(nomes).not.toMatch(
      /cobrar|cobranca|gateway|transferir|pagarAutomatico|repasseAutomatico|webhook|pix|boleto|sincronizar/i,
    );
  });

  it("só exporta pelo index: nenhum outro módulo/arquivo importa interno de comissoes", () => {
    const raiz = join(__dirname, "..", "..");
    const percorrer = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? percorrer(join(d, e.name))
          : /\.(ts|tsx)$/.test(e.name)
            ? [join(d, e.name)]
            : [],
      );
    const fora = percorrer(raiz).filter(
      (f) => !f.replace(/\\/g, "/").includes("/modules/comissoes/"),
    );
    for (const f of fora) {
      const txt = readFileSync(f, "utf8");
      expect(txt, f).not.toMatch(/@\/modules\/comissoes\/[\w./-]+/);
    }
  });

  it("o saldo de comissões é só em centavos: nenhum campo de pontos", async () => {
    const r = await criarServicoComissoes(fake()).meuSaldo();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const campos = Object.keys(r.valor);
      expect(campos.filter((c) => /ponto/i.test(c))).toEqual([]);
      expect(campos.length).toBeGreaterThan(0);
    }
  });
});
