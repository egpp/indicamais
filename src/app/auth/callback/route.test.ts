import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() };
vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({ auth }),
}));

import { GET } from "./route";

const chamar = (qs: string) => GET(new NextRequest(`http://localhost:3000/auth/callback?${qs}`));
const destino = (r: Response) =>
  new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search;

beforeEach(() => {
  vi.clearAllMocks();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("/auth/callback (IM-007, IM-008)", () => {
  it("confirmação de e-mail por token_hash vai para Minha conta", async () => {
    const r = await chamar("token_hash=abc&type=signup");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(destino(r)).toBe("/minha-conta");
  });

  it("recuperação vai para redefinir senha", async () => {
    const r = await chamar("token_hash=abc&type=recovery");
    expect(destino(r)).toBe("/redefinir-senha");
  });

  it("OAuth (code) respeita destino interno e ignora externo", async () => {
    expect(destino(await chamar("code=x&proximo=%2Fminha-conta"))).toBe("/minha-conta");
    expect(destino(await chamar("code=x&proximo=%2F%2Fevil.com"))).toBe("/minha-conta");
  });

  it("link inválido ou expirado volta para entrar com aviso fixo", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    expect(destino(await chamar("token_hash=abc&type=signup"))).toBe("/entrar?aviso=link_expirado");
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_disabled" } });
    expect(destino(await chamar("token_hash=abc&type=signup"))).toBe("/entrar?aviso=link_invalido");
    expect(destino(await chamar(""))).toBe("/entrar?aviso=link_invalido");
    expect(destino(await chamar("token_hash=abc&type=evil"))).toBe("/entrar?aviso=link_invalido");
  });

  it("link expirado vindo do Supabase usa aviso fixo e não reflete a URL", async () => {
    const q =
      "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    expect(destino(await chamar(q))).toBe("/entrar?aviso=link_expirado");
    expect(destino(await chamar("error=access_denied&error_code=outro"))).toBe(
      "/entrar?aviso=link_expirado",
    );
  });

  it("erro do provedor (ex.: Google desligado ou cancelado) não reflete texto da URL", async () => {
    const r = await chamar("error=access_denied&error_description=%3Cscript%3E");
    expect(destino(r)).toBe("/entrar?aviso=oauth");
  });
});

describe("/auth/callback conta suspensa (IM-080)", () => {
  it("user_banned no code (Google) leva à página neutra", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { code: "user_banned" } });
    expect(destino(await chamar("code=x"))).toBe("/conta-indisponivel");
  });
  it("user_banned no token_hash leva à página neutra", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "user_banned" } });
    expect(destino(await chamar("token_hash=a&type=recovery"))).toBe("/conta-indisponivel");
  });
  it("user_banned em error_code da URL leva à página neutra", async () => {
    expect(destino(await chamar("error=access_denied&error_code=user_banned"))).toBe(
      "/conta-indisponivel",
    );
  });
});
