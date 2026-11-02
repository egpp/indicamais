// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarMapaUrls } from "@/modules/perfis";

const informar = vi.fn(async () => ({}));
vi.mock("../acoes-localizacao", () => ({
  acaoDefinirMostrarMapa: vi.fn(async () => ({})),
  acaoInformarCoordenadas: (...a: unknown[]) => informar(...(a as [])),
  acaoLocalizarNoMapa: vi.fn(async () => ({})),
  acaoRemoverCoordenadas: vi.fn(async () => ({})),
}));

import { SecaoMapa } from "./form-mapa";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  perfilId: "11111111-1111-4111-8111-111111111111",
  nome: "Padaria da Ana",
  mostrarMapa: false,
  latitude: null,
  longitude: null,
  urls: null,
  temEndereco: true,
};

describe("seção Mapa do painel (IM-018, IM-092)", () => {
  it("explica aprovação e OpenStreetMap, e tem interruptor com estado", () => {
    render(<SecaoMapa {...base} />);
    expect(
      screen.getByText(/só aparece na página depois que a versão do perfil for aprovada/),
    ).toBeTruthy();
    expect(screen.getAllByText(/OpenStreetMap/).length).toBeGreaterThan(0);
    const chave = screen.getByRole("switch", { name: /Mostrar mapa na minha página: desligado/ });
    expect(chave.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Localizar no mapa" })).toBeTruthy();
    expect(screen.queryByTitle(/Mapa da localização/)).toBeNull();
  });

  it("com coordenadas mostra a prévia e o botão de remover", () => {
    const urls = montarMapaUrls({ latitude: -9.665, longitude: -35.735 });
    render(<SecaoMapa {...base} mostrarMapa latitude={-9.665} longitude={-35.735} urls={urls} />);
    expect(screen.getByTitle("Mapa da localização de Padaria da Ana")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover coordenadas" })).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("sem endereço não oferece localizar e pede o preenchimento", () => {
    render(<SecaoMapa {...base} temEndereco={false} />);
    expect(screen.queryByRole("button", { name: "Localizar no mapa" })).toBeNull();
    expect(screen.getByText(/Preencha endereço, cidade e UF/)).toBeTruthy();
  });

  it("formulário de coordenadas valida no navegador e não envia valores ruins", async () => {
    const u = userEvent.setup();
    render(<SecaoMapa {...base} />);
    await u.click(screen.getByText("Informar coordenadas manualmente"));
    await u.type(screen.getByLabelText("Latitude"), "95");
    await u.type(screen.getByLabelText("Longitude"), "-35,7");
    await u.click(screen.getByRole("button", { name: "Salvar coordenadas" }));
    expect(await screen.findByText(/entre -90 e 90\./, { selector: ".erro-campo" })).toBeTruthy();
    expect(informar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Latitude").getAttribute("aria-invalid")).toBe("true");
  });
});
