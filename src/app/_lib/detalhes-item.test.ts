import { describe, expect, it } from "vitest";
import { detalhesDoItem } from "./detalhes-item";

describe("detalhesDoItem (D-023)", () => {
  it("lê tamanhos e cores como texto e tira as linhas da descrição", () => {
    const d = detalhesDoItem("Camiseta de algodão.\nTamanhos: P, M, G\nCores: azul; preto");
    expect(d.descricao).toBe("Camiseta de algodão.");
    expect(d.variacoes).toEqual([
      { rotulo: "Tamanho", opcoes: ["P", "M", "G"] },
      { rotulo: "Cor", opcoes: ["azul", "preto"] },
    ]);
    expect(d.periodicidade).toBeNull();
  });
  it("aceita rótulo em maiúsculas; ignora linha sem opções", () => {
    expect(detalhesDoItem("TAMANHO: único").variacoes[0]?.opcoes).toEqual(["único"]);
    expect(detalhesDoItem("Cor: , ;").variacoes).toEqual([]);
  });
  it("marca plano pela periodicidade e separa os benefícios", () => {
    const d = detalhesDoItem("Periodicidade: por mês\n- 3 aulas por semana\n- Avaliação inicial");
    expect(d.periodicidade).toBe("por mês");
    expect(d.linhas).toEqual(["3 aulas por semana", "Avaliação inicial"]);
  });
  it("sem descrição devolve vazio", () => {
    expect(detalhesDoItem(null)).toEqual({
      descricao: null,
      variacoes: [],
      periodicidade: null,
      linhas: [],
    });
  });
  it("limita o número de opções", () => {
    const d = detalhesDoItem(
      `Tamanhos: ${Array.from({ length: 30 }, (_, i) => `T${i}`).join(", ")}`,
    );
    expect(d.variacoes[0]?.opcoes).toHaveLength(12);
  });
});
