import { describe, expect, it } from "vitest";
import {
  formatarCentavos,
  formatarPreco,
  parsearReaisParaCentavos,
  precoDeColunas,
  precoParaColunas,
  precoSchema,
} from "./index";

const NB = " ";

describe("preço (IM-014)", () => {
  it("aceita fixo e a partir de com valor em centavos", () => {
    expect(precoSchema.parse({ modo: "fixo", centavos: 1250 })).toEqual({
      modo: "fixo",
      centavos: 1250,
    });
    expect(precoSchema.parse({ modo: "a_partir_de", centavos: 1 }).modo).toBe("a_partir_de");
    expect(precoSchema.parse({ modo: "fixo", centavos: 100_000_000 }).centavos).toBe(100_000_000);
  });

  it("sob consulta não leva valor", () => {
    expect(precoSchema.parse({ modo: "sob_consulta" })).toEqual({
      modo: "sob_consulta",
      centavos: null,
    });
    expect(precoSchema.parse({ modo: "sob_consulta", centavos: null }).centavos).toBeNull();
    expect(precoSchema.safeParse({ modo: "sob_consulta", centavos: 500 }).success).toBe(false);
  });

  it("recusa preço zero, negativo, fracionado e acima do teto", () => {
    for (const centavos of [0, -1, 10.5, 100_000_001, Number.NaN, "100"]) {
      expect(precoSchema.safeParse({ modo: "fixo", centavos }).success).toBe(false);
      expect(precoSchema.safeParse({ modo: "a_partir_de", centavos }).success).toBe(false);
    }
  });

  it('recusa "fixo" e "a partir de" sem valor', () => {
    expect(precoSchema.safeParse({ modo: "fixo" }).success).toBe(false);
    expect(precoSchema.safeParse({ modo: "a_partir_de", centavos: null }).success).toBe(false);
    const r = precoSchema.safeParse({ modo: "fixo" });
    expect(!r.success && r.error.issues[0]?.message).toMatch(/valor/);
  });

  it("recusa modo desconhecido", () => {
    expect(precoSchema.safeParse({ modo: "gratis", centavos: 0 }).success).toBe(false);
    expect(precoSchema.safeParse({}).success).toBe(false);
  });
});

describe("formatação em R$ pt-BR", () => {
  it("formata centavos com milhar e vírgula", () => {
    expect(formatarCentavos(1)).toBe(`R$${NB}0,01`);
    expect(formatarCentavos(1250)).toBe(`R$${NB}12,50`);
    expect(formatarCentavos(123456)).toBe(`R$${NB}1.234,56`);
    expect(formatarCentavos(100_000_000)).toBe(`R$${NB}1.000.000,00`);
  });
  it("texto por modo", () => {
    expect(formatarPreco({ modo: "fixo", centavos: 5000 })).toBe(`R$${NB}50,00`);
    expect(formatarPreco({ modo: "a_partir_de", centavos: 5000 })).toBe(`A partir de R$${NB}50,00`);
    expect(formatarPreco({ modo: "sob_consulta", centavos: null })).toBe("Sob consulta");
    expect(formatarPreco(null)).toBeNull();
  });
  it("não formata valor inválido", () => {
    expect(() => formatarCentavos(-1)).toThrow();
    expect(() => formatarCentavos(1.5)).toThrow();
  });
});

describe("entrada do usuário em reais", () => {
  it.each([
    ["12,50", 1250],
    ["R$ 1.234,56", 123456],
    ["10", 1000],
    ["0,05", 5],
    ["5,5", 550],
    ["1000000", 100_000_000],
  ])("%s -> %i centavos", (texto, centavos) => {
    expect(parsearReaisParaCentavos(texto)).toBe(centavos);
  });
  it.each(["0", "0,00", "-5", "abc", "12,505", "1.23", "", "1000000,01", "R$", "12,50,1"])(
    "recusa %j",
    (texto) => {
      expect(parsearReaisParaCentavos(texto)).toBeNull();
    },
  );
});

describe("colunas do banco", () => {
  it("ida e volta", () => {
    expect(precoParaColunas(null)).toEqual({ preco_modo: null, preco_centavos: null });
    expect(precoParaColunas({ modo: "sob_consulta", centavos: null })).toEqual({
      preco_modo: "sob_consulta",
      preco_centavos: null,
    });
    expect(precoDeColunas("fixo", "1250")).toEqual({ modo: "fixo", centavos: 1250 });
    expect(precoDeColunas("fixo", null)).toBeNull();
    expect(precoDeColunas("fixo", 0)).toBeNull();
    expect(precoDeColunas(null, null)).toBeNull();
  });
});
