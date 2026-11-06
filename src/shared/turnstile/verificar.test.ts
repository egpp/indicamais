import { describe, expect, it, vi } from "vitest";
import { LIMITES } from "../config/limites";
import { chaveDoSiteTurnstile, verificarTurnstile } from "./verificar";

/**
 * Chaves de teste OFICIAIS da Cloudflare (docs: Turnstile > Troubleshooting > Testing). Só aqui, nos testes:
 * o app nunca as embute. A rede é simulada; nenhuma chamada real.
 */
const SEGREDO_TESTE_PASSA = "1x0000000000000000000000000000000AA";
const SEGREDO_TESTE_FALHA = "2x0000000000000000000000000000000AA";

function resposta(corpo: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(corpo), { status }));
}

describe("verificarTurnstile (RSA-05, IM-076)", () => {
  it("token válido: confere com a Cloudflare no servidor, enviando chave, token e IP", async () => {
    const buscar = resposta({ success: true });
    const r = await verificarTurnstile(
      { token: "XXXX.DUMMY.TOKEN.XXXX", ip: "203.0.113.9" },
      { env: { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_PASSA }, buscar },
    );
    expect(r).toEqual({ ok: true, verificado: true });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(LIMITES.turnstile.urlVerificacao);
    expect(init.method).toBe("POST");
    const corpo = init.body as URLSearchParams;
    expect(corpo.get("secret")).toBe(SEGREDO_TESTE_PASSA);
    expect(corpo.get("response")).toBe("XXXX.DUMMY.TOKEN.XXXX");
    expect(corpo.get("remoteip")).toBe("203.0.113.9");
  });

  it("token recusado pela Cloudflare (inclusive repetido/vencido): inválido", async () => {
    const buscar = resposta({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(
      await verificarTurnstile(
        { token: "t" },
        { env: { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_FALHA }, buscar },
      ),
    ).toEqual({ ok: false, motivo: "invalido" });
  });

  it("sem token (ausente, vazio, só espaços ou não texto): ausente, e nem consulta a Cloudflare", async () => {
    const buscar = resposta({ success: true });
    const env = { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_PASSA };
    for (const token of [undefined, null, "", "   ", 42, new File([], "x")]) {
      expect(await verificarTurnstile({ token }, { env, buscar })).toEqual({
        ok: false,
        motivo: "ausente",
      });
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("token maior que o limite documentado (2048): inválido, sem consultar", async () => {
    const buscar = resposta({ success: true });
    const r = await verificarTurnstile(
      { token: "a".repeat(LIMITES.turnstile.tokenMax + 1) },
      { env: { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_PASSA }, buscar },
    );
    expect(r).toEqual({ ok: false, motivo: "invalido" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("Cloudflare fora do ar, erro HTTP, resposta fora do formato ou erro de chave: indisponível (nunca aprova)", async () => {
    const env = { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_PASSA };
    const caso = async (buscar: typeof fetch) =>
      verificarTurnstile({ token: "t" }, { env, buscar });
    expect(await caso(vi.fn(async () => Promise.reject(new Error("rede"))))).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
    expect(await caso(resposta({}, 500))).toEqual({ ok: false, motivo: "indisponivel" });
    expect(await caso(resposta({ foo: 1 }))).toEqual({ ok: false, motivo: "indisponivel" });
    expect(await caso(resposta("texto"))).toEqual({ ok: false, motivo: "indisponivel" });
    expect(
      await caso(resposta({ success: false, "error-codes": ["invalid-input-secret"] })),
    ).toEqual({ ok: false, motivo: "indisponivel" });
    expect(await caso(resposta({ success: false, "error-codes": ["internal-error"] }))).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
  });

  it("sem IP, não envia remoteip", async () => {
    const buscar = resposta({ success: true });
    await verificarTurnstile(
      { token: "t", ip: null },
      { env: { TURNSTILE_SECRET_KEY: SEGREDO_TESTE_PASSA }, buscar },
    );
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  describe("sem a chave secreta", () => {
    it("em produção: FALHA FECHADO, mesmo com token, e não consulta a rede", async () => {
      const buscar = resposta({ success: true });
      for (const env of [{ NODE_ENV: "production" }, { APP_ENV: "production" }]) {
        expect(await verificarTurnstile({ token: "qualquer" }, { env, buscar })).toEqual({
          ok: false,
          motivo: "nao_configurado",
        });
      }
      expect(buscar).not.toHaveBeenCalled();
    });

    it("chave só com espaços conta como ausente (produção continua fechada)", async () => {
      expect(
        await verificarTurnstile(
          { token: "x" },
          { env: { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "  " } },
        ),
      ).toEqual({ ok: false, motivo: "nao_configurado" });
    });

    it("fora de produção (dev e testes): dispensada e marcada como não verificada", async () => {
      const buscar = resposta({ success: true });
      expect(
        await verificarTurnstile({ token: "" }, { env: { NODE_ENV: "development" }, buscar }),
      ).toEqual({ ok: true, verificado: false });
      expect(await verificarTurnstile({}, { env: {}, buscar })).toEqual({
        ok: true,
        verificado: false,
      });
      expect(buscar).not.toHaveBeenCalled();
    });
  });

  it("chave do site: lida de NEXT_PUBLIC_TURNSTILE_SITE_KEY; vazia vira undefined", () => {
    expect(chaveDoSiteTurnstile({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: " 1x00 " })).toBe("1x00");
    expect(chaveDoSiteTurnstile({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: " " })).toBeUndefined();
    expect(chaveDoSiteTurnstile({})).toBeUndefined();
  });
});
