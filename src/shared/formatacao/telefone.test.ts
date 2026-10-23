import { describe, expect, it } from "vitest";
import { formatarE164BR, mascararTelefoneBR } from "./telefone";

describe("IM-005 máscara de telefone brasileiro", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1199999", "(11) 9999-9"],
    ["11999990001", "(11) 99999-0001"],
    ["1133330001", "(11) 3333-0001"],
    ["+55 11 99999-0001", "(11) 99999-0001"],
    ["119999900019999", "(11) 99999-0001"],
    ["abc", ""],
  ])("máscara de %j", (entrada, esperado) => {
    expect(mascararTelefoneBR(entrada)).toBe(esperado);
  });

  it("formata E.164 para exibição", () => {
    expect(formatarE164BR("+5511999990001")).toBe("(11) 99999-0001");
    expect(formatarE164BR("+551133330001")).toBe("(11) 3333-0001");
    expect(formatarE164BR("qualquer")).toBe("qualquer");
  });
});
