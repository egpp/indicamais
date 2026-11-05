// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../acoes-indicacoes", () => ({ acaoEnviarContato: vi.fn(async () => ({})) }));

import { FormContato } from "./form-contato";
import { sacola } from "./site/sacola-estado";

afterEach(() => {
  act(() => sacola.limpar());
  cleanup();
});

describe("lista de interesse no pedido de contato (D-023, IM-013, IM-029)", () => {
  it("'Enviar a lista ao contato' copia a lista para o campo Mensagem, preservando o que o visitante escreveu", () => {
    render(<FormContato tipo="perfil" slug="loja-azul" chave={"c".repeat(20)} />);
    const campo = screen.getByLabelText(/Mensagem/) as HTMLTextAreaElement;
    expect(campo.value).toBe("");
    act(() => {
      sacola.adicionar("p1", { id: "a", nome: "Camiseta", escolhas: ["Tamanho: M"] });
    });
    // Adicionar não mexe no formulário: só o pedido explícito leva a lista.
    expect(campo.value).toBe("");
    act(() => sacola.levarAoContato());
    expect(campo.value).toContain("- 1x Camiseta (Tamanho: M)");
    expect(campo.value).not.toMatch(/R\$/);
    act(() => sacola.levarAoContato());
    expect(campo.value.match(/Camiseta/g)).toHaveLength(1);
  });
});
