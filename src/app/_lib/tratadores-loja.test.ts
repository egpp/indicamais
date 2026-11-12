import { describe, expect, it, vi } from "vitest";
import { criarServicoLojaAdmin, type ClienteBancoLojaAdmin } from "@/modules/administracao";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import type { ContextoLojaAdmin } from "./contexto-loja";
import { definirLiberacaoLoja } from "./tratadores-loja";

const P1 = "11111111-1111-4111-8111-111111111111";

function ctx(admin = true, erro: { code: string } | null = null) {
  const banco: ClienteBancoLojaAdmin = {
    ehAdministrador: vi.fn(async () => admin),
    consultarPerfis: vi.fn(async () => ({ dados: [], erro: null })),
    listarLiberacoes: vi.fn(async () => ({ dados: [], erro: null })),
    definirLiberacao: vi.fn(async () => ({ erro })),
  };
  const c: ContextoLojaAdmin = { loja: criarServicoLojaAdmin(banco) };
  return { c, banco };
}

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("tratador da liberação da Loja (administrador geral)", () => {
  it("liberar e retirar devolvem mensagem de sucesso e limpam o motivo", async () => {
    const { c } = ctx();
    const a = await definirLiberacaoLoja(
      c,
      form({ perfilId: P1, liberada: "true", motivo: "Teste" }),
    );
    expect(a.sucesso).toBe("Loja liberada para o site.");
    expect(a.valores?.motivo).toBe("");
    const b = await definirLiberacaoLoja(
      c,
      form({ perfilId: P1, liberada: "false", motivo: "Fim" }),
    );
    expect(b.sucesso).toBe("Loja retirada do site.");
  });

  it("sem motivo: erro por campo e nada vai ao banco", async () => {
    const { c, banco } = ctx();
    const r = await definirLiberacaoLoja(c, form({ perfilId: P1, liberada: "true", motivo: " " }));
    expect(r.sucesso).toBeUndefined();
    expect(r.erros?.motivo).toBeTruthy();
    expect(banco.definirLiberacao).not.toHaveBeenCalled();
  });

  it("quem não é administrador recebe erro e o banco não é chamado", async () => {
    const { c, banco } = ctx(false);
    const r = await definirLiberacaoLoja(c, form({ perfilId: P1, liberada: "true", motivo: "x" }));
    expect(r.erro).toMatch(/administrador/);
    expect(banco.definirLiberacao).not.toHaveBeenCalled();
  });

  it("site inexistente (P0002) vira aviso neutro", async () => {
    const { c } = ctx(true, { code: "P0002" });
    const r = await definirLiberacaoLoja(c, form({ perfilId: P1, liberada: "true", motivo: "x" }));
    expect(r.erro).toBe("Site não encontrado.");
  });
});
