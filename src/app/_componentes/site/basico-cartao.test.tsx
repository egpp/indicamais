// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../acoes-indicacoes", () => ({ acaoEnviarContato: vi.fn(async () => ({})) }));

import type { ItemExibicao } from "@/modules/catalogo";
import { FormContato } from "../form-contato";
import { demonstracaoDoEstilo } from "./demonstracao";
import { MiniaturaEstilo } from "./miniatura-estilo";
import { TEMAS } from "./estilos";
import { sacola } from "./sacola-estado";
import { SiteNegocio } from "./site-negocio";

afterEach(() => {
  act(() => sacola.limpar());
  cleanup();
});

const item = (id: string, nome: string): ItemExibicao => ({
  id,
  perfilId: "p1",
  anuncioParticular: false,
  tipo: "servico",
  nome,
  descricao: `Descrição de ${nome}.`,
  fotoPath: null,
  categoriaPrincipalId: null,
  categoriasSecundariasIds: [],
  preco: null,
  cidade: null,
  uf: null,
  precoTexto: null,
  imovel: null,
  fotosExtrasPaths: [],
});

function pagina(itens: ItemExibicao[], contato: React.ReactNode = <p>contato</p>) {
  const demo = demonstracaoDoEstilo("basico");
  return (
    <SiteNegocio
      estilo="basico"
      perfil={{ ...demo.perfil, id: "p1", nome: "Ponto Serviços" }}
      itens={itens}
      categorias={[]}
      urls={{}}
      beneficios={[]}
      contato={contato}
    />
  );
}

describe("estilo Básico: cartão (IM-110, D-040)", () => {
  it("ordem de leitura: o preço vem depois do nome e da descrição, antes do botão", () => {
    render(pagina([item("a", "Atendimento inicial")]));
    const card = document.querySelector("#produtos .st-card")!;
    const pos = (el: Element) => [...card.querySelectorAll("*")].indexOf(el);
    const nome = card.querySelector("h3")!;
    const desc = card.querySelector(".st-card-desc")!;
    const preco = card.querySelector(".st-card-preco")!;
    const botao = card.querySelector("button")!;
    expect(preco.textContent).toBe("Valores sob consulta");
    expect(pos(nome)).toBeLessThan(pos(desc));
    expect(pos(desc)).toBeLessThan(pos(preco));
    expect(pos(preco)).toBeLessThan(pos(botao));
    // O CSS não reordena visualmente o cartão: o DOM já é a ordem visual.
    const css = readCss();
    expect(css).not.toMatch(/(^|[\s;{])order:/);
    expect(css).not.toMatch(/display:\s*contents/);
  });

  it("'Tenho interesse' preenche o campo Mensagem do formulário de contato com o item", () => {
    render(
      pagina(
        [item("a", "Atendimento inicial")],
        <FormContato tipo="perfil" slug="ponto" chave={"c".repeat(20)} />,
      ),
    );
    const campo = screen.getByLabelText(/Mensagem/) as HTMLTextAreaElement;
    expect(campo.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Tenho interesse/ }));
    expect(campo.value).toContain("- 1x Atendimento inicial");
  });

  it("cartões sem foto usam ícones distintos (conversa, ferramentas, lista)", () => {
    render(pagina([item("a", "A"), item("b", "B"), item("c", "C")]));
    const svgs = [...document.querySelectorAll("#produtos .st-card-sem-imagem svg")].map(
      (s) => s.innerHTML,
    );
    expect(svgs).toHaveLength(3);
    expect(new Set(svgs).size).toBe(3);
  });

  it("demonstração e miniatura mostram os três ícones, sem ilustração", () => {
    const demo = demonstracaoDoEstilo("basico");
    expect(demo.itens.every((i) => i.fotoPath === null)).toBe(true);
    const { container } = render(<MiniaturaEstilo tema={TEMAS.basico} />);
    const svgs = [...container.querySelectorAll(".st-mini-icone svg")].map((s) => s.innerHTML);
    expect(new Set(svgs).size).toBe(3);
    expect(container.querySelector(".st-mini-card img")).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
function readCss(): string {
  return readFileSync(join(__dirname, "site-estilos-basico.css"), "utf8");
}
