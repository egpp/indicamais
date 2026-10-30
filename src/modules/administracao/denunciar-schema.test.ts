import { describe, expect, it } from "vitest";
import { denunciarSchema } from "./index";

const base = {
  alvoTipo: "perfil",
  alvoId: "11111111-1111-4111-8111-111111111111",
  tipo: "spam_fraude",
};
const analisar = (extra: Record<string, unknown>) =>
  denunciarSchema.safeParse({ ...base, ...extra });

describe("denunciarSchema: campos opcionais (IM-076)", () => {
  it("aceita sem texto e sem origem", () => {
    expect(analisar({}).success).toBe(true);
  });
  it.each(["", "   ", null])("texto %j vira undefined", (v) => {
    const r = analisar({ texto: v });
    expect(r.success).toBe(true);
    expect(r.data?.texto).toBeUndefined();
  });
  it.each(["", "  ", null])("origem %j vira undefined", (v) => {
    const r = analisar({ origem: v });
    expect(r.success).toBe(true);
    expect(r.data?.origem).toBeUndefined();
  });
  it("mantém texto válido aparado", () => {
    expect(analisar({ texto: "  golpe  " }).data?.texto).toBe("golpe");
  });
  it("recusa texto longo", () => {
    expect(analisar({ texto: "a".repeat(501) }).success).toBe(false);
  });
  it("recusa texto com caractere de controle", () => {
    expect(analisar({ texto: "a\u0000b" }).success).toBe(false);
  });
  it("recusa origem que não é hash de 64 hex", () => {
    expect(analisar({ origem: "1.2.3.4" }).success).toBe(false);
    expect(analisar({ origem: "A".repeat(64) }).success).toBe(false);
  });
  it("aceita origem hash e honeypot preenchido continua aceito pelo schema", () => {
    expect(analisar({ origem: "a".repeat(64) }).data?.origem).toBe("a".repeat(64));
    expect(analisar({ site: "x" }).data?.site).toBe("x");
  });
});
