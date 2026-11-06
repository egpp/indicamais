import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * RSA-08, risco operacional: em produção (inclui o Worker de dev, NODE_ENV=production) sem NEXT_PUBLIC_APP_URL,
 * `origemDoApp()` lança. Estes testes registram como cada ação de conta reage a isso.
 */
const auth = {
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
};
vi.mock("@/shared/supabase/servidor", () => ({ criarClienteServidor: async () => ({ auth }) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "evil.example", "x-forwarded-host": "evil.example" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import {
  cadastrar,
  entrarComGoogle,
  reenviarConfirmacao,
  solicitarRecuperacao,
} from "./acoes-conta";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("origemDoApp ausente em produção nas Server Actions (RSA-08)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  const semUrl = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  };

  it("nenhuma ação envia e-mail nem usa o host forjado", async () => {
    semUrl();
    await cadastrar(
      {},
      form({ email: "a@b.com", senha: "Senha-forte-123", nomeExibicao: "Ana" }),
    ).catch(() => undefined);
    await solicitarRecuperacao({}, form({ email: "a@b.com" }));
    await reenviarConfirmacao({}, form({ email: "a@b.com" }));
    await entrarComGoogle({}, form({})).catch(() => undefined);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  // DEFEITO CONHECIDO (achado de verificação): cadastrar e entrarComGoogle não tratam a falha e a exceção sobe
  // como erro 500 genérico. it.fails passa enquanto o defeito existe; ao corrigir, troque por it.
  it.fails("cadastrar deveria devolver mensagem amigável em vez de lançar", async () => {
    semUrl();
    const r = await cadastrar(
      {},
      form({ email: "a@b.com", senha: "Senha-forte-123", nomeExibicao: "Ana" }),
    );
    expect(r.erro).toBeTruthy();
  });

  it.fails("entrarComGoogle deveria devolver mensagem amigável em vez de lançar", async () => {
    semUrl();
    const r = await entrarComGoogle({}, form({}));
    expect(r.erro).toBeTruthy();
  });

  // Recuperação e reenvio respondem sucesso neutro (IM-008) mesmo sem enviar nada: falha silenciosa.
  it("recuperação e reenvio devolvem sucesso neutro sem enviar e-mail (falha silenciosa)", async () => {
    semUrl();
    const a = await solicitarRecuperacao({}, form({ email: "a@b.com" }));
    const b = await reenviarConfirmacao({}, form({ email: "a@b.com" }));
    expect(a.sucesso).toBeTruthy();
    expect(b.sucesso).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
