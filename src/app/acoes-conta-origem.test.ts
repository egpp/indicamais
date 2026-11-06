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

  it("cadastrar devolve mensagem amigável, sem lançar nem enviar", async () => {
    semUrl();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await cadastrar(
      {},
      form({ email: "a@b.com", senha: "Senha-forte-123", nomeExibicao: "Ana" }),
    );
    expect(r.erro).toBe("Não foi possível iniciar agora. Tente de novo mais tarde.");
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(JSON.stringify(aviso.mock.calls)).toContain("config_origem_ausente");
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("a@b.com");
    aviso.mockRestore();
  });

  it("entrarComGoogle devolve mensagem amigável, sem lançar nem iniciar OAuth", async () => {
    semUrl();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await entrarComGoogle({}, form({}));
    expect(r.erro).toBe("Não foi possível iniciar agora. Tente de novo mais tarde.");
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(JSON.stringify(aviso.mock.calls)).toContain("config_origem_ausente");
    aviso.mockRestore();
  });

  it("recuperação e reenvio mantêm resposta neutra (IM-008) e registram a falha de configuração", async () => {
    semUrl();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const a = await solicitarRecuperacao({}, form({ email: "a@b.com" }));
    const b = await reenviarConfirmacao({}, form({ email: "a@b.com" }));
    expect(a.sucesso).toBeTruthy();
    expect(b.sucesso).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
    const log = JSON.stringify(aviso.mock.calls);
    expect(log).toContain("recuperar_senha");
    expect(log).toContain("reenviar_confirmacao");
    expect(log).toContain("config_origem_ausente");
    expect(log).not.toContain("a@b.com");
    aviso.mockRestore();
  });
});
