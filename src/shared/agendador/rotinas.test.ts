import { describe, expect, it, vi } from "vitest";
import { executarRotinas, RETENCAO_TENTATIVAS_DIAS, type ClienteRotinas } from "./rotinas";

function cliente(opcoes: { falhaEm?: string; lanca?: string } = {}) {
  const lt = vi.fn().mockResolvedValue({ count: 4, error: null });
  const c = {
    rpc: vi.fn(async (nome: string) => {
      if (opcoes.lanca === nome) throw new Error("detalhe sensível");
      return opcoes.falhaEm === nome
        ? { data: null, error: { message: "detalhe sensível" } }
        : { data: 2, error: null };
    }),
    from: vi.fn(() => ({ delete: vi.fn(() => ({ lt })) })),
  };
  return { c: c as unknown as ClienteRotinas, rpc: c.rpc, lt };
}

describe("rotinas agendadas (IM-081)", () => {
  it("executa as rotinas com limite e limpa tentativas antigas", async () => {
    const { c, rpc, lt } = cliente();
    const agora = new Date("2026-11-01T12:00:00Z");
    const r = await executarRotinas(c, agora, () => {});
    expect(r).toEqual({
      contas_executar_encerramentos: 2,
      pontos_reprocessar_pendentes: 2,
      relacionamento_reprocessar_pendentes: 2,
      limpeza_denuncia_tentativa: 4,
    });
    expect(rpc).toHaveBeenCalledWith("contas_executar_encerramentos", { p_limite: 50 });
    const corte = new Date(agora.getTime() - RETENCAO_TENTATIVAS_DIAS * 86_400_000).toISOString();
    expect(lt).toHaveBeenCalledWith("criado_em", corte);
  });

  it("uma rotina que falha não impede as outras e o log só tem contagens", async () => {
    const { c } = cliente({
      falhaEm: "contas_executar_encerramentos",
      lanca: "pontos_reprocessar_pendentes",
    });
    const linhas: string[] = [];
    const r = await executarRotinas(c, new Date(), (l) => linhas.push(l));
    expect(r.contas_executar_encerramentos).toBe("falhou");
    expect(r.pontos_reprocessar_pendentes).toBe("falhou");
    expect(r.relacionamento_reprocessar_pendentes).toBe(2);
    expect(r.limpeza_denuncia_tentativa).toBe(4);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).not.toContain("sensível");
  });
});
