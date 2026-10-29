import { describe, expect, it } from "vitest";
import { FalhaLeituraPublica, criarLeituraPublica } from "./leitura-publica";

const falha = {
  dados: null,
  erro: { code: "XX000", message: "ECONNRESET postgres://segredo" },
};
const banco = (resposta: unknown) =>
  ({
    buscarPerfilPorSlug: async () => resposta,
    buscarPerfilPorId: async () => resposta,
    buscarItemPorId: async () => resposta,
    listarItensDoPerfil: async () => resposta,
  }) as never;

describe("leitura pública", () => {
  it("falha técnica do banco NÃO vira 404: lança erro sem texto do banco (vira 500)", async () => {
    const leitura = criarLeituraPublica(banco(falha));
    const e = await leitura.perfilPorSlug("loja").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(FalhaLeituraPublica);
    expect(String((e as Error).message)).not.toContain("postgres://");
    await expect(leitura.itemPorId("11111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(
      FalhaLeituraPublica,
    );
  });

  it("slug ou id de formato inválido nem chega ao banco", async () => {
    let chamadas = 0;
    const leitura = criarLeituraPublica({
      buscarPerfilPorSlug: async () => (chamadas++, { dados: null, erro: null }),
      buscarPerfilPorId: async () => (chamadas++, { dados: null, erro: null }),
      buscarItemPorId: async () => (chamadas++, { dados: null, erro: null }),
      listarItensDoPerfil: async () => (chamadas++, { dados: [], erro: null }),
    });
    expect(await leitura.perfilPorSlug("Slug Inválido")).toBeNull();
    expect(await leitura.perfilPorSlug("a".repeat(61))).toBeNull();
    expect(await leitura.itemPorId("1 or 1=1")).toBeNull();
    expect(chamadas).toBe(0);
  });
});
