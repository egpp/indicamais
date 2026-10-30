import { describe, expect, it, vi } from "vitest";
import { criarServicoPontos, type ClienteBancoPontos } from "@/modules/pontos";
import { criarContextoPontos } from "./contexto-pontos";
import { lerCamposBeneficio } from "./entrada-pontos";
import { lerDeRegistro } from "./entrada-conteudo";
import {
  decidirBeneficioAdmin,
  definirParametroPontos,
  responderPropostaResponsavel,
  reverterCreditoAdmin,
} from "./tratadores-pontos";
import { validarBeneficio, validarReversao } from "./validacao-pontos";

const ID = "11111111-1111-4111-8111-111111111111";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

function ctx(banco: Partial<ClienteBancoPontos>, admin = true) {
  return criarContextoPontos({
    banco: banco as ClienteBancoPontos,
    logado: true,
    ehAdministrador: async () => admin,
  });
}

describe("tratadores de pontos (Fase 4)", () => {
  it("quem não é administrador não reverte crédito e o banco nem é chamado", async () => {
    const reverterCredito = vi.fn();
    const r = await reverterCreditoAdmin(
      ctx({ reverterCredito }, false),
      form({ lancamentoId: ID, categoria: "fraude", observacao: "x" }),
    );
    expect(r.erro).toBeTruthy();
    expect(reverterCredito).not.toHaveBeenCalled();
  });

  it("reversão exige categoria fixa e observação, com erro por campo", async () => {
    const r = await reverterCreditoAdmin(ctx({}), form({ lancamentoId: ID, categoria: "" }));
    expect(r.erros?.categoria).toBeTruthy();
    expect(r.erros?.observacao).toBeTruthy();
  });

  it("saldo negativo pede confirmação explícita e repete com confirmarSaldoNegativo", async () => {
    const reverterCredito = vi
      .fn()
      .mockResolvedValueOnce({ dados: null, erro: { code: "P0410" } })
      .mockResolvedValueOnce({ dados: ID, erro: null });
    const c = ctx({ reverterCredito });
    const campos = { lancamentoId: ID, categoria: "fraude", observacao: "análise feita" };
    const primeiro = await reverterCreditoAdmin(c, form(campos));
    expect(primeiro.pedirConfirmacao).toBe(true);
    expect(primeiro.valores?.categoria).toBe("fraude");
    const segundo = await reverterCreditoAdmin(
      c,
      form({ ...campos, confirmarSaldoNegativo: "sim" }),
    );
    expect(segundo.sucesso).toBeTruthy();
    expect(reverterCredito.mock.calls[0]?.[0].confirmarSaldoNegativo).toBe(false);
    expect(reverterCredito.mock.calls[1]?.[0].confirmarSaldoNegativo).toBe(true);
  });

  it("parâmetro fora da faixa mostra a mensagem neutra do módulo, sem texto do banco", async () => {
    const definirParametro = vi
      .fn()
      .mockResolvedValue({ erro: { code: "22023", message: "interno" } });
    const r = await definirParametroPontos(
      ctx({ definirParametro }),
      form({ chave: "intervalo_dias", valor: "9999", motivo: "teste" }),
    );
    expect(r.erro).toContain("faixa");
    expect(JSON.stringify(r)).not.toContain("interno");
  });

  it("rejeitar benefício sem motivo é recusado antes do banco", async () => {
    const decidirVersao = vi.fn();
    const r = await decidirBeneficioAdmin(
      ctx({ decidirVersao }),
      form({ versaoId: ID, decisao: "rejeitar", motivo: "" }),
    );
    expect(r.erros?.motivo).toBeTruthy();
    expect(decidirVersao).not.toHaveBeenCalled();
  });

  it("recusar proposta exige motivo; aceitar envia sem motivo", async () => {
    const responderProposta = vi.fn().mockResolvedValue({ erro: null });
    const c = ctx({ responderProposta }, false);
    const recusa = await responderPropostaResponsavel(
      c,
      form({ versaoId: ID, resposta: "recusar" }),
    );
    expect(recusa.erros?.motivo).toBeTruthy();
    const aceite = await responderPropostaResponsavel(
      c,
      form({ versaoId: ID, resposta: "aceitar" }),
    );
    expect(aceite.sucesso).toBeTruthy();
    expect(responderProposta).toHaveBeenCalledWith({ versaoId: ID, aceitar: true, motivo: null });
  });
});

describe("validação no navegador com o schema do servidor", () => {
  it("benefício: prazo de uso em dias e data de resgate inválidos geram erro por campo", () => {
    const erros = validarBeneficio("criar", {
      perfilId: ID,
      nome: "Café",
      descricao: "Um café",
      pontosNecessarios: "50",
      prazoUsoDias: "0",
      prazoResgateAte: "31/12/2026",
    });
    expect(erros?.prazoUsoDias).toBeTruthy();
    expect(erros?.prazoResgateAte).toBeTruthy();
  });

  it("benefício válido passa; campos opcionais vazios viram sem limite", () => {
    const d = {
      nome: "Café",
      descricao: "Um café",
      pontosNecessarios: "50",
      prazoUsoDias: "30",
      prazoResgateAte: "2026-12-31",
    };
    expect(validarBeneficio("criar", { perfilId: ID, ...d })).toBeNull();
    expect(lerCamposBeneficio(lerDeRegistro(d)).limiteTotal).toBeNull();
  });

  it("reversão: categoria fora da lista é recusada", () => {
    expect(
      validarReversao({ lancamentoId: ID, categoria: "qualquer", observacao: "x" })?.categoria,
    ).toBeTruthy();
  });
});

describe("serviço sobre banco falso", () => {
  it("histórico do indicador entrega só a categoria da reversão (nunca a observação)", async () => {
    const banco = {
      listarMeusLancamentos: async () => ({
        erro: null,
        dados: [
          {
            id: ID,
            tipo: "reversao",
            pontos: -10,
            situacao: "reversao",
            destino_tipo: "perfil",
            destino_id: ID,
            destino_nome: "Loja",
            categoria: "contato_duplicado",
            original_id: null,
            criado_em: "2026-10-30T12:00:00Z",
          },
        ],
      }),
    } as unknown as ClienteBancoPontos;
    const r = await criarServicoPontos(banco).meusLancamentos();
    expect(r.ok && r.valor[0]?.categoriaRotulo).toBe("Contato duplicado");
    expect(JSON.stringify(r)).not.toContain("observacao");
  });
});
