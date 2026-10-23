import { describe, expect, it, vi } from "vitest";
import { criarBancoContas } from "./banco-contas";

type Resp = { data: unknown; error: unknown };

/** Fake encadeável do query builder do supabase-js. */
function fakeSupabase(resp: Resp, userId: string | null = "u1") {
  const chamadas: Record<string, unknown[]> = {};
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq"]) {
    builder[m] = vi.fn((...a: unknown[]) => {
      chamadas[m] = a;
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(async () => resp);
  const cliente = {
    from: vi.fn(() => builder),
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })) },
  };
  return { cliente: cliente as never, chamadas };
}

describe("adaptador ClienteBancoContas", () => {
  it("buscar: devolve a linha", async () => {
    const { cliente } = fakeSupabase({ data: { id: "u1" }, error: null });
    const r = await criarBancoContas(cliente).buscarMinhaConta();
    expect(r).toEqual({ dados: { id: "u1" }, erro: null });
  });

  it("atualizar: repassa code/message/details do Postgres", async () => {
    const { cliente } = fakeSupabase({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "contas_conta_whatsapp_unico"',
        details: "Key (whatsapp_e164)=(+5511999990001) already exists.",
        hint: "x",
      },
    });
    const r = await criarBancoContas(cliente).atualizarMinhaConta({
      whatsapp_e164: "+5511999990001",
    });
    expect(r.dados).toBeNull();
    expect(r.erro).toEqual({
      code: "23505",
      message: expect.stringContaining("contas_conta_whatsapp_unico"),
      details: expect.stringContaining("whatsapp_e164"),
    });
  });

  it("atualizar: zero linhas = dados nulos sem erro, filtrando pela própria conta", async () => {
    const { cliente, chamadas } = fakeSupabase({ data: null, error: null });
    const r = await criarBancoContas(cliente).atualizarMinhaConta({ nome_exibicao: "Ana" });
    expect(r).toEqual({ dados: null, erro: null });
    expect(chamadas.eq).toEqual(["id", "u1"]);
  });

  it("atualizar sem sessão não consulta o banco", async () => {
    const { cliente } = fakeSupabase({ data: { id: "x" }, error: null }, null);
    const r = await criarBancoContas(cliente).atualizarMinhaConta({ nome_exibicao: "Ana" });
    expect(r).toEqual({ dados: null, erro: null });
  });
});
