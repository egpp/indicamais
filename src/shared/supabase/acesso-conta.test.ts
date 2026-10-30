import { describe, expect, it, vi } from "vitest";
import { bloquearAcessoNoAuth, DURACAO_BLOQUEIO, liberarAcessoNoAuth } from "./acesso-conta";

const ID = "3f2b8c1e-6a4d-4e7b-9c0a-1d2e3f4a5b6c";

describe("acesso-conta (IM-080)", () => {
  it("bloqueia com ban_duration longa", async () => {
    const admin = { updateUserById: vi.fn().mockResolvedValue({ error: null }) };
    expect(await bloquearAcessoNoAuth(ID, admin)).toEqual({ ok: true });
    expect(admin.updateUserById).toHaveBeenCalledWith(ID, { ban_duration: DURACAO_BLOQUEIO });
  });

  it("libera com ban_duration none", async () => {
    const admin = { updateUserById: vi.fn().mockResolvedValue({ error: null }) };
    expect(await liberarAcessoNoAuth(ID, admin)).toEqual({ ok: true });
    expect(admin.updateUserById).toHaveBeenCalledWith(ID, { ban_duration: "none" });
  });

  it("recusa id inválido sem chamar a API", async () => {
    const admin = { updateUserById: vi.fn() };
    expect(await bloquearAcessoNoAuth("x", admin)).toEqual({ ok: false, motivo: "conta_invalida" });
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it("falha da API ou exceção vira falha genérica, sem vazar a mensagem", async () => {
    const comErro = { updateUserById: vi.fn().mockResolvedValue({ error: new Error("segredo") }) };
    expect(await bloquearAcessoNoAuth(ID, comErro)).toEqual({ ok: false, motivo: "falha" });
    const lanca = { updateUserById: vi.fn().mockRejectedValue(new Error("segredo")) };
    expect(await liberarAcessoNoAuth(ID, lanca)).toEqual({ ok: false, motivo: "falha" });
  });
});
