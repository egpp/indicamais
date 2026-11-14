// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDS_ESTILOS } from "./site/estilos";

vi.mock("./form-aparencia", () => ({
  FormHabilitarEstilo: ({ estilo, habilitar }: { estilo: string; habilitar: boolean }) => (
    <form data-testid={`form-${estilo}`} data-habilitar={String(habilitar)} />
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...r}>
      {children}
    </a>
  ),
}));

import {
  contarModelos,
  filtrarModelos,
  lerFiltro,
  montarModelos,
  rotuloContagem,
} from "./estilos-admin";
import { ListaModelos } from "./modelos-lista";

afterEach(() => cleanup());

const rotulos: Record<string, string> = {
  basico: "Básico",
  minimalista: "Minimalista",
  pet: "Pet",
};
const banco = IDS_ESTILOS.map((id) => ({
  id,
  rotulo: rotulos[id] ?? id,
  habilitado: id !== "pet" && id !== "moto_bike",
}));
const modelos = montarModelos(banco);

describe("lógica da tela de modelos", () => {
  it("numera 01..22 na ordem de IDS_ESTILOS e renomeia só o 22º na exibição", () => {
    expect(modelos).toHaveLength(22);
    expect(modelos[0]).toMatchObject({ numero: "01", id: "minimalista", padrao: true });
    expect(modelos[21]).toMatchObject({ numero: "22", nome: "Essencial — Plano Gratuito" });
  });
  it("conta total, habilitados e desabilitados", () => {
    expect(contarModelos(modelos)).toEqual({ total: 22, habilitados: 20, desabilitados: 2 });
  });
  it("filtra por situação e por nome sem diferenciar acento", () => {
    expect(filtrarModelos(modelos, "desabilitados", "")).toHaveLength(2);
    expect(filtrarModelos(modelos, "habilitados", "")).toHaveLength(20);
    expect(filtrarModelos(modelos, "todos", "ESSENCIAL")).toHaveLength(1);
    expect(filtrarModelos(modelos, "desabilitados", "pet").map((m) => m.id)).toEqual(["pet"]);
  });
  it("lê parâmetros inválidos como padrão e flexiona a contagem", () => {
    expect(lerFiltro("qualquer")).toBe("todos");
    expect(lerFiltro("habilitados")).toBe("habilitados");
    expect(rotuloContagem(1)).toBe("1 modelo encontrado");
    expect(rotuloContagem(22)).toBe("22 modelos encontrados");
  });
});

describe("ListaModelos", () => {
  it("mostra contadores, índice, prévias preguiçosas e imagem completa em nova aba", () => {
    render(<ListaModelos modelos={modelos} filtro="todos" busca="" />);
    expect(screen.getByText("Total").nextSibling?.textContent).toBe("22");
    expect(screen.getByRole("status").textContent).toBe("22 modelos encontrados");
    expect(screen.getByLabelText("Buscar modelo pelo nome")).toBeTruthy();
    const img = screen.getByAltText(/modelo 03, /);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("640");
    const ver = screen.getAllByRole("link", { name: /Ver imagem completa/ })[0]!;
    expect(ver.getAttribute("target")).toBe("_blank");
    expect(ver.getAttribute("href")).toBe("/modelos-sites/modelo-01.webp");
    const indice = screen.getByText("Ir para um modelo").closest("details")!;
    expect(within(indice).getAllByRole("link")).toHaveLength(22);
  });
  it("não oferece desabilitar o minimalista e oferece desabilitar nos demais habilitados", () => {
    render(<ListaModelos modelos={modelos} filtro="todos" busca="" />);
    expect(screen.getByText("O modelo padrão não pode ser desabilitado.")).toBeTruthy();
    expect(screen.queryByTestId("form-minimalista")).toBeNull();
    expect(screen.getByTestId("form-gastronomia").getAttribute("data-habilitar")).toBe("false");
  });
  it("modelo desabilitado e pronto oferece Habilitar modelo", () => {
    render(<ListaModelos modelos={modelos} filtro="desabilitados" busca="" />);
    expect(screen.getByRole("status").textContent).toBe("2 modelos encontrados");
    expect(screen.getAllByText("Habilitar modelo")).toHaveLength(2);
    expect(screen.getByTestId("form-pet").getAttribute("data-habilitar")).toBe("true");
  });
  it("modelo desabilitado sem desenho pronto não pode ser habilitado", () => {
    const m = modelos.map((x) => (x.id === "pet" ? { ...x, pronto: false } : x));
    render(<ListaModelos modelos={m} filtro="todos" busca="pet" />);
    expect(screen.queryByTestId("form-pet")).toBeNull();
    expect(screen.getByText("O desenho deste modelo ainda não está pronto.")).toBeTruthy();
  });
  it("busca sem resultado avisa", () => {
    render(<ListaModelos modelos={modelos} filtro="todos" busca="zzz" />);
    expect(screen.getByRole("status").textContent).toBe("0 modelos encontrados");
    expect(screen.getByText(/Nenhum modelo encontrado/)).toBeTruthy();
  });
});
