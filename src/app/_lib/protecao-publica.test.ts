import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.9" }),
}));

import { protegerFormularioPublico } from "./protecao-publica";

describe("protegerFormularioPublico: diagnóstico do segredo de origem", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("DENUNCIA_HASH_SEGREDO curto em produção: recusa e registra só o nome do motivo", async () => {
    const curto = "curto-demais-VALOR";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("DENUNCIA_HASH_SEGREDO", curto);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Sem chave do Turnstile em produção a verificação falha antes; use fetch simulado com sucesso.
    vi.stubEnv("TURNSTILE_SECRET_KEY", "chave-turnstile-SEGREDO");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true }))),
    );
    const f = new FormData();
    f.set("cf-turnstile-response", "TOKEN-XYZ");
    const r = await protegerFormularioPublico(f, "contato", "Recusado.");
    vi.unstubAllGlobals();
    expect(r).toEqual({ ok: false, erro: "Recusado." });
    const logs = aviso.mock.calls.map((c) => String(c[0]));
    expect(logs.map((l) => JSON.parse(l))).toContainEqual({
      evento: "protecao_publica_falha",
      motivo: "denuncia_hash_segredo_ausente_ou_curto",
    });
    for (const l of logs) {
      expect(l).not.toContain(curto);
      expect(l).not.toContain("TOKEN-XYZ");
      expect(l).not.toContain("chave-turnstile-SEGREDO");
      expect(l).not.toContain("203.0.113.9");
    }
  });
});
