import { describe, expect, it } from "vitest";
import {
  atualizarWhatsappSchema,
  cadastroSchema,
  loginSchema,
  redefinirSenhaSchema,
  reenviarConfirmacaoSchema,
  solicitarRecuperacaoSchema,
} from "./index";

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe("cadastroSchema (IM-007)", () => {
  it("aceita e normaliza e-mail", () => {
    const r = cadastroSchema.safeParse({ email: "  Ana@Exemplo.com ", senha: "senha1234" });
    expect(r.success && r.data.email).toBe("ana@exemplo.com");
  });
  it("nome opcional, 1–80", () => {
    expect(cadastroSchema.safeParse({ email: "a@b.com", senha: "senha1234" }).success).toBe(true);
    expect(
      cadastroSchema.safeParse({ email: "a@b.com", senha: "senha1234", nomeExibicao: "Ana" })
        .success,
    ).toBe(true);
    expect(
      cadastroSchema.safeParse({
        email: "a@b.com",
        senha: "senha1234",
        nomeExibicao: "x".repeat(81),
      }).success,
    ).toBe(false);
    expect(
      cadastroSchema.safeParse({ email: "a@b.com", senha: "senha1234", nomeExibicao: "   " })
        .success,
    ).toBe(false);
  });
  it.each([
    ["curta1", "pelo menos 8"],
    ["somenteletras", "número"],
    ["12345678", "letra"],
  ])("senha %s rejeitada em pt-BR", (senha, trecho) => {
    const r = cadastroSchema.safeParse({ email: "a@b.com", senha });
    expect(r.success).toBe(false);
    expect(msg(r).join(" ")).toContain(trecho);
  });
  it("senha acima de 72 bytes rejeitada", () => {
    expect(cadastroSchema.safeParse({ email: "a@b.com", senha: "a1".repeat(40) }).success).toBe(
      false,
    );
  });
  it("e-mail inválido", () => {
    const r = cadastroSchema.safeParse({ email: "sem-arroba", senha: "senha1234" });
    expect(msg(r)).toContain("E-mail inválido.");
  });
  it("campos ausentes", () => {
    expect(msg(cadastroSchema.safeParse({}))).toEqual(
      expect.arrayContaining(["Informe o e-mail.", "Informe a senha."]),
    );
  });
});

describe("login, recuperação e reenvio (IM-007, IM-008)", () => {
  it("login não impõe composição de senha, exige não vazia", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "" }).success).toBe(false);
  });
  it("solicitar recuperação e reenviar confirmação só pedem e-mail", () => {
    expect(solicitarRecuperacaoSchema.safeParse({ email: "A@B.com" }).success).toBe(true);
    expect(reenviarConfirmacaoSchema.safeParse({ email: "nada" }).success).toBe(false);
  });
  it("redefinir senha exige regra e confirmação igual", () => {
    expect(
      redefinirSenhaSchema.safeParse({ novaSenha: "senha1234", confirmacao: "senha1234" }).success,
    ).toBe(true);
    const r = redefinirSenhaSchema.safeParse({ novaSenha: "senha1234", confirmacao: "outra1234" });
    expect(msg(r)).toContain("As senhas não conferem.");
    expect(
      redefinirSenhaSchema.safeParse({ novaSenha: "curta", confirmacao: "curta" }).success,
    ).toBe(false);
  });
});

describe("atualizarWhatsappSchema (IM-009)", () => {
  it("normaliza para E.164", () => {
    const r = atualizarWhatsappSchema.safeParse({ whatsapp: "(11) 99999-0001" });
    expect(r.success && r.data.whatsapp).toBe("+5511999990001");
  });
  it("rejeita número estrangeiro com mensagem pt-BR", () => {
    const r = atualizarWhatsappSchema.safeParse({ whatsapp: "+1 415 555 2671" });
    expect(r.success).toBe(false);
    expect(msg(r)[0]).toMatch(/brasileiro/);
  });
  it("rejeita ausente", () => {
    expect(atualizarWhatsappSchema.safeParse({}).success).toBe(false);
  });
});
