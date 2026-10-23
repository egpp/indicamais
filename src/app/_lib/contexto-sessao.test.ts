import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({ auth: { getUser }, storage: {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { obterContexto } from "./contexto-sessao";

beforeEach(() => vi.clearAllMocks());

describe("obterContexto", () => {
  it("sem sessão leva a /entrar e volta para a tela pedida", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(obterContexto("/meus-perfis")).rejects.toThrow(
      "REDIRECT:/entrar?aviso=sessao&proximo=%2Fmeus-perfis",
    );
  });
});
