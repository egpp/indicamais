// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { imovelParaExibicao, type ItemExibicao } from "@/modules/catalogo";
import { demonstracaoDoEstilo } from "./demonstracao";
import { IDS_ESTILOS, resolverEstilo, type EstiloId } from "./estilos";
import { SiteNegocio } from "./site-negocio";

// Verificação independente da Fase 11 (IM-091, IM-094, D-021, D-022): o estilo muda só a aparência.
afterEach(cleanup);

const imovel: ItemExibicao = {
  id: "22222222-2222-4222-8222-222222222222",
  perfilId: "p1",
  anuncioParticular: false,
  tipo: "imovel",
  nome: "Casa com quintal",
  descricao: "Casa ampla perto da praça.",
  fotoPath: "item/x/a.webp",
  categoriaPrincipalId: null,
  categoriasSecundariasIds: [],
  preco: { modo: "fixo", centavos: 250000 },
  cidade: "Marília",
  uf: "SP",
  precoTexto: "R$ 2.500,00 por mês",
  imovel: imovelParaExibicao(
    {
      imovelTipo: "casa",
      finalidade: "aluguel",
      quartos: 3,
      banheiros: 2,
      vagas: 1,
      areaM2: 120,
      bairro: "Jardim",
    },
    "Marília",
    "SP",
  ),
  fotosExtrasPaths: [],
};

function pagina(estilo: EstiloId, loja: boolean) {
  const base = demonstracaoDoEstilo("minimalista");
  return (
    <SiteNegocio
      estilo={estilo}
      perfil={{ ...base.perfil, nome: "Negócio Fixo" }}
      itens={[imovel, ...base.itens.slice(0, 2)]}
      categorias={[]}
      urls={{ "item/x/a.webp": "https://exemplo/a.webp" }}
      beneficios={base.beneficios}
      contato={<p>contato</p>}
      loja={loja ? {} : null}
    />
  );
}

function conteudo(estilo: EstiloId, loja: boolean) {
  const { container, unmount } = render(pagina(estilo, loja));
  const raiz = container.querySelector('[data-testid="site-negocio"]')!;
  const r = {
    dataEstilo: raiz.getAttribute("data-estilo"),
    texto: raiz.textContent,
    secoes: [...raiz.querySelectorAll("section[id]")].map((s) => s.id),
    links: [...raiz.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    cards: raiz.querySelectorAll(".st-card").length,
  };
  unmount();
  return r;
}

describe("estilo muda só a aparência (IM-091, IM-094)", () => {
  const ref = conteudo("minimalista", true);
  it("cada um dos 22 estilos tem data-estilo próprio, mesmas seções, links e cartões; o texto é idêntico (exceto o Básico)", () => {
    for (const id of IDS_ESTILOS) {
      const c = conteudo(id, true);
      expect(c.dataEstilo).toBe(id);
      // O Básico (IM-110) tem chamadas próprias pedidas pelo Emerson; ver o teste dedicado abaixo.
      if (id !== "basico") expect(c.texto, id).toBe(ref.texto);
      expect(c.secoes, id).toEqual(ref.secoes);
      expect(c.links, id).toEqual(ref.links);
      expect(c.cards, id).toBe(ref.cards);
    }
  });

  it("id desconhecido cai no padrão (básico) e renderiza as mesmas seções, links e cartões", () => {
    for (const v of ["xyz", "", undefined, ["pet"], "constructor", "toString"]) {
      const id = resolverEstilo(v);
      expect(id).toBe("basico");
      const c = conteudo(id, true);
      expect(c.secoes).toEqual(ref.secoes);
      expect(c.links).toEqual(ref.links);
      expect(c.cards).toBe(ref.cards);
    }
  });

  it("Básico: só as chamadas mudam (Fale com a gente, Tenho interesse, Vamos conversar?); sem formulário demonstrativo", () => {
    const { container, unmount } = render(pagina("basico", true));
    const t = container.textContent ?? "";
    expect(t).toContain("Fale com a gente");
    expect(t).toContain("Um pouco sobre a gente");
    expect(t).toContain("Vamos conversar?");
    expect(t).toContain("Tenho interesse");
    expect(t).not.toMatch(/Formulário demonstrativo/i);
    unmount();
  });

  it("sem liberação da Loja a seção não se chama Loja, em todos os estilos (D-022)", () => {
    for (const id of IDS_ESTILOS) {
      const { container, unmount } = render(pagina(id, false));
      const secao = container.querySelector("#produtos")!;
      const titulos = within(secao as HTMLElement).getAllByRole("heading", { level: 2 });
      expect(titulos.map((t) => t.textContent)).toEqual(["Produtos e serviços"]);
      expect(container.textContent).not.toMatch(/\bLoja\b/);
      unmount();
    }
  });

  it("Imobiliário mostra chips do imóvel com a Loja liberada", () => {
    const { container } = render(pagina("imobiliario", true));
    const chips = container.querySelector('[aria-label="Características do imóvel"]')!;
    expect([...chips.querySelectorAll("li")].map((l) => l.textContent)).toEqual([
      "3 quartos",
      "2 banheiros",
      "1 vaga",
      "120 m²",
    ]);
  });

  it("nenhum dado privado nas páginas (telefone, e-mail, WhatsApp)", () => {
    for (const id of IDS_ESTILOS) {
      const c = conteudo(id, true);
      expect(c.texto, id).not.toMatch(/@\w+\.\w+|\+55|\(\d{2}\)\s?\d{4,5}-?\d{4}/);
      expect(c.links.join(" "), id).not.toMatch(/wa\.me|tel:|mailto:/);
    }
  });
});
