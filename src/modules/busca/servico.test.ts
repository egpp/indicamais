import { describe, expect, it, vi } from "vitest";
import {
  criarServicoBusca,
  mapearErroBancoBusca,
  paraCard,
  type ClienteBancoBusca,
  type LinhaBusca,
} from "./index";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const linha = (extra: Partial<LinhaBusca> & Record<string, unknown> = {}): LinhaBusca => ({
  o_tipo: "produto",
  o_id: ID1,
  o_slug: null,
  o_perfil_id: null,
  o_perfil_slug: null,
  o_nome: "Bicicleta aro 29",
  o_descricao: "Pouco usada.",
  o_imagem_path: `item/${ID1}/${ID2}.jpg`,
  o_categoria_id: CAT,
  o_categoria_nome: "Veículos",
  o_categoria_slug: "veiculos",
  o_cidade: "Campinas",
  o_uf: "SP",
  o_preco_modo: "fixo",
  o_preco_centavos: 125050,
  o_total: 1,
  ...extra,
});

function fakeBanco(linhas: LinhaBusca[] = [linha()]) {
  const buscar = vi.fn<ClienteBancoBusca["buscar"]>(async () => ({ dados: linhas, erro: null }));
  const listarCategorias = vi.fn<ClienteBancoBusca["listarCategorias"]>(async () => ({
    dados: [
      { id: "c2", nome: "Beleza", slug: "beleza", ativa: true, ordem: 2 },
      { id: "c3", nome: "Antiga", slug: "antiga", ativa: false, ordem: 0 },
      { id: "c1", nome: "Alimentação", slug: "alimentacao", ativa: true, ordem: 1 },
    ],
    erro: null,
  }));
  return {
    banco: { buscar, listarCategorias } satisfies ClienteBancoBusca,
    buscar,
    listarCategorias,
  };
}

describe("busca: entrada (IM-019)", () => {
  it("sem filtros usa os padrões e não envia filtros ao banco", async () => {
    const f = fakeBanco();
    const r = await criarServicoBusca(f.banco).buscar({});
    expect(r.ok).toBe(true);
    expect(f.buscar).toHaveBeenCalledWith({ p_limite: 20, p_pagina: 1 });
  });

  it("aceita undefined/null como 'sem filtros'", async () => {
    const f = fakeBanco();
    const svc = criarServicoBusca(f.banco);
    expect((await svc.buscar(undefined)).ok).toBe(true);
    expect((await svc.buscar(null)).ok).toBe(true);
  });

  it("apara o termo, normaliza UF/tipo e repassa os filtros com nomes p_*", async () => {
    const f = fakeBanco();
    await criarServicoBusca(f.banco).buscar({
      termo: "  bolo  ",
      tipo: " Produto ",
      categoriaId: CAT,
      uf: " sp ",
      cidade: " Campinas ",
      pagina: "3",
      limite: "10",
    });
    expect(f.buscar).toHaveBeenCalledWith({
      p_termo: "bolo",
      p_tipo: "produto",
      p_categoria_id: CAT,
      p_uf: "SP",
      p_cidade: "Campinas",
      p_limite: 10,
      p_pagina: 3,
    });
  });

  it("campos vazios de formulário viram 'sem filtro'", async () => {
    const f = fakeBanco();
    await criarServicoBusca(f.banco).buscar({
      termo: "",
      tipo: "",
      categoriaId: "",
      uf: "",
      cidade: "  ",
      pagina: "",
      limite: "",
    });
    expect(f.buscar).toHaveBeenCalledWith({ p_limite: 20, p_pagina: 1 });
  });

  it("termo hostil (% _ \\ aspas) passa como texto comum, sem escape nem recusa", async () => {
    const f = fakeBanco();
    const hostil = "100% _a\\b' OR 1=1 --";
    const r = await criarServicoBusca(f.banco).buscar({ termo: hostil });
    expect(r.ok).toBe(true);
    expect(f.buscar.mock.calls[0]![0].p_termo).toBe(hostil);
  });

  it("termo com 80 caracteres passa; com 81 e com 100 mil caracteres é recusado sem chamar o banco", async () => {
    const f = fakeBanco();
    const svc = criarServicoBusca(f.banco);
    expect((await svc.buscar({ termo: "a".repeat(80) })).ok).toBe(true);
    f.buscar.mockClear();
    for (const termo of ["a".repeat(81), "a".repeat(100_000)]) {
      const r = await svc.buscar({ termo });
      expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
      expect(!r.ok && r.erro.campos).toHaveProperty("termo");
    }
    expect(f.buscar).not.toHaveBeenCalled();
  });

  it("termo só com espaços vira sem termo; caractere de controle (NUL) é recusado", async () => {
    const f = fakeBanco();
    const svc = criarServicoBusca(f.banco);
    await svc.buscar({ termo: "     " });
    expect(f.buscar).toHaveBeenCalledWith({ p_limite: 20, p_pagina: 1 });
    f.buscar.mockClear();
    const r = await svc.buscar({ termo: "a\u0000b" });
    expect(r.ok).toBe(false);
    expect(f.buscar).not.toHaveBeenCalled();
  });

  it.each([
    ["UF inexistente", { uf: "XX" }, "uf"],
    ["UF com 3 letras", { uf: "SPP" }, "uf"],
    ["UF com 1 letra", { uf: "S" }, "uf"],
    ["UF numérica", { uf: 12 }, "uf"],
    ["tipo inválido", { tipo: "anuncio" }, "tipo"],
    ["tipo 'todos' não é filtro do app", { tipo: "todos" }, "tipo"],
    ["tipo objeto", { tipo: { x: 1 } }, "tipo"],
    ["categoria não é uuid", { categoriaId: "abc" }, "categoriaId"],
    ["categoria com injeção", { categoriaId: "1' or '1'='1" }, "categoriaId"],
    ["cidade com 81 caracteres", { cidade: "c".repeat(81) }, "cidade"],
    ["cidade com 100 mil caracteres", { cidade: "c".repeat(100_000) }, "cidade"],
    ["página 0", { pagina: 0 }, "pagina"],
    ["página negativa", { pagina: -1 }, "pagina"],
    ["página 1001", { pagina: 1001 }, "pagina"],
    ["página decimal", { pagina: 1.5 }, "pagina"],
    ["página texto", { pagina: "abc" }, "pagina"],
    ["página NaN", { pagina: Number.NaN }, "pagina"],
    ["limite 0", { limite: 0 }, "limite"],
    ["limite 51", { limite: 51 }, "limite"],
    ["limite negativo", { limite: -5 }, "limite"],
    ["limite Infinity", { limite: Infinity }, "limite"],
  ])("recusa %s sem consultar o banco", async (_nome, entrada, campo) => {
    const f = fakeBanco();
    const r = await criarServicoBusca(f.banco).buscar(entrada);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(!r.ok && r.erro.campos).toHaveProperty(campo);
    expect(f.buscar).not.toHaveBeenCalled();
  });

  it("limites de borda passam: página 1 e 1000, limite 1 e 50", async () => {
    const f = fakeBanco();
    const svc = criarServicoBusca(f.banco);
    for (const e of [{ pagina: 1 }, { pagina: 1000 }, { limite: 1 }, { limite: 50 }]) {
      expect((await svc.buscar(e)).ok).toBe(true);
    }
  });

  it("entrada que não é objeto é recusada", async () => {
    const f = fakeBanco();
    const svc = criarServicoBusca(f.banco);
    for (const e of ["bolo", 42, ["a"], true]) {
      expect((await svc.buscar(e)).ok).toBe(false);
    }
    expect(f.buscar).not.toHaveBeenCalled();
  });

  it("campos desconhecidos (ex.: contaId, whatsapp) não chegam ao banco", async () => {
    const f = fakeBanco();
    await criarServicoBusca(f.banco).buscar({
      termo: "bolo",
      contaId: ID1,
      whatsapp: "+5511999999999",
    });
    expect(f.buscar).toHaveBeenCalledWith({ p_termo: "bolo", p_limite: 20, p_pagina: 1 });
  });
});

describe("busca: card público (IM-019, IM-029)", () => {
  it("anúncio particular: link para a página do item, sem perfil, com cidade/UF do anúncio e preço", async () => {
    const r = await criarServicoBusca(fakeBanco().banco).buscar({});
    if (!r.ok) throw new Error();
    expect(r.valor.cards).toEqual([
      {
        tipo: "produto",
        id: ID1,
        slug: null,
        link: `/item/${ID1}`,
        nome: "Bicicleta aro 29",
        descricaoCurta: "Pouco usada.",
        imagemPath: `item/${ID1}/${ID2}.jpg`,
        categoria: { id: CAT, nome: "Veículos", slug: "veiculos" },
        cidade: "Campinas",
        uf: "SP",
        precoTexto: "R$ 1.250,50",
        anuncioParticular: true,
        perfilLink: null,
      },
    ]);
  });

  it("perfil: link /perfil/<slug>, sem preço", () => {
    const c = paraCard(
      linha({
        o_tipo: "perfil",
        o_slug: "padaria-do-ze",
        o_preco_modo: null,
        o_preco_centavos: null,
      }),
    );
    expect(c?.link).toBe("/perfil/padaria-do-ze");
    expect(c?.slug).toBe("padaria-do-ze");
    expect(c?.precoTexto).toBeNull();
    expect(c?.anuncioParticular).toBe(false);
  });

  it("item de perfil: link do item, link do perfil dono, não é anúncio particular", () => {
    const c = paraCard(
      linha({
        o_tipo: "servico",
        o_perfil_id: ID2,
        o_perfil_slug: "studio-ana",
        o_preco_modo: "sob_consulta",
        o_preco_centavos: null,
      }),
    );
    expect(c?.link).toBe(`/item/${ID1}`);
    expect(c?.perfilLink).toBe("/perfil/studio-ana");
    expect(c?.anuncioParticular).toBe(false);
    expect(c?.precoTexto).toBe("Sob consulta");
  });

  it("preço a partir de, bigint como texto e combinação incoerente", () => {
    expect(
      paraCard(linha({ o_preco_modo: "a_partir_de", o_preco_centavos: "1500" }))?.precoTexto,
    ).toBe("A partir de R$ 15,00");
    expect(
      paraCard(linha({ o_preco_modo: "fixo", o_preco_centavos: null }))?.precoTexto,
    ).toBeNull();
  });

  it("colunas privadas que 'vazarem' na linha do banco NÃO saem no card", async () => {
    const vazada = linha({
      whatsapp: "+5511999990000",
      o_whatsapp: "+5511999990000",
      conta_id: "conta-secreta-123",
      o_conta_id: "conta-secreta-123",
      email: "dono@exemplo.com",
      responsavel: "Fulano de Tal",
      o_nome_responsavel: "Fulano de Tal",
      telefone: "11999990000",
    });
    const r = await criarServicoBusca(fakeBanco([vazada]).banco).buscar({});
    if (!r.ok) throw new Error();
    const json = JSON.stringify(r.valor);
    for (const segredo of [
      "+5511999990000",
      "11999990000",
      "conta-secreta-123",
      "dono@exemplo.com",
      "Fulano de Tal",
    ]) {
      expect(json).not.toContain(segredo);
    }
    const chaves = Object.keys(r.valor.cards[0]!);
    for (const proibida of [
      "whatsapp",
      "email",
      "contaId",
      "conta_id",
      "responsavel",
      "telefone",
      "perfilId",
    ]) {
      expect(chaves).not.toContain(proibida);
    }
  });

  it("linhas inutilizáveis (tipo/id/nome inválidos, perfil sem slug) são descartadas, sem quebrar", async () => {
    const r = await criarServicoBusca(
      fakeBanco([
        linha({ o_tipo: "conta" }),
        linha({ o_id: "nao-uuid" }),
        linha({ o_nome: "  " }),
        linha({ o_tipo: "perfil", o_slug: null }),
        linha({ o_nome: "Válida" }),
      ]).banco,
    ).buscar({});
    expect(r.ok && r.valor.cards.map((c) => c.nome)).toEqual(["Válida"]);
  });

  it("slug com caracteres especiais é codificado no link", () => {
    expect(paraCard(linha({ o_tipo: "perfil", o_slug: "a/b?c" }))?.link).toBe("/perfil/a%2Fb%3Fc");
  });
});

describe("busca: paginação", () => {
  it("calcula total, totalPaginas e temMais a partir de o_total (bigint como texto)", async () => {
    const f = fakeBanco([linha({ o_total: "45" })]);
    const r = await criarServicoBusca(f.banco).buscar({ pagina: 2, limite: 20 });
    expect(r.ok && r.valor).toMatchObject({
      total: 45,
      totalPaginas: 3,
      temMais: true,
      pagina: 2,
      limite: 20,
    });
  });

  it("última página não tem mais; total exato não cria página extra", async () => {
    const svc = criarServicoBusca(fakeBanco([linha({ o_total: 40 })]).banco);
    const r = await svc.buscar({ pagina: 2 });
    expect(r.ok && r.valor).toMatchObject({ totalPaginas: 2, temMais: false });
  });

  it("sem resultados (ou página além do fim): zero cards, total 0, sem mais páginas", async () => {
    const r = await criarServicoBusca(fakeBanco([]).banco).buscar({ pagina: 9 });
    expect(r.ok && r.valor).toMatchObject({ cards: [], total: 0, totalPaginas: 0, temMais: false });
  });

  it("o_total inválido vira 0, nunca NaN", async () => {
    const r = await criarServicoBusca(fakeBanco([linha({ o_total: "abc" })]).banco).buscar({});
    expect(r.ok && r.valor.total).toBe(0);
  });
});

describe("busca: erros do banco (IM-086)", () => {
  it("22023 vira 'filtros inválidos'; outros viram genérica; o texto do banco nunca sai", async () => {
    const mensagemInterna = 'relation "perfis_perfil" does not exist at /var/db';
    for (const [code, codigo] of [
      ["22023", "VALIDACAO"],
      ["42P01", "ERRO_INTERNO"],
      ["XX000", "ERRO_INTERNO"],
    ] as const) {
      const f = fakeBanco();
      f.buscar.mockResolvedValueOnce({ dados: null, erro: { code, message: mensagemInterna } });
      const r = await criarServicoBusca(f.banco).buscar({});
      expect(!r.ok && r.erro.codigo).toBe(codigo);
      expect(JSON.stringify(r)).not.toMatch(/relation|var\/db|perfis_perfil/);
    }
    expect(mapearErroBancoBusca({}).codigo).toBe("ERRO_INTERNO");
  });

  it("exceção do adaptador vira erro genérico", async () => {
    const f = fakeBanco();
    f.buscar.mockRejectedValueOnce(new Error("senha do banco: x"));
    const r = await criarServicoBusca(f.banco).buscar({});
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("senha");
  });
});

describe("busca: filtros disponíveis e seção da home (IM-016, IM-019)", () => {
  it("lista só categorias ativas, ordenadas, e as 27 UFs", async () => {
    const r = await criarServicoBusca(fakeBanco().banco).listarFiltros();
    if (!r.ok) throw new Error();
    expect(r.valor.categorias.map((c) => c.nome)).toEqual(["Alimentação", "Beleza"]);
    expect(r.valor.ufs).toHaveLength(27);
    expect(r.valor.ufs).toContain("SP");
    expect(r.valor.tipos).toEqual(["perfil", "produto", "servico"]);
  });

  it("falha de categorias vira erro genérico", async () => {
    const f = fakeBanco();
    f.listarCategorias.mockResolvedValueOnce({
      dados: null,
      erro: { code: "XX000", message: "boom" },
    });
    const r = await criarServicoBusca(f.banco).listarFiltros();
    expect(!r.ok && r.erro.mensagem).not.toContain("boom");
  });

  it("seção da home consulta produto e serviço separadamente, página 1, com N linhas", async () => {
    const f = fakeBanco();
    f.buscar.mockImplementation(async (p) => ({
      dados: [linha({ o_tipo: p.p_tipo!, o_nome: `Item ${p.p_tipo}` })],
      erro: null,
    }));
    const r = await criarServicoBusca(f.banco).secaoProdutosEServicos(4);
    expect(f.buscar).toHaveBeenCalledWith({ p_tipo: "produto", p_limite: 4, p_pagina: 1 });
    expect(f.buscar).toHaveBeenCalledWith({ p_tipo: "servico", p_limite: 4, p_pagina: 1 });
    expect(r.ok && r.valor.produtos.map((c) => c.nome)).toEqual(["Item produto"]);
    expect(r.ok && r.valor.servicos.map((c) => c.nome)).toEqual(["Item servico"]);
  });

  it("seção: padrão 6; quantidade 0, 51 ou texto é recusada sem consulta; erro em uma parte falha tudo", async () => {
    const f = fakeBanco([]);
    const svc = criarServicoBusca(f.banco);
    await svc.secaoProdutosEServicos();
    expect(f.buscar).toHaveBeenCalledWith({ p_tipo: "produto", p_limite: 6, p_pagina: 1 });
    f.buscar.mockClear();
    for (const q of [0, 51, "x", -1]) {
      expect((await svc.secaoProdutosEServicos(q)).ok).toBe(false);
    }
    expect(f.buscar).not.toHaveBeenCalled();
    f.buscar.mockResolvedValueOnce({ dados: [], erro: null });
    f.buscar.mockResolvedValueOnce({ dados: null, erro: { code: "XX000" } });
    expect((await svc.secaoProdutosEServicos(3)).ok).toBe(false);
  });

  it("a seção mostra anúncio particular (item sem perfil)", async () => {
    const f = fakeBanco([linha()]);
    const r = await criarServicoBusca(f.banco).secaoProdutosEServicos(2);
    expect(r.ok && r.valor.produtos[0]?.anuncioParticular).toBe(true);
  });
});
