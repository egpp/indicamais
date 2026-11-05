import { afterEach, describe, expect, it, vi } from "vitest";
import {
  criarEnviadorDoAmbiente,
  criarEnviadorResend,
  ERRO_EMAIL,
  lerConfigResend,
  URL_API_RESEND,
} from "./enviador-resend";

const CHAVE = "re_chave_secreta_123";
const EMAIL = { para: "dono@exemplo.com.br", assunto: "Assunto", texto: "Corpo do aviso" };

function fetchCom(status: number) {
  return vi.fn(async () => new Response("{}", { status }));
}

afterEach(() => vi.restoreAllMocks());

describe("enviador Resend", () => {
  it("sucesso: POST com Bearer, remetente, destinatário e Idempotency-Key", async () => {
    const f = fetchCom(200);
    const env = criarEnviadorResend({ chave: CHAVE, remetente: "IM <a@d.com>", fetchImpl: f });
    const r = await env.enviar({ ...EMAIL, chaveIdempotencia: "notificacao-contato/p1/0" });
    expect(r).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_API_RESEND);
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${CHAVE}`);
    expect(h["Idempotency-Key"]).toBe("notificacao-contato/p1/0");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "IM <a@d.com>",
      to: [EMAIL.para],
      subject: EMAIL.assunto,
      text: EMAIL.texto,
    });
  });

  it("sem chave de idempotência não envia o cabeçalho; chave longa é cortada em 256", async () => {
    const f = fetchCom(200);
    const env = criarEnviadorResend({ chave: CHAVE, remetente: "a@d.com", fetchImpl: f });
    await env.enviar(EMAIL);
    await env.enviar({ ...EMAIL, chaveIdempotencia: "x".repeat(400) });
    const h1 = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    const h2 = (f.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect("Idempotency-Key" in h1).toBe(false);
    expect(h2["Idempotency-Key"]).toHaveLength(256);
  });

  it("429 (limite diário/mensal/taxa) vira falha para nova tentativa, sem lançar", async () => {
    const env = criarEnviadorResend({
      chave: CHAVE,
      remetente: "a@d.com",
      fetchImpl: fetchCom(429),
    });
    expect(await env.enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.limite });
  });

  it("5xx, 401/403 e 4xx são falhas com erro fixo", async () => {
    const mk = (s: number) =>
      criarEnviadorResend({ chave: CHAVE, remetente: "a@d.com", fetchImpl: fetchCom(s) });
    expect(await mk(500).enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.indisponivel });
    expect(await mk(503).enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.indisponivel });
    expect(await mk(403).enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.autenticacao });
    expect(await mk(422).enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.rejeitado });
    expect(await mk(409).enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.conflito });
    expect(ERRO_EMAIL.conflito).not.toBe(ERRO_EMAIL.limite);
    expect(ERRO_EMAIL.conflito).not.toMatch(/resend/i);
  });

  it("timeout: o fetch recebe um sinal e o aborto vira falha 'tempo esgotado'", async () => {
    const f = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener("abort", () => rej(init.signal?.reason));
        }),
    );
    const env = criarEnviadorResend({
      chave: CHAVE,
      remetente: "a@d.com",
      fetchImpl: f as unknown as typeof fetch,
      timeoutMs: 20,
    });
    expect(await env.enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.tempo });
  });

  it("erro de rede vira falha controlada", async () => {
    const f = vi.fn(async () => {
      throw new TypeError(`falha ao ligar ${EMAIL.para} com ${CHAVE}`);
    });
    const env = criarEnviadorResend({
      chave: CHAVE,
      remetente: "a@d.com",
      fetchImpl: f as unknown as typeof fetch,
    });
    const r = await env.enviar(EMAIL);
    expect(r).toEqual({ ok: false, erro: ERRO_EMAIL.rede });
  });

  it("nada vaza: nem o resultado nem os logs trazem chave, e-mail ou conteúdo", async () => {
    const espioes = (["log", "error", "warn", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    for (const s of [200, 429, 500]) {
      const env = criarEnviadorResend({
        chave: CHAVE,
        remetente: "a@d.com",
        fetchImpl: vi.fn(
          async () => new Response(`{"message":"${EMAIL.para} ${CHAVE}"}`, { status: s }),
        ),
      });
      const r = await env.enviar(EMAIL);
      const txt = JSON.stringify(r);
      expect(txt).not.toContain(CHAVE);
      expect(txt).not.toContain(EMAIL.para);
      expect(txt).not.toContain(EMAIL.texto);
    }
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });
});

describe("configuração do ambiente", () => {
  it("sem chave (ou sem remetente) mantém o comportamento pendente, sem chamar a rede", async () => {
    const f = vi.fn();
    expect(lerConfigResend({})).toBeNull();
    expect(lerConfigResend({ EMAIL_API_KEY: "  ", EMAIL_FROM: "a@d.com" })).toBeNull();
    expect(lerConfigResend({ EMAIL_API_KEY: CHAVE })).toBeNull();
    const env = criarEnviadorDoAmbiente({}, f as unknown as typeof fetch);
    expect(await env.enviar(EMAIL)).toEqual({ ok: false, erro: ERRO_EMAIL.semConfiguracao });
    expect(f).not.toHaveBeenCalled();
  });

  it("com chave e remetente usa o Resend", async () => {
    const f = fetchCom(200);
    const env = criarEnviadorDoAmbiente(
      { EMAIL_API_KEY: CHAVE, EMAIL_FROM: "IM <a@d.com>" },
      f as unknown as typeof fetch,
    );
    expect(await env.enviar(EMAIL)).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
