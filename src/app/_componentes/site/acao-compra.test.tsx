// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ItemExibicao } from "@/modules/catalogo";
import { demonstracaoDoEstilo } from "./demonstracao";
import { resolverAcaoCompra } from "./acao-compra-regras";
import { sacola, useSacola } from "./sacola-estado";
import { SiteNegocio } from "./site-negocio";

afterEach(() => {
  act(() => sacola.limpar());
  cleanup();
});

function item(
  id: string,
  nome: string,
  descricao: string,
  tipo: "produto" | "servico" = "produto",
): ItemExibicao {
  return {
    id,
    perfilId: "p1",
    anuncioParticular: false,
    tipo,
    nome,
    descricao,
    fotoPath: null,
    categoriaPrincipalId: null,
    categoriasSecundariasIds: [],
    preco: { modo: "fixo", centavos: 14900 },
    cidade: null,
    uf: null,
    precoTexto: "R$ 149,00",
    imovel: null,
    fotosExtrasPaths: [],
  };
}

function pagina(
  itens: ItemExibicao[],
  extra: Partial<React.ComponentProps<typeof SiteNegocio>> = {},
) {
  const demo = demonstracaoDoEstilo("moda_lojas");
  return (
    <SiteNegocio
      estilo="moda_lojas"
      perfil={{ ...demo.perfil, id: "p1", nome: "Loja Azul" }}
      itens={itens}
      categorias={[]}
      urls={{}}
      beneficios={[]}
      contato={<p>contato</p>}
      {...extra}
    />
  );
}

describe("ponto único da ação de compra (D-022, D-023)", () => {
  it("plano e imóvel levam ao contato; os demais entram na lista; nenhum modo de pagamento", () => {
    expect(resolverAcaoCompra({ tipoItem: "produto", plano: true })).toMatchObject({
      modo: "contato",
      href: "#contato-site",
    });
    expect(resolverAcaoCompra({ tipoItem: "imovel" }).modo).toBe("contato");
    expect(resolverAcaoCompra({ tipoItem: "servico" }).modo).toBe("lista");
    expect(resolverAcaoCompra({ tipoItem: "produto" }).modo).toBe("lista");
  });
});

describe("lista de interesse e variações informativas (D-023, IM-090)", () => {
  it("mostra tamanhos como texto, sem repetir a linha na descrição", () => {
    render(pagina([item("a", "Camiseta", "Algodão.\nTamanhos: P, M, G")]));
    const secao = document.getElementById("produtos")!;
    expect(within(secao).getByText(/P, M, G/)).toBeTruthy();
    expect(within(secao).getByText("Algodão.")).toBeTruthy();
    expect(within(secao).queryByText(/Tamanhos: P/)).toBeNull();
  });

  it("monta a lista com quantidade, sem total nem pagamento, e esconde o painel quando vazia", () => {
    render(pagina([item("a", "Camiseta", "Tamanhos: P, M")]));
    expect(screen.queryByText(/Sua lista de interesse/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à lista/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à lista/ }));
    const painel = screen.getByRole("region", { name: /Sua lista de interesse \(2 itens\)/ });
    expect(within(painel).getByText(/Camiseta/)).toBeTruthy();
    expect(within(painel).getByText(/Tamanho: M/)).toBeTruthy();
    expect(painel.textContent).not.toMatch(/R\$|total|pagar|checkout|carrinho/i);
    fireEvent.click(
      within(painel).getByRole("button", { name: /Aumentar a quantidade de Camiseta/ }),
    );
    expect(screen.getByRole("region", { name: /\(3 itens\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Esvaziar a lista" }));
    expect(screen.queryByText(/Sua lista de interesse/)).toBeNull();
  });
});

describe("planos e equipe (D-023, D-022)", () => {
  const plano = item(
    "pl",
    "Plano Essencial",
    "Periodicidade: por mês\n- 3 aulas por semana\n- Avaliação inicial",
  );

  it("com a Loja, o plano vira vitrine com preço, inclusos e botão ao contato; sai do catálogo comum", () => {
    render(pagina([plano, item("a", "Camiseta", "")], { loja: {} }));
    const planos = document.getElementById("planos")!;
    expect(within(planos).getByRole("heading", { level: 3, name: "Plano Essencial" })).toBeTruthy();
    expect(within(planos).getByText("por mês")).toBeTruthy();
    expect(within(planos).getByText("3 aulas por semana")).toBeTruthy();
    expect(
      within(planos)
        .getByRole("link", { name: /Conhecer este plano/ })
        .getAttribute("href"),
    ).toBe("#contato-site");
    expect(within(document.getElementById("produtos")!).queryByText("Plano Essencial")).toBeNull();
  });

  it("sem a Loja não há seção de planos (Produtos e serviços segue visível)", () => {
    render(pagina([plano]));
    expect(document.getElementById("planos")).toBeNull();
    expect(document.getElementById("produtos")).not.toBeNull();
    expect(screen.queryByText(/Periodicidade/)).toBeNull();
  });

  it("equipe aparece só com conteúdo, com nome e cargo e nenhuma imagem de pessoa", () => {
    const { rerender } = render(pagina([]));
    expect(document.getElementById("equipe")).toBeNull();
    rerender(pagina([], { equipe: [{ nome: "Ana Souza", cargo: "Fisioterapeuta" }] }));
    const equipe = document.getElementById("equipe")!;
    expect(within(equipe).getByText("Ana Souza")).toBeTruthy();
    expect(within(equipe).getByText("Fisioterapeuta")).toBeTruthy();
    expect(equipe.querySelector("img")).toBeNull();
  });
});

describe("estilo Básico: Tenho interesse e Valores sob consulta (IM-110, D-040)", () => {
  function Sonda() {
    const { itens, envio } = useSacola();
    return (
      <output data-testid="sonda">
        {envio}|{itens.map((i) => `${i.quantidade}x ${i.nome}`).join(";")}
      </output>
    );
  }

  it("item sem preço mostra 'Valores sob consulta'; com preço mostra o valor real", () => {
    const semPreco = { ...item("a", "Atendimento", "Conversa inicial."), precoTexto: null };
    render(pagina([semPreco, item("b", "Camiseta", "")], { estilo: "basico" }));
    const secao = document.getElementById("produtos")!;
    expect(within(secao).getAllByText("Valores sob consulta")).toHaveLength(1);
    expect(within(secao).getByText("R$ 149,00")).toBeTruthy();
  });

  it("os outros estilos não ganham o texto 'Valores sob consulta'", () => {
    const semPreco = { ...item("a", "Atendimento", "x"), precoTexto: null };
    render(pagina([semPreco]));
    expect(document.body.textContent).not.toContain("Valores sob consulta");
  });

  it("'Tenho interesse' põe o item na lista, pede o envio ao formulário de contato e o item é citado", () => {
    render(
      <>
        {pagina([item("a", "Atendimento inicial", "x")], { estilo: "basico" })}
        <Sonda />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tenho interesse/ }));
    expect(screen.getByTestId("sonda").textContent).toBe("1|1x Atendimento inicial");
    // Sem botão "Adicionar à lista" nem rótulo de compra: é um pedido de contato, não uma compra (IM-090).
    expect(screen.queryByRole("button", { name: /Adicionar à lista/ })).toBeNull();
  });
});
