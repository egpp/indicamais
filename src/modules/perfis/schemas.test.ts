import { describe, expect, it } from "vitest";
import { camposPerfilSchema, novoPerfilSchema } from "./index";

const CONTA = "11111111-1111-4111-8111-111111111111";
/** Caminho opaco válido: perfil/<perfil_id>/<uuid>.<ext>; o uuid sai do rótulo (só para o teste). */
const P = (r: string, ext = "png") =>
  `perfil/${CONTA}/${
    "aaaaaaaa-aaaa-4aaa-8aaa-" +
    [...r]
      .map((c) => c.charCodeAt(0).toString(16))
      .join("")
      .padEnd(12, "0")
      .slice(0, 12)
  }.${ext}`;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const completo = {
  nome: "Padaria Pão Quente",
  descricaoBreve: "Pães e bolos fresquinhos todos os dias.",
  imagemPath: P("logo"),
  categoriaPrincipalId: A,
  categoriasSecundariasIds: [B, C],
  cidade: "Campinas",
  uf: "sp",
  whatsappComercial: "(19) 99999-0001",
  endereco: "Rua das Flores, 100",
  areasAtendidas: ["Centro", "Cambuí", "centro"],
  bannersPaths: [P("b1", "jpg")],
  fotosPaths: [P("f1", "jpg"), P("f2", "webp")],
  site: "meusite.com.br",
  informacoesSociais: "Atendemos também por encomenda.",
};

describe("schema do perfil (IM-011, IM-012, IM-016)", () => {
  it("aceita perfil completo e normaliza WhatsApp, UF, site e áreas", () => {
    const r = camposPerfilSchema.parse(completo);
    expect(r.whatsappComercial).toBe("+5519999990001");
    expect(r.uf).toBe("SP");
    expect(r.site).toBe("https://meusite.com.br");
    expect(r.areasAtendidas).toEqual(["Centro", "Cambuí"]);
  });

  it("tudo é opcional no rascunho; campos em branco viram null (limpar)", () => {
    expect(camposPerfilSchema.parse({})).toEqual({});
    const r = camposPerfilSchema.parse({
      nome: "  ",
      cidade: "",
      uf: " ",
      site: "",
      informacoesSociais: "",
      whatsappComercial: "",
    });
    expect(r).toEqual({
      nome: null,
      cidade: null,
      uf: null,
      site: null,
      informacoesSociais: null,
      whatsappComercial: null,
    });
  });

  it("descarta campos desconhecidos (situação, responsável, aprovação)", () => {
    const r = camposPerfilSchema.parse({
      nome: "Loja",
      situacao: "aprovada",
      responsavel_id: CONTA,
      publicado: true,
      versao_aprovada_id: A,
    });
    expect(r).toEqual({ nome: "Loja" });
  });

  it("recusa URL, domínio e @ nas informações sociais", () => {
    for (const t of ["https://instagram.com/loja", "instagram.com/loja", "@loja", "www.loja.com"]) {
      const r = camposPerfilSchema.safeParse({ informacoesSociais: t });
      expect(r.success, t).toBe(false);
    }
  });

  it("recusa a quarta categoria (mais de 2 secundárias) e repetidas", () => {
    expect(camposPerfilSchema.safeParse({ categoriasSecundariasIds: [A, B, C] }).success).toBe(
      false,
    );
    expect(
      camposPerfilSchema.safeParse({ categoriaPrincipalId: A, categoriasSecundariasIds: [B, C, D] })
        .success,
    ).toBe(false);
    expect(camposPerfilSchema.safeParse({ categoriasSecundariasIds: [] }).success).toBe(true);
    expect(camposPerfilSchema.safeParse({ categoriasSecundariasIds: ["x"] }).success).toBe(false);
  });

  it.each([
    ["UF inexistente", { uf: "XX" }],
    ["UF numérica", { uf: "12" }],
    ["WhatsApp fora do padrão", { whatsappComercial: "123" }],
    ["WhatsApp internacional", { whatsappComercial: "+1 415 555 0100" }],
    ["WhatsApp com letras", { whatsappComercial: "11 9999a-0001" }],
    ["nome longo", { nome: "n".repeat(81) }],
    ["descrição longa", { descricaoBreve: "d".repeat(281) }],
    ["cidade longa", { cidade: "c".repeat(81) }],
    ["endereço longo", { endereco: "e".repeat(201) }],
    ["21 áreas", { areasAtendidas: Array.from({ length: 21 }, (_, i) => `Área ${i}`) }],
    ["área muito longa", { areasAtendidas: ["a".repeat(61)] }],
    ["site de rede social", { site: "https://instagram.com/loja" }],
    ["site javascript", { site: "javascript:alert(1)" }],
    ["7 fotos", { fotosPaths: Array.from({ length: 7 }, (_, i) => P(`f${i}`, "jpg")) }],
    ["4 banners", { bannersPaths: Array.from({ length: 4 }, (_, i) => P(`b${i}`, "jpg")) }],
    ["foto repetida", { fotosPaths: [P("f", "jpg"), P("f", "jpg")] }],
    ["caminho de imagem solto", { imagemPath: "logo.png" }],
    ["caminho com ..", { imagemPath: `perfil/${CONTA}/../x.png` }],
    ["byte nulo no nome", { nome: "Loja\u0000" }],
  ])("recusa %s", (_n, entrada) => {
    expect(camposPerfilSchema.safeParse(entrada).success).toBe(false);
  });

  it("aceita até 6 fotos e 3 banners (D-006)", () => {
    expect(
      camposPerfilSchema.safeParse({
        fotosPaths: Array.from({ length: 6 }, (_, i) => P(`f${i}`, "jpg")),
        bannersPaths: Array.from({ length: 3 }, (_, i) => P(`b${i}`, "jpg")),
      }).success,
    ).toBe(true);
  });

  it("novo perfil exige nome ou slug", () => {
    expect(novoPerfilSchema.safeParse({}).success).toBe(false);
    expect(novoPerfilSchema.safeParse({ cidade: "Campinas" }).success).toBe(false);
    expect(
      novoPerfilSchema.safeParse({ nome: "Loja", whatsappComercial: "(19) 99999-0001" }).success,
    ).toBe(true);
    expect(
      novoPerfilSchema.safeParse({ slug: "minha-loja", whatsappComercial: "(19) 99999-0001" })
        .success,
    ).toBe(true);
    // WhatsApp comercial é obrigatório já no primeiro rascunho; imagens não entram na criação
    expect(novoPerfilSchema.safeParse({ nome: "Loja" }).success).toBe(false);
    expect(novoPerfilSchema.safeParse({ nome: "Loja", whatsappComercial: null }).success).toBe(
      false,
    );
    const r = novoPerfilSchema.parse({
      nome: "Loja",
      whatsappComercial: "(19) 99999-0001",
      imagemPath: P("x"),
      fotosPaths: [P("y")],
    });
    expect(r).not.toHaveProperty("imagemPath");
    expect(r).not.toHaveProperty("fotosPaths");
  });
});
