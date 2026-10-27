import { describe, expect, it } from "vitest";
import {
  SLUGS_RESERVADOS,
  candidatosDeSlug,
  gerarSlugDeNome,
  informacoesSociaisSchema,
  normalizarSite,
  pareceLinkOuRede,
  slugReservado,
  validarSlug,
} from "./index";

describe("slug (IM-011)", () => {
  it("gera slug do nome: minúsculas, sem acento, a-z0-9-", () => {
    expect(gerarSlugDeNome("Padaria Pão Quente & Cia")).toBe("padaria-pao-quente-e-cia");
    expect(gerarSlugDeNome("  Ótica  São José ")).toBe("otica-sao-jose");
  });
  it("nome que não rende 3 caracteres não gera slug", () => {
    expect(gerarSlugDeNome("Ab")).toBeNull();
    expect(gerarSlugDeNome("!!!")).toBeNull();
  });
  it("valida formato", () => {
    expect(validarSlug("padaria-pao-quente")).toEqual({ ok: true, slug: "padaria-pao-quente" });
    for (const ruim of [
      "Padaria",
      "pão",
      "a b c",
      "-abc",
      "abc-",
      "a--b",
      "ab",
      "a_b_c",
      "a/b",
      "a".repeat(61),
      "",
    ]) {
      const r = validarSlug(ruim);
      expect(r.ok, ruim).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("FORMATO");
    }
  });
  it.each([
    "entrar",
    "cadastro",
    "minha-conta",
    "auth",
    "api",
    "admin",
    "recuperar-senha",
    "redefinir-senha",
    "reenviar-confirmacao",
    "categorias",
    "perfil",
    "anuncio",
    "perfis",
    "anuncios",
    "_next",
  ])("reserva %s", (nome) => {
    const r = validarSlug(nome === "_next" ? "next" : nome);
    if (nome === "_next") {
      // "_" nem passa no formato; continua reservado na lista por segurança.
      expect(SLUGS_RESERVADOS.has("_next")).toBe(true);
    } else {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("RESERVADO");
    }
  });
  it("reserva ignora caixa e espaços", () => {
    expect(slugReservado(" ADMIN ")).toBe(true);
    expect(slugReservado("padaria")).toBe(false);
  });
  it("candidatos: base, -2, -3..., sem reservados", () => {
    expect(candidatosDeSlug("loja", 3)).toEqual(["loja", "loja-2", "loja-3"]);
    const c = candidatosDeSlug("admin", 3);
    expect(c).not.toContain("admin");
    expect(c[0]).toBe("admin-2");
    for (const s of candidatosDeSlug("a".repeat(60))) expect(s.length).toBeLessThanOrEqual(60);
  });
});

describe("informações sociais só texto (IM-012, D-006)", () => {
  it.each([
    "Siga a gente no Instagram: loja.bonita",
    "Atendimento de segunda a sexta, das 8h às 18h",
    "Atendemos no WhatsApp e por telefone",
    "Fundada em 2010. Equipe de 5 pessoas.",
  ])("aceita texto simples: %s", (t) => {
    expect(pareceLinkOuRede(t)).toBe(false);
    expect(informacoesSociaisSchema.safeParse(t).success).toBe(true);
  });
  it.each([
    "https://instagram.com/minhaloja",
    "http://exemplo.com",
    "www.minhaloja.com.br",
    "instagram.com/minhaloja",
    "facebook.com/minhaloja",
    "minhaloja.com",
    "wa.me/5511999990001",
    "t.me/canal",
    "bit.ly/abc",
    "@minhaloja",
    "Me siga: @minha_loja",
    "contato@loja",
    "//instagram",
    "HTTPS://X.COM/a",
    "loja.br",
  ])("recusa %s", (t) => {
    expect(pareceLinkOuRede(t)).toBe(true);
    const r = informacoesSociaisSchema.safeParse(t);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/sem links/);
  });
  it("limite de 500 caracteres e vazio vira null", () => {
    expect(informacoesSociaisSchema.safeParse("a".repeat(501)).success).toBe(false);
    expect(informacoesSociaisSchema.parse("   ")).toBeNull();
  });
  it("tudo que o app aceita passa no CHECK do banco (perfis_versao_sociais)", () => {
    const check = /(https?:|www\.|[a-z0-9]\.(com|net|org|br|me|io|link|app|gg|ly)([^a-z]|$))/i;
    for (const t of ["Atendimento 24h", "Fundada em 2010", "Siga no Instagram: loja"]) {
      expect(pareceLinkOuRede(t)).toBe(false);
      expect(check.test(t)).toBe(false);
    }
    // tudo que o CHECK recusa o app também recusa
    for (const t of ["http://a.b", "www.x", "x.com", "x.io!", "a.ly"]) {
      expect(check.test(t)).toBe(true);
      expect(pareceLinkOuRede(t)).toBe(true);
    }
  });
});

describe("site (IM-012)", () => {
  it("aceita https e http, e completa o esquema", () => {
    expect(normalizarSite("https://meusite.com.br", 200)).toEqual({
      ok: true,
      site: "https://meusite.com.br",
    });
    expect(normalizarSite("meusite.com.br/loja", 200)).toEqual({
      ok: true,
      site: "https://meusite.com.br/loja",
    });
    expect(normalizarSite("http://meusite.com", 200).ok).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "ftp://meusite.com",
    "data:text/html,x",
    "https://localhost",
    "https://usuario:senha@meusite.com",
    "meu site.com",
    "",
    "https://",
    "mailto:a@b.com",
  ])("recusa %j", (t) => {
    expect(normalizarSite(t, 200).ok).toBe(false);
  });
  it.each([
    "https://instagram.com/loja",
    "https://www.facebook.com/loja",
    "tiktok.com/@loja",
    "https://wa.me/5511999990001",
    "https://linktr.ee/loja",
    "https://m.youtube.com/c/loja",
    "https://bit.ly/x",
  ])("recusa link de rede social ou encurtador: %s", (t) => {
    const r = normalizarSite(t, 200);
    expect(r.ok).toBe(false);
  });
  it("não confunde domínio parecido com rede social", () => {
    expect(normalizarSite("https://minhainstagram.com.br", 200).ok).toBe(true);
    expect(normalizarSite("https://notfacebook.com", 200).ok).toBe(true);
  });
  it("respeita o tamanho máximo", () => {
    expect(normalizarSite(`https://meusite.com/${"a".repeat(200)}`, 200).ok).toBe(false);
  });
});
