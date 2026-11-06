// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampoTurnstile } from "./campo-turnstile";

type Opcoes = {
  sitekey: string;
  language: string;
  callback: (t: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

const render_ = vi.fn<(el: HTMLElement, o: Opcoes) => string>(() => "w1");
const reset = vi.fn();
const remove = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.turnstile = { render: render_ as never, reset, remove };
});
afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.unstubAllEnvs();
});

const campo = () => document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
const esperarRender = () => vi.waitFor(() => expect(render_).toHaveBeenCalledTimes(1));

describe("CampoTurnstile (RSA-05, IM-076)", () => {
  it("sem chave do site, em desenvolvimento: não mostra nada (o servidor dispensa a verificação)", () => {
    const { container } = render(<CampoTurnstile chaveDoSite={undefined} />);
    expect(container.innerHTML).toBe("");
    expect(render_).not.toHaveBeenCalled();
  });

  it("sem chave do site, em produção: avisa que está indisponível (o servidor recusa o envio)", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<CampoTurnstile chaveDoSite={undefined} />);
    expect(screen.getByRole("status").textContent).toMatch(
      /verificação de segurança está indisponível/i,
    );
  });

  it("com chave: grupo rotulado, widget em pt-BR e campo oculto vazio até o desafio ser resolvido", async () => {
    render(<CampoTurnstile chaveDoSite="chave-publica" />);
    await esperarRender();
    expect(screen.getByRole("group", { name: /verificação de segurança/i })).toBeTruthy();
    expect(render_.mock.calls[0]![1]).toMatchObject({
      sitekey: "chave-publica",
      language: "pt-br",
    });
    expect(campo()?.type).toBe("hidden");
    expect(campo()?.value).toBe("");
  });

  it("o token resolvido vai para o campo; expirado ou com erro, o campo é esvaziado", async () => {
    render(<CampoTurnstile chaveDoSite="chave-publica" />);
    await esperarRender();
    const o = render_.mock.calls[0]![1];
    act(() => o.callback("token-abc"));
    expect(campo()?.value).toBe("token-abc");
    act(() => o["expired-callback"]());
    expect(campo()?.value).toBe("");
    act(() => o.callback("token-2"));
    act(() => o["error-callback"]());
    expect(campo()?.value).toBe("");
    expect(screen.getByRole("alert").textContent).toMatch(/Recarregue a página/);
  });

  it("token é de uso único: a cada resposta do servidor o widget é reiniciado e o campo esvaziado", async () => {
    const { rerender } = render(<CampoTurnstile chaveDoSite="chave-publica" reiniciar={1} />);
    await esperarRender();
    act(() => render_.mock.calls[0]![1].callback("token-abc"));
    expect(reset).not.toHaveBeenCalled();
    rerender(<CampoTurnstile chaveDoSite="chave-publica" reiniciar={2} />);
    expect(reset).toHaveBeenCalledWith("w1");
    expect(campo()?.value).toBe("");
  });

  it("ao desmontar, remove o widget", async () => {
    const { unmount } = render(<CampoTurnstile chaveDoSite="chave-publica" />);
    await esperarRender();
    unmount();
    expect(remove).toHaveBeenCalledWith("w1");
  });
});
