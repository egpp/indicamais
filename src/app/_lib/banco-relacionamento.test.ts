import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_RELACIONAMENTO, criarBancoRelacionamento } from "./banco-relacionamento";

function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const chamadas: { rpc: [string, unknown][]; selects: [string, string][] } = {
    rpc: [],
    selects: [],
  };
  const pronto = () => {
    if (lancar) throw new Error("rede caiu: segredo-interno");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const cliente = {
    rpc: (nome: string, args: unknown) => {
      chamadas.rpc.push([nome, args]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (tabela: string) => ({
      select: (colunas: string) => {
        chamadas.selects.push([tabela, colunas]);
        return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
      },
    }),
  };
  return { cliente: cliente as unknown as SupabaseClient<never>, chamadas };
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("adaptador do banco de relacionamento (sessão do usuário)", () => {
  it("lê as visões com colunas nomeadas, sem '*' e sem coluna de conta", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoRelacionamento(cliente as never);
    await banco.listarMeusMembros();
    await banco.lerMeuResumo();
    await banco.listarMinhasParticipacoes();
    expect(chamadas.selects.map((s) => s[0])).toEqual([
      "relacionamento_meus_membros",
      "relacionamento_meu_resumo",
      "relacionamento_minhas_participacoes",
    ]);
    for (const colunas of Object.values(COLUNAS_RELACIONAMENTO)) {
      expect(colunas).not.toContain("*");
      expect(colunas.split(", ")).not.toContain("conta_id");
    }
  });

  it("chama as RPCs certas com o parâmetro p_perfil_id", async () => {
    const { cliente, chamadas } = falso({ data: true });
    const banco = criarBancoRelacionamento(cliente as never);
    expect((await banco.curtir({ perfilId: ID })).dados).toBe(true);
    await banco.descurtir({ perfilId: ID });
    await banco.sairDaBase({ perfilId: ID });
    expect(chamadas.rpc).toEqual([
      ["relacionamento_curtir", { p_perfil_id: ID }],
      ["relacionamento_descurtir", { p_perfil_id: ID }],
      ["relacionamento_sair_da_base", { p_perfil_id: ID }],
    ]);
  });

  it("repassa só o código do erro e converte exceção em erro desconhecido", async () => {
    const a = falso({ error: { code: "P0429", message: "texto" } });
    const r = await criarBancoRelacionamento(a.cliente as never).curtir({ perfilId: ID });
    expect(r.erro?.code).toBe("P0429");
    const b = falso({}, true);
    const r2 = await criarBancoRelacionamento(b.cliente as never).curtir({ perfilId: ID });
    expect(r2.erro).toEqual({ code: "XX000" });
    expect(JSON.stringify(r2)).not.toContain("segredo-interno");
  });
});
