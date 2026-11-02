// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sessao = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
  nome: null as string | null,
}));

vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: sessao.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { nome_exibicao: sessao.nome } }) }),
      }),
    }),
  }),
}));

// O setup global troca este módulo por um vazio; aqui usamos o real.
const { ContaDoMenu } = await vi.importActual<typeof import("./conta-do-menu")>("./conta-do-menu");
import { IdentificacaoConta } from "./identificacao-conta";

afterEach(() => cleanup());

describe("identificação da conta no menu (IM-005, IM-014)", () => {
  it("com nome: mostra nome e e-mail, rótulo acessível, sem botão nem link", async () => {
    sessao.user = { id: "u1", email: "ana@exemplo.com.br" };
    sessao.nome = "Ana Souza";
    render(await ContaDoMenu());
    const bloco = screen.getByRole("group", { name: "Conta: Ana Souza, ana@exemplo.com.br" });
    expect(bloco.textContent).toContain("Ana Souza");
    expect(bloco.textContent).toContain("ana@exemplo.com.br");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("sem nome: mostra só o e-mail", async () => {
    sessao.user = { id: "u1", email: "ana@exemplo.com.br" };
    sessao.nome = "  ";
    render(await ContaDoMenu());
    const bloco = screen.getByRole("group", { name: "Conta: ana@exemplo.com.br" });
    expect(bloco.querySelectorAll("p")).toHaveLength(1);
    expect(bloco.textContent).toBe("ana@exemplo.com.br");
  });

  it("sem sessão: não mostra nada", async () => {
    sessao.user = null;
    expect(await ContaDoMenu()).toBeNull();
  });

  it("texto longo: inteiro no title e no rótulo (o CSS corta com reticências)", () => {
    const nome = "Maria das Graças Albuquerque de Nascimento e Silva Sobrinho";
    const email = "maria.das.gracas.albuquerque.nascimento@empresa-exemplo.com.br";
    render(<IdentificacaoConta nome={nome} email={email} />);
    const bloco = screen.getByRole("group", { name: `Conta: ${nome}, ${email}` });
    expect(bloco.getAttribute("title")).toBe(`Conta: ${nome}, ${email}`);
  });
});
