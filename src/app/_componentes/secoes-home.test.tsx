// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CardBusca, SecaoHome } from "@/modules/busca";
import { SecoesDaHome } from "./secoes-home";

afterEach(cleanup);

const card = (n: number): CardBusca => ({
  tipo: "perfil",
  id: `id-${n}`,
  slug: `perfil-${n}`,
  link: `/perfil/perfil-${n}`,
  nome: `Empresa ${n}`,
  descricaoCurta: "Descrição pública",
  imagemPath: null,
  categoria: null,
  cidade: "Tramandaí",
  uf: "RS",
  precoTexto: null,
  anuncioParticular: false,
  perfilLink: null,
});

const secao = (chave: SecaoHome["chave"], titulo: string, n: number): SecaoHome => ({
  chave,
  titulo,
  tipoItem: "perfil",
  itens: Array.from({ length: n }, (_, i) => card(i + 1)),
});

describe("SecoesDaHome (IM-095)", () => {
  it("não desenha nada sem seções nem com seção vazia", () => {
    const a = render(<SecoesDaHome secoes={[]} urls={{}} />);
    expect(a.container.innerHTML).toBe("");
    const b = render(<SecoesDaHome secoes={[secao("novidades", "Novidades", 0)]} urls={{}} />);
    expect(b.container.innerHTML).toBe("");
  });

  it("uma região nomeada pelo título por seção, com os cards e links públicos", () => {
    render(
      <SecoesDaHome
        secoes={[secao("novidades", "Novidades", 2), secao("mais_curtidos", "Mais curtidos", 1)]}
        urls={{}}
      />,
    );
    const regiao = screen.getByRole("region", { name: "Novidades" });
    expect(within(regiao).getAllByRole("listitem")).toHaveLength(2);
    expect(within(regiao).getByRole("link", { name: "Empresa 1" }).getAttribute("href")).toBe(
      "/perfil/perfil-1",
    );
    expect(screen.getByRole("region", { name: "Mais curtidos" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Novidades" })).toBeTruthy();
  });

  it("botões com rótulo e foco por teclado; sem rotação automática", () => {
    render(<SecoesDaHome secoes={[secao("novidades", "Novidades", 6)]} urls={{}} />);
    const proximo = screen.getByRole("button", { name: "Novidades: ver próximos" });
    const anterior = screen.getByRole("button", { name: "Novidades: ver anteriores" });
    expect(anterior.getAttribute("aria-disabled")).toBe("true");
    proximo.focus();
    expect(document.activeElement).toBe(proximo);
    const regiao = screen.getByRole("region", { name: "Novidades" });
    expect(regiao.getAttribute("tabindex")).toBe("0");
    // jsdom não faz layout: a setas chamam scrollBy sem quebrar.
    regiao.scrollBy = () => {};
    fireEvent.keyDown(regiao, { key: "ArrowRight" });
  });

  it("não expõe dado privado nem id interno no HTML", () => {
    const { container } = render(
      <SecoesDaHome secoes={[secao("novidades", "Novidades", 1)]} urls={{}} />,
    );
    expect(container.innerHTML).not.toContain("id-1");
    expect(container.innerHTML).not.toMatch(/whatsapp|e-mail|@/i);
  });
});
