import { afterEach, describe, expect, it, vi } from "vitest";

const cabecalhos = new Map<string, string>([
  ["x-forwarded-host", "evil.example"],
  ["host", "evil.example"],
]);
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => cabecalhos.get(k) ?? null }),
}));

import { origemDoApp } from "./origem";

describe("origemDoApp (RSA-08)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa NEXT_PUBLIC_APP_URL e ignora os cabeçalhos", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.exemplo.com.br/");
    expect(await origemDoApp()).toBe("https://app.exemplo.com.br");
  });

  it("em produção sem a variável falha e não usa x-forwarded-host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await expect(origemDoApp()).rejects.toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("fora de produção sem a variável usa o host do pedido", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(await origemDoApp()).toBe("https://evil.example");
  });
});
