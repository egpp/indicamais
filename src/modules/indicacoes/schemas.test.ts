import { describe, expect, it } from "vitest";
import { enviarContatoSchema, gerarLinkSchema, normalizarWhatsappVisitante } from "./index";

const PERFIL = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const CHAVE = "chave-de-teste-0001";
const ZW = String.fromCodePoint(0x200b);
const BIDI = String.fromCodePoint(0x202e);
const BOM = String.fromCodePoint(0xfeff);
const LARGURA_TOTAL = (s: string) =>
  Array.from(s)
    .map((c) => String.fromCodePoint(c.codePointAt(0)! + 0xfee0))
    .join("");

describe("WhatsApp do visitante (IM-026, IM-005)", () => {
  it.each([
    ["(51) 99999-9999", "+5551999999999"],
    ["51999999999", "+5551999999999"],
    ["+5551999999999", "+5551999999999"],
    ["+55 (51) 99999-9999", "+5551999999999"],
    ["5551999999999", "+5551999999999"],
    ["  51 99999.9999  ", "+5551999999999"],
    ["(11) 3333-4444", "+551133334444"],
  ])("aceita %s", (entrada, esperado) => {
    expect(normalizarWhatsappVisitante(entrada)).toEqual({ ok: true, e164: esperado });
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["letras", "51 9999a-9999"],
    ["texto", "meu zap"],
    ["curto", "519999"],
    ["longo demais", "5199999999999999"],
    ["DDD inexistente", "(20) 99999-9999"],
    ["celular sem 9", "(51) 89999-9999"],
    ["país diferente", "+1 415 555 0100"],
    ["mais no meio", "51+99999999"],
    ["largura total", LARGURA_TOTAL("51999999999")],
    ["zero width no meio", `5199${ZW}9999999`],
    ["bidi", `${BIDI}51999999999`],
    ["BOM", `${BOM}51999999999`],
    ["tabulação", "51\t999999999"],
    ["quebra de linha", "51999\n999999"],
    ["dígitos árabe-índicos", "٥١٩٩٩٩٩٩٩٩٩"],
    ["texto gigante", "5".repeat(500)],
  ])("rejeita: %s", (_nome, entrada) => {
    expect(normalizarWhatsappVisitante(entrada).ok).toBe(false);
  });

  it("rejeita valores que não são texto", () => {
    expect(normalizarWhatsappVisitante(null).ok).toBe(false);
    expect(normalizarWhatsappVisitante(51999999999).ok).toBe(false);
    expect(normalizarWhatsappVisitante(undefined).ok).toBe(false);
  });
});

const base = {
  perfilId: PERFIL,
  nome: "Maria Souza",
  whatsapp: "(51) 99999-9999",
  chave: CHAVE,
};

describe("enviarContatoSchema (IM-026, IM-028)", () => {
  it("normaliza e aceita o mínimo", () => {
    const r = enviarContatoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.whatsapp).toBe("+5551999999999");
      expect(r.data.email).toBeUndefined();
      expect(r.data.mensagem).toBeUndefined();
      expect(r.data.codigo).toBeUndefined();
    }
  });

  it("e-mail e mensagem vazios viram ausentes; aparam espaços", () => {
    const r = enviarContatoSchema.parse({
      ...base,
      nome: "  Maria  ",
      email: "  ",
      mensagem: "",
    });
    expect(r.nome).toBe("Maria");
    expect(r.email).toBeUndefined();
    expect(r.mensagem).toBeUndefined();
  });

  it("destino: exatamente um (perfil XOR item)", () => {
    expect(enviarContatoSchema.safeParse({ ...base, perfilId: undefined }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, itemId: ITEM }).success).toBe(false);
    expect(
      enviarContatoSchema.safeParse({ ...base, perfilId: undefined, itemId: ITEM }).success,
    ).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, perfilId: "nao-uuid" }).success).toBe(false);
  });

  it("nome: 2 a 80, sem invisíveis", () => {
    expect(enviarContatoSchema.safeParse({ ...base, nome: "A" }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, nome: "Al" }).success).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, nome: "a".repeat(80) }).success).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, nome: "a".repeat(81) }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, nome: `Ma${ZW}ria` }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, nome: `Ma${BIDI}ria` }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, nome: "Ma\nria" }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, nome: 123 }).success).toBe(false);
  });

  it("e-mail: formato e até 254", () => {
    expect(enviarContatoSchema.safeParse({ ...base, email: "maria@exemplo.com" }).success).toBe(
      true,
    );
    expect(enviarContatoSchema.safeParse({ ...base, email: "maria@exemplo" }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, email: "ma ria@exemplo.com" }).success).toBe(
      false,
    );
    const longo = `${"a".repeat(245)}@ex.com`;
    expect(longo.length).toBeGreaterThan(250);
    expect(enviarContatoSchema.safeParse({ ...base, email: longo }).success).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, email: `${longo}mmm` }).success).toBe(false);
  });

  it("mensagem: até 1000, aceita quebra de linha, recusa invisíveis", () => {
    expect(enviarContatoSchema.safeParse({ ...base, mensagem: "a".repeat(1000) }).success).toBe(
      true,
    );
    expect(enviarContatoSchema.safeParse({ ...base, mensagem: "a".repeat(1001) }).success).toBe(
      false,
    );
    expect(enviarContatoSchema.safeParse({ ...base, mensagem: "Oi\nTudo bem?" }).success).toBe(
      true,
    );
    expect(enviarContatoSchema.safeParse({ ...base, mensagem: `Oi${ZW}` }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, mensagem: "Oi\u0000" }).success).toBe(false);
  });

  it("chave de idempotência: 16 a 100, só [A-Za-z0-9_-]", () => {
    expect(enviarContatoSchema.safeParse({ ...base, chave: "a".repeat(15) }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, chave: "a".repeat(16) }).success).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, chave: "a".repeat(100) }).success).toBe(true);
    expect(enviarContatoSchema.safeParse({ ...base, chave: "a".repeat(101) }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, chave: `${"a".repeat(16)} x` }).success).toBe(
      false,
    );
    expect(enviarContatoSchema.safeParse({ ...base, chave: undefined }).success).toBe(false);
    expect(enviarContatoSchema.safeParse({ ...base, chave: crypto.randomUUID() }).success).toBe(
      true,
    );
  });

  it("código de link malformado é descartado sem recusar o contato (IM-025)", () => {
    const ok = "0123456789abcdef0123456789abcdef";
    expect(enviarContatoSchema.parse({ ...base, codigo: ok }).codigo).toBe(ok);
    expect(enviarContatoSchema.parse({ ...base, codigo: "XYZ" }).codigo).toBeUndefined();
    expect(enviarContatoSchema.parse({ ...base, codigo: ok.toUpperCase() }).codigo).toBeUndefined();
    expect(enviarContatoSchema.parse({ ...base, codigo: 42 }).codigo).toBeUndefined();
  });
});

describe("gerarLinkSchema (IM-024)", () => {
  it("perfil exige slug; item não", () => {
    expect(gerarLinkSchema.safeParse({ tipo: "perfil", id: PERFIL }).success).toBe(false);
    expect(gerarLinkSchema.safeParse({ tipo: "perfil", id: PERFIL, slug: "Loja X!" }).success).toBe(
      false,
    );
    expect(gerarLinkSchema.safeParse({ tipo: "perfil", id: PERFIL, slug: "loja-x" }).success).toBe(
      true,
    );
    expect(gerarLinkSchema.safeParse({ tipo: "item", id: ITEM }).success).toBe(true);
    expect(gerarLinkSchema.safeParse({ tipo: "outro", id: ITEM }).success).toBe(false);
  });
});
