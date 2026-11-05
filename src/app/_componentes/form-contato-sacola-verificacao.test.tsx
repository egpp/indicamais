// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const enviar = vi.fn(async (_estado: unknown, dados: FormData) => {
  void dados;
  return { sucesso: "Pedido enviado." };
});
vi.mock("../acoes-indicacoes", () => ({
  acaoEnviarContato: (e: unknown, d: FormData) => enviar(e, d),
}));

import { LIMITES } from "@/shared/config/limites";
import { FormContato } from "./form-contato";
import { PainelSacola } from "./site/painel-sacola";
import { sacola } from "./site/sacola-estado";

afterEach(() => {
  act(() => sacola.limpar());
  cleanup();
  enviar.mockClear();
});

describe("verificação independente da lista de interesse no formulário (D-023, IM-029, IM-041, IM-050)", () => {
  it("só os campos visíveis vão ao envio; a lista é esvaziada após o sucesso", async () => {
    render(
      <>
        <PainelSacola perfilId="p1" />
        <FormContato tipo="perfil" slug="loja-azul" chave={"c".repeat(20)} />
      </>,
    );
    act(() => {
      sacola.adicionar("p1", { id: "a", nome: "Camiseta", escolhas: ["Tamanho: M"] });
    });
    expect(screen.getByText(/Sua lista de interesse/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Enviar a lista ao contato/ }));
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: "Maria Souza" } });
    fireEvent.change(screen.getByLabelText(/Seu WhatsApp/), {
      target: { value: "(14) 99999-8888" },
    });
    const form = screen.getByRole("button", { name: /Enviar pedido de contato/ }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(enviar).toHaveBeenCalled());
    const dados = enviar.mock.calls[0]![1];
    expect([...dados.keys()].sort()).toEqual(
      ["chave", "email", "mensagem", "nome", "slug", "tipo", "whatsapp"].sort(),
    );
    const mensagem = String(dados.get("mensagem"));
    expect(mensagem).toContain("1x Camiseta (Tamanho: M)");
    expect(mensagem.length).toBeLessThanOrEqual(LIMITES.contato.mensagemMax);
    // Após o sucesso a lista do navegador é limpa (o painel some).
    await waitFor(() => expect(screen.queryByText(/Sua lista de interesse/)).toBeNull());
  });
});
