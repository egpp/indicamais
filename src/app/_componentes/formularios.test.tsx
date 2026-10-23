// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const acaoLenta = vi.fn(
  () => new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 200)),
);

vi.mock("../acoes-conta", () => ({
  cadastrar: (...a: unknown[]) => acaoLenta(...(a as [])),
  entrar: vi.fn(async () => ({})),
  entrarComGoogle: vi.fn(async () => ({})),
  redefinirSenha: vi.fn(async () => ({})),
  reenviarConfirmacao: vi.fn(async () => ({})),
  solicitarRecuperacao: vi.fn(async () => ({})),
  atualizarNome: vi.fn(async () => ({})),
  atualizarWhatsapp: vi.fn(async () => ({})),
}));

import { FormCadastro, FormWhatsapp } from "./formularios";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormCadastro", () => {
  it("tem rótulos, nome opcional e não pede WhatsApp (IM-009)", () => {
    render(<FormCadastro />);
    expect(screen.getByLabelText(/Nome/)).toBeTruthy();
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(screen.queryByLabelText(/WhatsApp/i)).toBeNull();
    expect(screen.queryByText(/apple/i)).toBeNull();
  });

  it("valida no navegador com o schema do módulo e não envia", async () => {
    const u = userEvent.setup();
    render(<FormCadastro />);
    await u.type(screen.getByLabelText("E-mail"), "invalido");
    await u.type(screen.getByLabelText("Senha"), "curta");
    await u.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("E-mail inválido.")).toBeTruthy();
    expect(screen.getByText(/pelo menos 8 caracteres/)).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-mail").getAttribute("aria-invalid")).toBe("true");
  });

  it("trava o botão durante o envio (IM-028)", async () => {
    const u = userEvent.setup();
    render(<FormCadastro />);
    await u.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await u.type(screen.getByLabelText("Senha"), "abcdefg1");
    await u.click(screen.getByRole("button", { name: "Criar conta" }));
    const botao = await screen.findByRole("button", { name: "Criando conta..." });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Criar conta" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(acaoLenta).toHaveBeenCalledTimes(1);
  });
});

describe("FormWhatsapp", () => {
  it("aplica a máscara brasileira ao digitar", async () => {
    const u = userEvent.setup();
    render(<FormWhatsapp whatsappAtual="" />);
    const campo = screen.getByLabelText("WhatsApp") as HTMLInputElement;
    await u.type(campo, "11999990001");
    expect(campo.value).toBe("(11) 99999-0001");
  });

  it("mostra erro do módulo para número inválido", async () => {
    const u = userEvent.setup();
    render(<FormWhatsapp whatsappAtual="" />);
    await u.type(screen.getByLabelText("WhatsApp"), "123");
    await u.click(screen.getByRole("button", { name: "Salvar WhatsApp" }));
    expect(await screen.findByText(/DDD e 8 ou 9 dígitos/)).toBeTruthy();
  });
});
