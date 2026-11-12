import { describe, expect, it, vi } from "vitest";
import * as s from "../scripts/trocar-email-teste.mjs";

describe("trocar-email-teste: argumentos", () => {
  it("aceita dois e-mails válidos", () => {
    expect(s.validarArgumentos(["Dono@Example.com", "novo@example.com.br"])).toEqual({
      ok: true,
      atual: "dono@example.com",
      novo: "novo@example.com.br",
    });
  });
  it("recusa quantidade errada, e-mail inválido e iguais", () => {
    expect(s.validarArgumentos([]).ok).toBe(false);
    expect(s.validarArgumentos(["a@b.com"]).ok).toBe(false);
    expect(s.validarArgumentos(["a@b.com", "x", "y"]).ok).toBe(false);
    expect(s.validarArgumentos(["a", "b@c.com"]).ok).toBe(false);
    expect(s.validarArgumentos(["a@b.com", "b@c"]).ok).toBe(false);
    expect(s.validarArgumentos(["a@b.com", "A@B.com"]).ok).toBe(false);
  });
});

describe("trocar-email-teste: só dev", () => {
  it("aceita só a URL do projeto de dev", () => {
    expect(s.urlEhDeDev("https://qheleouixleltfjtccji.supabase.co")).toBe(true);
    expect(s.urlEhDeDev("https://outroprojeto.supabase.co")).toBe(false);
    expect(s.urlEhDeDev("http://qheleouixleltfjtccji.supabase.co")).toBe(false);
    expect(s.urlEhDeDev("https://qheleouixleltfjtccji.supabase.co.evil.com")).toBe(false);
    expect(s.urlEhDeDev("https://evil.com/qheleouixleltfjtccji")).toBe(false);
    expect(s.urlEhDeDev("")).toBe(false);
  });
});

function falso(users: { id: string; email: string }[]) {
  const update = vi.fn().mockResolvedValue({ error: null });
  const admin = {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
        updateUserById: update,
      },
    },
  };
  return { admin, update };
}

describe("trocar-email-teste: troca (sem rede)", () => {
  it("troca quando existe 1 conta e o novo está livre", async () => {
    const { admin, update } = falso([{ id: "u1", email: "dono@example.com" }]);
    const r = await s.trocarEmail(admin, "dono@example.com", "novo@example.com");
    expect(r).toEqual({ ok: true, mensagem: "e-mail trocado" });
    expect(update).toHaveBeenCalledWith("u1", { email: "novo@example.com", email_confirm: true });
  });
  it("recusa conta inexistente, duplicada e novo já usado", async () => {
    let f = falso([]);
    expect((await s.trocarEmail(f.admin, "a@b.com", "n@b.com")).ok).toBe(false);
    f = falso([
      { id: "1", email: "a@b.com" },
      { id: "2", email: "A@b.com" },
    ]);
    expect((await s.trocarEmail(f.admin, "a@b.com", "n@b.com")).ok).toBe(false);
    f = falso([
      { id: "1", email: "a@b.com" },
      { id: "2", email: "n@b.com" },
    ]);
    expect((await s.trocarEmail(f.admin, "a@b.com", "n@b.com")).ok).toBe(false);
    expect(f.update).not.toHaveBeenCalled();
  });
});
