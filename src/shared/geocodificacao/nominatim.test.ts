import { describe, expect, it, vi } from "vitest";
import { criarGeocodificador } from "./nominatim";

const ENTRADA = { endereco: "Rua Segredo 123", cidade: "Campinas", uf: "SP" };
const json = (corpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status }));

function montar(resposta: () => Promise<Response>) {
  let t = 1_000_000;
  const esperas: number[] = [];
  const f = vi.fn((...args: [string, RequestInit?]) => {
    void args;
    return resposta();
  });
  const geo = criarGeocodificador({
    fetch: f as unknown as typeof fetch,
    agora: () => t,
    esperar: async (ms) => {
      esperas.push(ms);
      t += ms;
    },
    appUrl: "https://indicamais.example",
  });
  return { geo, f, esperas };
}

describe("geocodificarEndereco (Nominatim)", () => {
  it("resultado válido: converte lat/lon em número e monta a consulta", async () => {
    const { geo, f } = montar(() => json([{ lat: "-22.9056", lon: "-47.0608" }]));
    const r = await geo(ENTRADA);
    expect(r).toEqual({ ok: true, latitude: -22.9056, longitude: -47.0608 });
    const [url, init] = f.mock.calls[0]!;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(u.searchParams.get("format")).toBe("jsonv2");
    expect(u.searchParams.get("limit")).toBe("1");
    expect(u.searchParams.get("countrycodes")).toBe("br");
    const h = init!.headers as Record<string, string>;
    expect(h["User-Agent"]).toBe("IndicaMais/1.0 (https://indicamais.example)");
    expect(h["User-Agent"]).not.toContain("@");
  });

  it("sem resultado", async () => {
    const { geo } = montar(() => json([]));
    expect(await geo(ENTRADA)).toEqual({ ok: false, motivo: "sem_resultado" });
  });

  it("resposta malformada, lat/lon fora da faixa ou não numéricos: neutro", async () => {
    for (const corpo of [
      { erro: 1 },
      [{ lat: "abc", lon: "1" }],
      [{ lat: "91", lon: "1" }],
      [{ lat: "1", lon: "181" }],
      [{ lat: "", lon: "1" }],
      [{ lat: "NaN", lon: "1" }],
    ]) {
      const { geo } = montar(() => json(corpo));
      expect(await geo(ENTRADA)).toEqual({ ok: false, motivo: "indisponivel" });
    }
  });

  it("HTTP de erro e exceção de rede: neutro, sem lançar", async () => {
    expect(await montar(() => json({}, 429)).geo(ENTRADA)).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
    const { geo } = montar(() => Promise.reject(new Error("rede")));
    expect(await geo(ENTRADA)).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("timeout aborta a consulta", async () => {
    const f = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init!.signal!.addEventListener("abort", () => rej(new Error("abortado")));
        }),
    );
    const geo = criarGeocodificador({ fetch: f as unknown as typeof fetch, timeoutMs: 20 });
    expect(await geo(ENTRADA)).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("limitador: consultas seguidas esperam 1 s entre si", async () => {
    const { geo, f, esperas } = montar(() => json([{ lat: "-1", lon: "-1" }]));
    await Promise.all([geo(ENTRADA), geo(ENTRADA), geo(ENTRADA)]);
    expect(f).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([1000, 1000]);
  });

  it("entrada inválida não chama a rede", async () => {
    const { geo, f } = montar(() => json([]));
    expect(await geo({ ...ENTRADA, endereco: "  " })).toEqual({
      ok: false,
      motivo: "entrada_invalida",
    });
    expect(await geo({ ...ENTRADA, uf: "SPX" })).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("não registra endereço em log, nem em falha", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await montar(() => Promise.reject(new Error("Rua Segredo 123"))).geo(ENTRADA);
    await montar(() => json([{ lat: "x" }])).geo(ENTRADA);
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
    espioes.forEach((e) => e.mockRestore());
  });
});
