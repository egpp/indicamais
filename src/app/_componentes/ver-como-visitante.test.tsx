// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ROTULO_VER_COMO_VISITANTE, VerComoVisitante } from "./ver-como-visitante";

afterEach(cleanup);

describe("VerComoVisitante", () => {
  it("link para a página inicial pública, em nova aba, seguro e com rótulo acessível", () => {
    render(<VerComoVisitante />);
    const a = screen.getByRole("link", { name: ROTULO_VER_COMO_VISITANTE });
    expect(ROTULO_VER_COMO_VISITANTE).toBe("Ver o site como visitante (abre em nova aba)");
    expect(a.getAttribute("href")).toBe("/");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
