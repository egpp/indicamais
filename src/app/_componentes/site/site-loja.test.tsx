// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { imovelParaExibicao, type ItemExibicao } from "@/modules/catalogo";
import { demonstracaoDoEstilo } from "./demonstracao";
import { SiteNegocio } from "./site-negocio";

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

function pagina(loja: React.ComponentProps<typeof SiteNegocio>["loja"], itens: ItemExibicao[]) {
  const demo = demonstracaoDoEstilo("minimalista");
  return (
    <SiteNegocio
      estilo="minimalista"
      perfil={{ ...demo.perfil, nome: "Imobiliária Boa Casa" }}
      itens={itens}
      categorias={[]}
      urls={{ "item/x/a.webp": "https://exemplo/a.webp" }}
      beneficios={[]}
      contato={<p>contato</p>}
      loja={loja}
    />
  );
}

describe("seção Loja do perfil (IM-097, IM-098, D-020)", () => {
  it("com a Loja, a seção se chama Loja e o cartão do imóvel mostra preço, chips e bairro/cidade", () => {
    render(pagina({}, [imovel]));
    const secao = document.getElementById("produtos")!;
    expect(within(secao).getByRole("heading", { level: 2, name: "Loja" })).toBeTruthy();
    expect(within(secao).getByText("R$ 2.500,00 por mês")).toBeTruthy();
    const chips = within(secao).getByLabelText("Características do imóvel");
    expect(
      within(chips)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual(["3 quartos", "2 banheiros", "1 vaga", "120 m²"]);
    expect(within(secao).getByText("Jardim, Marília/SP")).toBeTruthy();
    expect(within(secao).getByRole("link", { name: "Casa com quintal" }).getAttribute("href")).toBe(
      "/item/22222222-2222-4222-8222-222222222222",
    );
    // Catálogo, não venda: nada de carrinho, compra ou pagamento.
    expect(document.body.textContent).not.toMatch(/carrinho|comprar|checkout|pagamento/i);
    expect(screen.getAllByRole("link", { name: "Loja" }).length).toBeGreaterThan(0);
  });

  it("sem a Loja, segue Produtos e serviços", () => {
    render(pagina(null, [{ ...imovel, tipo: "produto", imovel: null, precoTexto: "R$ 10,00" }]));
    const secao = document.getElementById("produtos")!;
    expect(
      within(secao).getByRole("heading", { level: 2, name: "Produtos e serviços" }),
    ).toBeTruthy();
  });

  it("filtro sem resultado mantém a seção, com mensagem acessível", () => {
    render(pagina({ filtroAtivo: true, filtros: <p>filtros</p> }, []));
    const secao = document.getElementById("produtos")!;
    expect(within(secao).getByText("filtros")).toBeTruthy();
    expect(within(secao).getByRole("status").textContent).toMatch(/Nenhum imóvel encontrado/);
  });
});
