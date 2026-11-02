// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LinkPaginaPublica, hrefPerfilPublico } from "./link-pagina-publica";

afterEach(cleanup);

describe("LinkPaginaPublica", () => {
  it("publicado: link em nova aba, seguro e com rótulo acessível", () => {
    render(<LinkPaginaPublica nome="Padaria Sol" href={hrefPerfilPublico("padaria-sol")} />);
    const a = screen.getByRole("link", { name: /Ver página pública de Padaria Sol/ });
    expect(a.getAttribute("href")).toBe("/perfil/padaria-sol");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Ver página pública")).toBeTruthy();
  });

  it("não publicado: sem link, indica a situação", () => {
    render(<LinkPaginaPublica nome="Padaria Sol" href={null} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Ainda não publicado")).toBeTruthy();
  });
});
