import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "./destino";
import { classificarErroAuth } from "./erro-auth";
import {
  validarCadastro,
  validarLogin,
  validarNome,
  validarRedefinicao,
  validarWhatsapp,
} from "./validacao";

describe("caminhoSeguro (sem redirecionamento aberto)", () => {
  it("aceita caminhos internos", () => {
    expect(caminhoSeguro("/minha-conta")).toBe("/minha-conta");
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "evil", undefined, 5, "/a\nb"])(
    "rejeita %j",
    (v) => {
      expect(caminhoSeguro(v)).toBe("/minha-conta");
    },
  );
});

describe("classificarErroAuth", () => {
  it("classifica por code", () => {
    expect(classificarErroAuth({ code: "invalid_credentials" })).toBe("CREDENCIAIS");
    expect(classificarErroAuth({ code: "email_not_confirmed" })).toBe("NAO_CONFIRMADO");
    expect(classificarErroAuth({ code: "same_password" })).toBe("SENHA_IGUAL");
    expect(classificarErroAuth({ code: "weak_password" })).toBe("SENHA_FRACA");
    expect(classificarErroAuth({ code: "over_request_rate_limit" })).toBe("LIMITE");
    expect(classificarErroAuth({ status: 429 })).toBe("LIMITE");
    expect(classificarErroAuth({ code: "x" })).toBe("OUTRO");
    expect(classificarErroAuth(null)).toBe("OUTRO");
  });
});

describe("validação do navegador usa os schemas do módulo", () => {
  it("cadastro: nome opcional, senha e e-mail validados", () => {
    expect(validarCadastro({ email: "a@b.com", senha: "abcdefg1", nomeExibicao: "" })).toBeNull();
    const e = validarCadastro({ email: "x", senha: "curta" });
    expect(e?.email).toBe("E-mail inválido.");
    expect(e?.senha).toMatch(/pelo menos 8/);
  });
  it("login: senha obrigatória", () => {
    expect(validarLogin({ email: "a@b.com", senha: "" })?.senha).toBe("Informe a senha.");
  });
  it("redefinição: confirmação precisa conferir", () => {
    expect(
      validarRedefinicao({ novaSenha: "abcdefg1", confirmacao: "outra123" })?.confirmacao,
    ).toBe("As senhas não conferem.");
  });
  it("nome e WhatsApp", () => {
    expect(validarNome({ nomeExibicao: "  " })?.nomeExibicao).toMatch(/1 a 80/);
    expect(validarWhatsapp({ whatsapp: "(11) 99999-0001" })).toBeNull();
    expect(validarWhatsapp({ whatsapp: "(00) 1" })?.whatsapp).toBeTruthy();
  });
});
