// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopiarId } from "./copiar-id";

const ID = "0f8e7d6c-1234-4abc-9def-001122334455";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CopiarId", () => {
  it("mostra só 8 caracteres e copia o id completo com aviso aria-live", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopiarId id={ID} />);
    expect(screen.getByText("0f8e7d6c…")).toBeTruthy();
    expect(screen.queryByText(ID)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copiar id 0f8e7d6c" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Id copiado."));
    expect(writeText).toHaveBeenCalledWith(ID);
    expect(screen.queryByLabelText("Id completo para copiar")).toBeNull();
  });

  it("sem área de transferência, oferece campo somente leitura com o id completo", async () => {
    vi.stubGlobal("navigator", {});
    render(<CopiarId id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar id/ }));
    const campo = (await screen.findByLabelText("Id completo para copiar")) as HTMLInputElement;
    expect(campo.value).toBe(ID);
    expect(campo.readOnly).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/Selecione o id/);
  });

  it("permissão negada também cai no campo selecionável", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
    });
    render(<CopiarId id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar id/ }));
    expect(await screen.findByLabelText("Id completo para copiar")).toBeTruthy();
  });
});
