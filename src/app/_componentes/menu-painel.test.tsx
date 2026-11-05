// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../acoes-conta", () => ({ sair: vi.fn() }));

import { MenuPainel } from "./menu-painel";
import { gruposDoMenu, hrefAtivo, itensAdministracao } from "./menu-painel-dados";
import { PainelPagina } from "./painel";

beforeEach(() => window.history.pushState({}, "", "/"));
afterEach(() => cleanup());

const SEM_ACESSO = { geral: false, permissoes: [] } as const;

function menu(
  props: Partial<React.ComponentProps<typeof MenuPainel>> = {},
  acessoInicial: React.ComponentProps<typeof MenuPainel>["acessoInicial"] = SEM_ACESSO,
) {
  return render(
    <MenuPainel buscarAcesso={false} acessoInicial={acessoInicial} {...props}>
      <main>
        <h1>Conteúdo</h1>
      </main>
    </MenuPainel>,
  );
}

const grupo = (titulo: string) =>
  screen.getByText(titulo, { selector: "summary" }).closest("details") as HTMLDetailsElement;

describe("menu lateral do painel (D-015; IM-005, IM-014, IM-047)", () => {
  it("mostra os grupos iniciais e os itens de cada um", () => {
    menu();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    for (const t of ["Meu conteúdo", "Relacionamento", "Indicações e pontos", "Minha conta"])
      expect(within(nav).getByText(t, { selector: "summary" })).toBeTruthy();
    for (const t of [
      "Meus perfis",
      "Meus itens",
      "Meus anúncios",
      "Pedidos de contato",
      "Minhas participações",
      "Minhas indicações",
      "Quem me indicou",
      "Meus pontos",
      "Minhas comissões",
      "Avisos",
      "Política de privacidade",
    ])
      expect(within(nav).getByRole("link", { name: t })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("abre sozinho só o grupo da rota atual e destaca o item", () => {
    menu({ atual: "pontos" });
    expect(grupo("Indicações e pontos").open).toBe(true);
    expect(grupo("Meu conteúdo").open).toBe(false);
    expect(grupo("Relacionamento").open).toBe(false);
    expect(screen.getByRole("link", { name: "Meus pontos" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Avisos" }).getAttribute("aria-current")).toBeNull();
  });

  it("usa o endereço real para achar o item mais específico (Quem me indicou, não Avisos)", () => {
    window.history.pushState({}, "", "/avisos/quem-me-indicou");
    menu({ atual: "avisos" });
    expect(screen.getByRole("link", { name: "Quem me indicou" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Avisos" }).getAttribute("aria-current")).toBeNull();
  });

  it("sem permissão não existe grupo nem item de administração", () => {
    menu();
    expect(screen.queryByText("Administração", { selector: "summary" })).toBeNull();
    expect(document.querySelector('a[href^="/administracao"]')).toBeNull();
  });

  it("só com a permissão suspender aparece apenas Contas", () => {
    menu({}, { geral: false, permissoes: ["suspender"] });
    const g = grupo("Administração");
    expect(
      within(g)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Contas"]);
  });

  it("administrador geral vê as telas gerais, mas não as de permissão que não tem", () => {
    menu({}, { geral: true, permissoes: [] });
    const nomes = within(grupo("Administração"))
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(nomes).toContain("Fila de revisão");
    expect(nomes).toContain("Permissões");
    expect(nomes).not.toContain("Denúncias");
    expect(nomes).not.toContain("Contas");
  });

  it("abre o grupo de administração quando a tela é de administração", () => {
    menu({ atual: "administracao" }, { geral: true, permissoes: [] });
    expect(grupo("Administração").open).toBe(true);
  });

  it("botão de menu: rótulo, aria-expanded, aria-controls; Esc, fundo e navegação fecham", () => {
    menu();
    const botao = screen.getByRole("button", { name: "Abrir menu" });
    const painel = document.getElementById(botao.getAttribute("aria-controls") ?? "");
    expect(painel).toBeTruthy();
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(painel?.getAttribute("data-aberto")).toBe("false");

    fireEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(painel?.getAttribute("data-aberto")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar menu" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(botao);

    fireEvent.click(botao);
    fireEvent.click(document.querySelector(".painel-fundo") as Element);
    expect(botao.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(botao);
    const link = screen.getByRole("link", { name: "Meus perfis" });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    expect(botao.getAttribute("aria-expanded")).toBe("false");
  });

  it("setas movem o foco entre os itens visíveis", () => {
    menu({ atual: "perfis" });
    const resumo = screen.getByText("Meu conteúdo", { selector: "summary" });
    resumo.focus();
    fireEvent.keyDown(resumo, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Meus perfis" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(resumo);
  });

  it("PainelPagina mantém título e conteúdo ao lado do menu", () => {
    render(
      <PainelPagina titulo="Meus perfis" subtitulo="Algo" atual="perfis">
        <p>Corpo</p>
      </PainelPagina>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Meus perfis" })).toBeTruthy();
    expect(screen.getByText("Corpo")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy();
  });
});

describe("dados do menu", () => {
  it("itensAdministracao respeita geral e cada permissão", () => {
    expect(itensAdministracao(SEM_ACESSO)).toEqual([]);
    expect(
      itensAdministracao({
        geral: false,
        permissoes: ["analisar_denuncias", "invalidar_indicacoes"],
      }).map((i) => i.href),
    ).toEqual(["/administracao/denuncias", "/administracao/indicacoes"]);
    expect(itensAdministracao({ geral: true, permissoes: [] }).length).toBe(13);
  });

  it("hrefAtivo escolhe o prefixo mais longo e ignora rotas fora do menu", () => {
    const g = gruposDoMenu(SEM_ACESSO);
    expect(hrefAtivo("/meus-perfis/abc/beneficios", g)).toBe("/meus-perfis");
    expect(hrefAtivo("/avisos/quem-me-indicou", g)).toBe("/avisos/quem-me-indicou");
    expect(hrefAtivo("/avisos", g)).toBe("/avisos");
    expect(hrefAtivo("/", g)).toBeNull();
  });
});
