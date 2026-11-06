import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { origemDoPedido, SegredoDeOrigemAusente } from "./origem-denuncia";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-caracteres";
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const pedido = h({ "cf-connecting-ip": "203.0.113.9", "user-agent": "Teste/1" });

describe("origem do pedido anônimo: HMAC com segredo do servidor (RSA-07, IM-076)", () => {
  it("é HMAC-SHA-256 hex (64) de contexto|IP|navegador, nunca o IP cru", async () => {
    const o = await origemDoPedido(pedido, "denuncia", { DENUNCIA_HASH_SEGREDO: SEGREDO });
    expect(o).toBe(
      createHmac("sha256", SEGREDO).update("denuncia|203.0.113.9|Teste/1").digest("hex"),
    );
    expect(o).toMatch(/^[0-9a-f]{64}$/);
    expect(o).not.toContain("203");
  });

  it("NÃO é o SHA-256 puro de IP+UA (o hash antigo, reversível por força bruta)", async () => {
    const o = await origemDoPedido(pedido, "denuncia", { DENUNCIA_HASH_SEGREDO: SEGREDO });
    const puro = createHash("sha256").update("203.0.113.9|Teste/1").digest("hex");
    expect(o).not.toBe(puro);
  });

  it("segredo diferente gera hash diferente (sem o segredo não se confirma um IP)", async () => {
    const a = await origemDoPedido(pedido, "denuncia", { DENUNCIA_HASH_SEGREDO: SEGREDO });
    const b = await origemDoPedido(pedido, "denuncia", { DENUNCIA_HASH_SEGREDO: SEGREDO + "x" });
    expect(a).not.toBe(b);
  });

  it("denúncia e contato não geram a mesma origem para o mesmo visitante", async () => {
    const env = { DENUNCIA_HASH_SEGREDO: SEGREDO };
    expect(await origemDoPedido(pedido, "denuncia", env)).not.toBe(
      await origemDoPedido(pedido, "contato", env),
    );
  });

  it("é estável para o mesmo IP e navegador, e muda com o IP", async () => {
    const env = { DENUNCIA_HASH_SEGREDO: SEGREDO };
    const outro = h({ "cf-connecting-ip": "203.0.113.10", "user-agent": "Teste/1" });
    expect(await origemDoPedido(pedido, "contato", env)).toBe(
      await origemDoPedido(pedido, "contato", env),
    );
    expect(await origemDoPedido(outro, "contato", env)).not.toBe(
      await origemDoPedido(pedido, "contato", env),
    );
  });

  it("sem IP não há origem (não junta todo mundo no mesmo balde)", async () => {
    expect(
      await origemDoPedido(h({}), "contato", { DENUNCIA_HASH_SEGREDO: SEGREDO }),
    ).toBeUndefined();
  });

  it("produção sem segredo (ou curto demais) falha de forma segura: lança, nunca grava hash fraco", async () => {
    await expect(
      origemDoPedido(pedido, "denuncia", { NODE_ENV: "production" }),
    ).rejects.toBeInstanceOf(SegredoDeOrigemAusente);
    await expect(
      origemDoPedido(pedido, "denuncia", {
        NODE_ENV: "production",
        DENUNCIA_HASH_SEGREDO: "curto",
      }),
    ).rejects.toBeInstanceOf(SegredoDeOrigemAusente);
    await expect(
      origemDoPedido(pedido, "contato", { APP_ENV: "production", DENUNCIA_HASH_SEGREDO: " " }),
    ).rejects.toBeInstanceOf(SegredoDeOrigemAusente);
  });

  it("fora de produção sem segredo: sem origem (o banco usa o balde único, o mais restritivo)", async () => {
    expect(await origemDoPedido(pedido, "denuncia", { NODE_ENV: "development" })).toBeUndefined();
    expect(await origemDoPedido(pedido, "denuncia", {})).toBeUndefined();
  });

  it("compatível com a limpeza de >30 dias: mesmo formato do CHECK do banco (64 hex minúsculos)", async () => {
    const o = await origemDoPedido(pedido, "denuncia", { DENUNCIA_HASH_SEGREDO: SEGREDO });
    expect(o).toMatch(/^[0-9a-f]{64}$/);
  });
});
