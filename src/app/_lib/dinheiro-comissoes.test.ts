import { describe, expect, it } from "vitest";
import {
  formatarPercentualBp,
  formatarReais,
  lerPercentualBp,
  lerReais,
} from "./dinheiro-comissoes";

const NB = " ";

describe("dinheiro das comissões: bordas (IM-005, IM-062)", () => {
  it("lê '1.234,56' e 'R$ 1.234,56' como 123456 centavos", () => {
    expect(lerReais("1.234,56")).toBe(123456);
    expect(lerReais("R$ 1.234,56")).toBe(123456);
    expect(lerReais("99,9")).toBe(9990);
    expect(lerReais("0,05")).toBe(5);
  });
  it("recusa formato americano, milhar torto, três casas, negativo e vazio", () => {
    for (const t of ["1,234.56", "12.34.567,00", "1,234", "-5", "", "abc", "1e3", "1.23,00"]) {
      expect(lerReais(t), t).toBeNaN();
    }
  });
  it("recusa valor acima do inteiro seguro em vez de arredondar", () => {
    expect(lerReais("9".repeat(30))).toBeNaN();
  });
  it("formata sem erro de ponto flutuante e com milhar", () => {
    expect(formatarReais(1)).toBe(`R$${NB}0,01`);
    expect(formatarReais(123456789)).toBe(`R$${NB}1.234.567,89`);
    expect(formatarReais(Number.NaN)).toBe(`R$${NB}0,00`);
  });
  it("percentual: ida e volta e recusa de 3 casas ou sinal", () => {
    expect(lerPercentualBp("2,5")).toBe(250);
    expect(formatarPercentualBp(250)).toBe("2,5%");
    expect(formatarPercentualBp(10000)).toBe("100%");
    expect(lerPercentualBp("2,555")).toBeNaN();
    expect(lerPercentualBp("-1")).toBeNaN();
  });
});
