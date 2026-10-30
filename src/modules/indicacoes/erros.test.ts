import { describe, expect, it } from "vitest";
import {
  mapearErroBancoIndicacoes,
  MENSAGENS_INDICACOES,
  refinarErroPorEstadoDaConta,
} from "./index";

const e = (code: string) => ({
  code,
  message: "SEGREDO interno: tabela indicacoes_link, uuid 123, +5551999999999",
  details: "DETALHE interno",
});

describe("mapearErroBancoIndicacoes", () => {
  it.each([
    ["P0412", "gerar_link", "SEM_WHATSAPP"],
    ["P0403", "gerar_link", "AUTOINDICACAO"],
    ["P0002", "gerar_link", "INDISPONIVEL"],
    ["P0002", "contato", "INDISPONIVEL"],
    ["P0002", "compartilhar", "NAO_ENCONTRADO"],
    ["P0002", "reenvio", "NAO_ENCONTRADO"],
    ["P0002", "parametro", "NAO_ENCONTRADO"],
    ["P0429", "contato", "LIMITE"],
    ["P0429", "compartilhar", "LIMITE"],
    ["42501", "gerar_link", "NAO_AUTENTICADO"],
    ["42501", "compartilhar", "NAO_AUTENTICADO"],
    ["42501", "alerta", "PERMISSAO"],
    ["42501", "parametro", "PERMISSAO"],
    ["42501", "reenvio", "PERMISSAO"],
    ["22023", "contato", "VALIDACAO"],
    ["22023", "compartilhar", "VALIDACAO"],
    ["22023", "alerta", "VALIDACAO"],
    ["23505", "contato", "CONFLITO_CHAVE"],
    ["23514", "parametro", "VALIDACAO"],
    ["P0001", "reenvio", "ESTADO_INVALIDO"],
    ["P0001", "alerta", "ESTADO_INVALIDO"],
    ["XX000", "contato", "ERRO_INTERNO"],
  ] as const)("%s em %s -> %s", (code, op, esperado) => {
    expect(mapearErroBancoIndicacoes(e(code), op).codigo).toBe(esperado);
  });

  it("nunca vaza texto do banco", () => {
    for (const code of ["P0412", "P0403", "P0002", "P0429", "42501", "22023", "23505", "XX000"]) {
      for (const op of ["gerar_link", "compartilhar", "contato", "reenvio", "alerta"] as const) {
        const { mensagem } = mapearErroBancoIndicacoes(e(code), op);
        expect(mensagem).not.toMatch(/SEGREDO|DETALHE|indicacoes_|uuid|5551999999999/);
        expect(Object.values(MENSAGENS_INDICACOES)).toContain(mensagem);
      }
    }
  });

  it("erro sem código vira genérico", () => {
    expect(mapearErroBancoIndicacoes({ message: "x" }, "contato").mensagem).toBe(
      MENSAGENS_INDICACOES.generica,
    );
  });
});

describe("refinarErroPorEstadoDaConta (IM-080)", () => {
  const semWhats = mapearErroBancoIndicacoes(e("P0412"), "gerar_link");

  it("conta suspensa: mensagem própria, diferente de 'cadastre seu WhatsApp'", () => {
    const r = refinarErroPorEstadoDaConta(semWhats, { acessoPermitido: false });
    expect(r.codigo).toBe("CONTA_SUSPENSA");
    expect(r.mensagem).toBe(MENSAGENS_INDICACOES.contaSuspensa);
    expect(r.mensagem).not.toMatch(/WhatsApp/);
  });

  it("conta com acesso ou estado desconhecido: continua pedindo o WhatsApp", () => {
    expect(refinarErroPorEstadoDaConta(semWhats, { acessoPermitido: true }).codigo).toBe(
      "SEM_WHATSAPP",
    );
    expect(refinarErroPorEstadoDaConta(semWhats, { acessoPermitido: null }).codigo).toBe(
      "SEM_WHATSAPP",
    );
  });

  it("não mexe em outros erros", () => {
    const outro = mapearErroBancoIndicacoes(e("P0403"), "gerar_link");
    expect(refinarErroPorEstadoDaConta(outro, { acessoPermitido: false })).toBe(outro);
  });
});
