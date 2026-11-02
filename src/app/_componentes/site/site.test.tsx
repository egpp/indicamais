// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gruposDoMenu, hrefAtivo } from "../menu-painel-dados";
import { CarrosselBanner } from "./carrossel-banner";
import {
  ESTILO_PADRAO,
  IDS_ESTILOS,
  LISTA_TEMAS,
  TEMAS,
  estiloLiberadoOuNulo,
  resolverEstilo,
} from "./estilos";
import { MenuSite } from "./menu-site";
import { MiniaturaEstilo } from "./miniatura-estilo";
import { linkComoChegar } from "./site-negocio";

vi.mock("next/font/google", () => {
  const f = (o: { variable: string }) => ({ variable: o.variable, className: o.variable });
  return {
    Barlow: f,
    Barlow_Condensed: f,
    Cormorant_Garamond: f,
    Inter: f,
    Jost: f,
    Lato: f,
    Nunito: f,
    Playfair_Display: f,
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const IDS_ESPERADOS = [
  "minimalista",
  "saude_bem_estar",
  "beleza_estetica",
  "gastronomia",
  "cafe_padaria",
  "construcao_reformas",
  "automotivo",
  "juridico_contabil",
  "educacao_cursos",
  "pet",
  "moda_lojas",
  "fitness_esportes",
  "imobiliario",
  "tecnologia_assistencia",
  "casa_decoracao",
  "eventos_fotografia",
  "servicos_rapidos",
  "agro_campo",
  "turismo_hospedagem",
  "premium",
];

describe("mapa de estilos (D-016; IM-091)", () => {
  it("tem exatamente os 20 ids aprovados, cada um com tema", () => {
    expect([...IDS_ESTILOS]).toEqual(IDS_ESPERADOS);
    expect(Object.keys(TEMAS).sort()).toEqual([...IDS_ESPERADOS].sort());
    for (const t of LISTA_TEMAS) {
      expect(t.rotulo.length).toBeGreaterThan(0);
      expect(TEMAS[t.id]).toBe(t);
    }
  });

  it("libera só os 5 estilos iniciais", () => {
    expect(LISTA_TEMAS.filter((t) => t.liberado).map((t) => t.id)).toEqual([
      "minimalista",
      "saude_bem_estar",
      "beleza_estetica",
      "gastronomia",
      "construcao_reformas",
    ]);
  });

  it("estilo inválido, vazio, não liberado ou em lista cai em minimalista", () => {
    expect(ESTILO_PADRAO).toBe("minimalista");
    for (const v of [undefined, "", "xyz", "premium", "pet", ["gastronomia"], 5, null, "__proto__"])
      expect(resolverEstilo(v)).toBe("minimalista");
    expect(resolverEstilo("gastronomia")).toBe("gastronomia");
    expect(estiloLiberadoOuNulo("construcao_reformas")).toBe("construcao_reformas");
    expect(estiloLiberadoOuNulo("pet")).toBeNull();
    expect(estiloLiberadoOuNulo("xyz")).toBeNull();
  });
});

describe("miniaturas", () => {
  it("estilo liberado tem a classe do tema; 'em breve' é neutro, e ambas ficam escondidas do leitor de tela", () => {
    const { container, rerender } = render(<MiniaturaEstilo tema={TEMAS.gastronomia} />);
    expect(container.firstElementChild?.classList.contains("site-gastronomia")).toBe(true);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    rerender(<MiniaturaEstilo tema={TEMAS.premium} />);
    expect(container.firstElementChild?.classList.contains("st-mini-breve")).toBe(true);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("como chegar", () => {
  it("monta um link simples com o endereço codificado", () => {
    const h = linkComoChegar("Rua A, 10", "Maceió - AL");
    expect(h.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(h).toContain(encodeURIComponent("Rua A, 10, Maceió - AL"));
  });
});

describe("menu de âncoras do negócio (IM-092)", () => {
  const itens = [
    { id: "inicio", rotulo: "Início" },
    { id: "sobre", rotulo: "Sobre" },
    { id: "contato-site", rotulo: "Contato" },
  ];

  it("tem links para as seções, botão com aria-expanded e abre/fecha por clique e Esc", () => {
    render(<MenuSite nome="Padaria Sol" itens={itens} />);
    const nav = screen.getByRole("navigation", { name: "Seções de Padaria Sol" });
    expect(within(nav).getByRole("link", { name: "Sobre" }).getAttribute("href")).toBe("#sobre");
    expect(within(nav).getByRole("link", { name: "Contato" }).getAttribute("href")).toBe(
      "#contato-site",
    );
    const botao = within(nav).getByRole("button", { name: "Menu" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(botao.getAttribute("aria-controls")).toBe(
      nav.querySelector("ul")?.getAttribute("id") ?? "",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(botao);
  });

  it("marca a seção escolhida com aria-current e fecha o menu", () => {
    render(<MenuSite nome="Padaria Sol" itens={itens} />);
    const botao = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(botao);
    const link = screen.getByRole("link", { name: "Sobre" });
    fireEvent.click(link);
    expect(link.getAttribute("aria-current")).toBe("location");
    expect(screen.getByRole("link", { name: "Início" }).getAttribute("aria-current")).toBeNull();
    expect(botao.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("carrossel de banner (IM-093)", () => {
  const imagens = [
    { src: "/a.jpg", alt: "Banner 1 de Teste" },
    { src: "/b.jpg", alt: "Banner 2 de Teste" },
    { src: "/c.jpg", alt: "Banner 3 de Teste" },
  ];

  function movimento(reduzir: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((q: string) => ({
        matches: reduzir && q.includes("reduce"),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
  }
  beforeEach(() => movimento(false));
  afterEach(() => vi.unstubAllGlobals());

  it("é uma região de carrossel com slides 'N de M', imagens com alt e só o atual disponível", () => {
    render(<CarrosselBanner imagens={imagens} rotulo="Banners de Teste" />);
    const regiao = screen.getByRole("region", { name: "Banners de Teste" });
    expect(regiao.getAttribute("aria-roledescription")).toBe("carrossel");
    const slides = regiao.querySelectorAll('[aria-roledescription="slide"]');
    expect(slides).toHaveLength(3);
    expect(slides[0].getAttribute("aria-label")).toBe("1 de 3");
    expect(slides[0].getAttribute("aria-hidden")).toBeNull();
    expect(slides[1].getAttribute("aria-hidden")).toBe("true");
    const primeira = regiao.querySelector("img") as HTMLImageElement;
    expect(primeira.getAttribute("alt")).toBe("Banner 1 de Teste");
    expect(primeira.getAttribute("loading")).toBe("eager");
    expect(primeira.getAttribute("fetchpriority")).toBe("high");
    expect(slides[1].querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });

  it("setas, indicadores e teclado trocam o slide", () => {
    render(<CarrosselBanner imagens={imagens} rotulo="Banners" />);
    const slideAtual = () =>
      document
        .querySelector('[aria-roledescription="slide"]:not([aria-hidden])')
        ?.getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: "Próximo banner" }));
    expect(slideAtual()).toBe("2 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Banner anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Banner anterior" }));
    expect(slideAtual()).toBe("3 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Ir para o banner 2 de 3" }));
    expect(slideAtual()).toBe("2 de 3");
    expect(
      screen.getByRole("button", { name: "Ir para o banner 2 de 3" }).getAttribute("aria-current"),
    ).toBe("true");
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    expect(slideAtual()).toBe("3 de 3");
  });

  it("gira sozinho devagar, pausa e retoma pelo botão, e para depois de uma volta", () => {
    vi.useFakeTimers();
    render(<CarrosselBanner imagens={imagens} rotulo="Banners" />);
    const atual = () =>
      document
        .querySelector('[aria-roledescription="slide"]:not([aria-hidden])')
        ?.getAttribute("aria-label");
    act(() => void vi.advanceTimersByTime(8000));
    expect(atual()).toBe("2 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Pausar rotação do banner" }));
    act(() => void vi.advanceTimersByTime(30000));
    expect(atual()).toBe("2 de 3");
    fireEvent.click(screen.getByRole("button", { name: "Retomar rotação do banner" }));
    act(() => void vi.advanceTimersByTime(8000));
    expect(atual()).toBe("3 de 3");
    act(() => void vi.advanceTimersByTime(8000));
    expect(atual()).toBe("1 de 3");
    // Uma volta completa: para sozinho (nada de rotação infinita).
    act(() => void vi.advanceTimersByTime(60000));
    expect(atual()).toBe("1 de 3");
    expect(screen.getByRole("button", { name: "Retomar rotação do banner" })).toBeTruthy();
  });

  it("não gira com 'reduzir movimento' e não mostra o botão de pausa", () => {
    movimento(true);
    vi.useFakeTimers();
    render(<CarrosselBanner imagens={imagens} rotulo="Banners" />);
    act(() => void vi.advanceTimersByTime(60000));
    expect(
      document
        .querySelector('[aria-roledescription="slide"]:not([aria-hidden])')
        ?.getAttribute("aria-label"),
    ).toBe("1 de 3");
    expect(screen.queryByRole("button", { name: /rotação do banner/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Próximo banner" })).toBeTruthy();
  });

  it("com uma imagem só, sem controles; sem imagens, nada", () => {
    const { container, rerender } = render(
      <CarrosselBanner imagens={[imagens[0]]} rotulo="Banners" />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Banner 1 de Teste");
    rerender(<CarrosselBanner imagens={[]} rotulo="Banners" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("menu Aparência do painel (D-015, D-016)", () => {
  it("existe o grupo Aparência e a rota por perfil o destaca", () => {
    const g = gruposDoMenu({ geral: false, permissoes: [] });
    expect(g.find((x) => x.id === "aparencia")?.itens.map((i) => i.href)).toEqual([
      "/aparencia",
      "/aparencia/banners",
    ]);
    expect(hrefAtivo("/meus-perfis/abc/aparencia", g)).toBe("/aparencia");
    expect(hrefAtivo("/meus-perfis/abc/previa", g)).toBe("/meus-perfis");
  });
});
