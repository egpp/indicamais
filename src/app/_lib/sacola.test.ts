import { describe, expect, it } from "vitest";
import { LIMITES } from "@/shared/config/limites";
import {
  adicionarNaSacola,
  alterarQuantidade,
  incluirListaNaMensagem,
  MAX_ITENS_SACOLA,
  montarMensagemSacola,
} from "./sacola";

describe("sacola de interesse (D-023)", () => {
  it("soma a quantidade do mesmo item com a mesma escolha e separa escolhas diferentes", () => {
    let s = adicionarNaSacola([], { id: "a", nome: "Camiseta", escolhas: ["Tamanho: M"] });
    s = adicionarNaSacola(s, { id: "a", nome: "Camiseta", escolhas: ["Tamanho: M"] });
    s = adicionarNaSacola(s, { id: "a", nome: "Camiseta", escolhas: ["Tamanho: G"] });
    expect(s.map((i) => i.quantidade)).toEqual([2, 1]);
  });
  it("remove ao chegar a zero e respeita o limite de itens", () => {
    expect(alterarQuantidade([{ id: "a", nome: "A", escolhas: [], quantidade: 1 }], 0, -1)).toEqual(
      [],
    );
    let s = adicionarNaSacola([], { id: "0", nome: "x" });
    for (let n = 1; n < MAX_ITENS_SACOLA + 5; n++)
      s = adicionarNaSacola(s, { id: String(n), nome: "x" });
    expect(s).toHaveLength(MAX_ITENS_SACOLA);
  });
  it("monta a mensagem em texto, sem preço nem total", () => {
    const m = montarMensagemSacola([
      { id: "a", nome: "Camiseta", escolhas: ["Tamanho: M", "Cor: azul"], quantidade: 2 },
    ]);
    expect(m).toContain("- 2x Camiseta (Tamanho: M, Cor: azul)");
    expect(m).not.toMatch(/R\$|total/i);
  });
  it("cabe sempre no limite do campo de mensagem", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      nome: "N".repeat(80),
      escolhas: ["Tamanho: M"],
      quantidade: 1,
    }));
    const m = montarMensagemSacola(muitos);
    expect(m.length).toBeLessThanOrEqual(LIMITES.contato.mensagemMax);
    expect(m).toMatch(/e mais \d+ item/);
  });
  it("mantém o texto do visitante e não repete a lista", () => {
    const lista = montarMensagemSacola([{ id: "a", nome: "Vaso", escolhas: [], quantidade: 1 }]);
    const uma = incluirListaNaMensagem("Olá!", lista);
    expect(uma.startsWith("Olá!")).toBe(true);
    expect(incluirListaNaMensagem(uma, lista)).toBe(uma);
    expect(incluirListaNaMensagem("", "")).toBe("");
  });
});
