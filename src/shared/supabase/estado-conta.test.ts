import { beforeEach, describe, expect, it, vi } from "vitest";
import { acessoPermitido, limparCacheEstado, TEMPO_CACHE_MS } from "./estado-conta";

const resposta = (permitido: boolean) => ({
  rpc: vi.fn().mockResolvedValue({ data: [{ o_acesso_permitido: permitido }], error: null }),
});

describe("estado-conta (IM-080, IM-081)", () => {
  beforeEach(() => limparCacheEstado());

  it("devolve falso para conta sem acesso e verdadeiro para conta ativa", async () => {
    expect(await acessoPermitido(resposta(false), "a", 0)).toBe(false);
    expect(await acessoPermitido(resposta(true), "b", 0)).toBe(true);
  });

  it("usa cache curto: uma consulta dentro do prazo, outra depois", async () => {
    const c = resposta(true);
    await acessoPermitido(c, "a", 0);
    await acessoPermitido(c, "a", TEMPO_CACHE_MS - 1);
    expect(c.rpc).toHaveBeenCalledTimes(1);
    await acessoPermitido(c, "a", TEMPO_CACHE_MS + 1);
    expect(c.rpc).toHaveBeenCalledTimes(2);
  });

  it("reativação vale depois do prazo do cache", async () => {
    expect(await acessoPermitido(resposta(false), "a", 0)).toBe(false);
    expect(await acessoPermitido(resposta(true), "a", TEMPO_CACHE_MS + 1)).toBe(true);
  });

  it("erro ou exceção não bloqueia e não grava cache", async () => {
    const erro = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    expect(await acessoPermitido(erro, "a", 0)).toBe(true);
    const lanca = { rpc: vi.fn().mockRejectedValue(new Error("x")) };
    expect(await acessoPermitido(lanca, "a", 1)).toBe(true);
    expect(await acessoPermitido(resposta(false), "a", 2)).toBe(false);
  });

  it("conta sem linha de estado é tratada como ativa", async () => {
    const vazio = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    expect(await acessoPermitido(vazio, "a", 0)).toBe(true);
  });
});
