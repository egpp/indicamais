import { describe, expect, it, vi } from "vitest";
import type { CartaoLoja, ServicoLoja } from "@/modules/catalogo";
import { carregarLojaDoPerfil, filtrosParaServico, lerFiltrosLoja } from "./loja-pagina";

const PERFIL = "11111111-1111-4111-8111-111111111111";

const cartao = (id: string, tipo: "produto" | "imovel"): CartaoLoja =>
  ({
    id,
    tipo,
    nome: id,
    fotoPath: `item/${id}/a.webp`,
    fotosExtrasPaths: [],
  }) as unknown as CartaoLoja;

function servico(parcial: Partial<Record<keyof ServicoLoja, unknown>>): ServicoLoja {
  return {
    lojaLiberada: vi.fn(async () => true),
    listarItensDoPerfil: vi.fn(async () => ({
      ok: true,
      valor: [cartao("a", "produto"), cartao("b", "imovel")],
    })),
    listarImoveis: vi.fn(async () => ({ ok: true, valor: { itens: [cartao("b", "imovel")] } })),
    ...parcial,
  } as unknown as ServicoLoja;
}
const assinar = vi.fn(async () => ({}));

describe("filtros da Loja do perfil", () => {
  it("lê os filtros da URL e converte o preço máximo de reais para centavos", () => {
    const f = lerFiltrosLoja({ finalidade: "venda", quartos: ["2", "3"], precoMax: "350.000,00" });
    expect(f).toEqual({
      finalidade: "venda",
      imovelTipo: "",
      quartos: "2",
      precoMax: "350.000,00",
    });
    const { entrada, erroPreco } = filtrosParaServico(f, PERFIL);
    expect(erroPreco).toBeNull();
    expect(entrada).toMatchObject({
      perfilId: PERFIL,
      precoMaxCentavos: 35000000,
      quartosMin: "2",
    });
  });

  it("preço ilegível não vai ao banco e devolve mensagem em português", () => {
    const { entrada, erroPreco } = filtrosParaServico(lerFiltrosLoja({ precoMax: "abc" }), PERFIL);
    expect("precoMaxCentavos" in entrada).toBe(false);
    expect(erroPreco).toMatch(/preço máximo em reais/);
  });
});

describe("carregarLojaDoPerfil (IM-097, D-020)", () => {
  it("Loja não liberada: null (a página usa o catálogo simples)", async () => {
    const s = servico({ lojaLiberada: vi.fn(async () => false) });
    expect(await carregarLojaDoPerfil(PERFIL, {}, { servico: s, assinar })).toBeNull();
  });

  it("Loja vazia ou com falha: null", async () => {
    const vazia = servico({ listarItensDoPerfil: vi.fn(async () => ({ ok: true, valor: [] })) });
    expect(await carregarLojaDoPerfil(PERFIL, {}, { servico: vazia, assinar })).toBeNull();
    const falha = servico({
      listarItensDoPerfil: vi.fn(async () => ({ ok: false, erro: { mensagem: "x" } })),
    });
    expect(await carregarLojaDoPerfil(PERFIL, {}, { servico: falha, assinar })).toBeNull();
    const quebra = servico({
      lojaLiberada: vi.fn(async () => {
        throw new Error("rede");
      }),
    });
    expect(await carregarLojaDoPerfil(PERFIL, {}, { servico: quebra, assinar })).toBeNull();
  });

  it("sem filtro lista tudo; com filtro lista só os imóveis que casam, do próprio perfil", async () => {
    const s = servico({});
    const sem = await carregarLojaDoPerfil(PERFIL, {}, { servico: s, assinar });
    expect(sem?.itens).toHaveLength(2);
    expect(sem?.temImoveis).toBe(true);
    expect(sem?.filtroAtivo).toBe(false);
    const com = await carregarLojaDoPerfil(
      PERFIL,
      { finalidade: "venda" },
      { servico: s, assinar },
    );
    expect(com?.itens).toHaveLength(1);
    expect(com?.filtroAtivo).toBe(true);
    expect(s.listarImoveis).toHaveBeenCalledWith(
      expect.objectContaining({ perfilId: PERFIL, finalidade: "venda" }),
    );
  });

  it("filtro sem resultado ou recusado mantém a seção, com a mensagem neutra do módulo", async () => {
    const s = servico({
      listarImoveis: vi.fn(async () => ({ ok: false, erro: { mensagem: "Filtros inválidos." } })),
    });
    const r = await carregarLojaDoPerfil(PERFIL, { quartos: "2" }, { servico: s, assinar });
    expect(r?.itens).toEqual([]);
    expect(r?.erro).toBe("Filtros inválidos.");
  });

  it("perfil sem imóveis ignora os filtros (só catálogo)", async () => {
    const s = servico({
      listarItensDoPerfil: vi.fn(async () => ({ ok: true, valor: [cartao("a", "produto")] })),
    });
    const r = await carregarLojaDoPerfil(PERFIL, { finalidade: "venda" }, { servico: s, assinar });
    expect(r?.temImoveis).toBe(false);
    expect(r?.filtroAtivo).toBe(false);
    expect(s.listarImoveis).not.toHaveBeenCalled();
  });
});
