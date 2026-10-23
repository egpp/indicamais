import { describe, expect, it } from "vitest";
import { normalizarWhatsappBR } from "./index";

const ok = (e: string) => {
  const r = normalizarWhatsappBR(e);
  return r.ok ? r.e164 : `ERRO:${r.codigo}`;
};

describe("normalizarWhatsappBR (IM-009)", () => {
  it.each([
    ["(11) 99999-0001", "+5511999990001"],
    ["11999990001", "+5511999990001"],
    ["+55 11 99999-0001", "+5511999990001"],
    ["5511999990001", "+5511999990001"],
    ["011 99999-0001", "+5511999990001"],
    ["0 11 99999-0001", "+5511999990001"],
    ["+55 (11) 99999-0001", "+5511999990001"],
    ["  (11) 99999.0001  ", "+5511999990001"],
    ["(11) 3333-4444", "+551133334444"],
    ["551133334444", "+551133334444"],
  ])("aceita %s", (entrada, esperado) => {
    expect(ok(entrada)).toBe(esperado);
  });

  it("DDD 55 (RS) com 11 dígitos não é confundido com código do país", () => {
    expect(ok("55999990001")).toBe("+5555999990001");
    expect(ok("5555999990001")).toBe("+5555999990001");
  });

  it("resultado casa com o CHECK do banco", () => {
    for (const e of ["11999990001", "1133334444", "21987654321"]) {
      expect(ok(e)).toMatch(/^\+55\d{10,11}$/);
    }
  });

  it.each([
    ["", "VAZIO"],
    ["   ", "VAZIO"],
    ["+1 415 555 2671", "NAO_BRASILEIRO"],
    ["+351 912 345 678", "NAO_BRASILEIRO"],
    ["+5411 1234 5678", "NAO_BRASILEIRO"],
    ["00 55 11 99999-0001", "NAO_BRASILEIRO"],
    ["119999900", "COMPRIMENTO"],
    ["999990001", "COMPRIMENTO"],
    ["10999990001", "DDD_INVALIDO"],
    ["20999990001", "DDD_INVALIDO"],
    ["00999990001", "DDD_INVALIDO"],
    ["11899990001", "NUMERO_INVALIDO"],
    ["1199999000", "NUMERO_INVALIDO"],
    ["abc", "NUMERO_INVALIDO"],
    ["11 99999-000a", "NUMERO_INVALIDO"],
    ["11999990001; drop table", "NUMERO_INVALIDO"],
  ])("rejeita %j", (entrada, codigo) => {
    expect(ok(entrada)).toBe(`ERRO:${codigo}`);
  });

  it("erros trazem mensagem em pt-BR", () => {
    const r = normalizarWhatsappBR("+1 415 555 2671");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/brasileiro/);
  });

  it("entrada não string não quebra", () => {
    expect(ok(undefined as unknown as string)).toBe("ERRO:VAZIO");
  });
});
