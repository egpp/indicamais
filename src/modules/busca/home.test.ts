import { describe, expect, it, vi } from "vitest";
import {
  chaveCacheHome,
  criarServicoHome,
  escolherLocalizacaoHome,
  paraCardDaHome,
  validarLocalizacaoHome,
  type ClienteBancoHome,
  type LinhaPerfilHome,
  type LinhaSecaoHome,
} from "./index";

const id = (n: number) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;

const perfil = (n: number, extra: Record<string, unknown> = {}): LinhaPerfilHome =>
  ({
    o_posicao: n,
    o_id: id(n),
    o_slug: `perfil-${n}`,
    o_nome: `Site ${n}`,
    o_descricao: "Descrição",
    o_imagem_path: `perfil/${id(n)}/foto.jpg`,
    o_categoria_id: null,
    o_categoria_nome: null,
    o_categoria_slug: null,
    o_cidade: "Campinas",
    o_uf: "SP",
    o_metrica: 7,
    ...extra,
  }) as LinhaPerfilHome;

const secao = (
  chave: string,
  ordem: number,
  extra: Partial<LinhaSecaoHome> = {},
): LinhaSecaoHome => ({
  o_chave: chave,
  o_titulo: `Título ${chave}`,
  o_ordem: ordem,
  o_tipo_item: "perfil",
  o_minimo_itens: 2,
  o_limite_padrao: 10,
  o_total_itens: 5,
  o_exibir: true,
  ...extra,
});

function fake(secoes: LinhaSecaoHome[], porChave: Record<string, LinhaPerfilHome[]> = {}) {
  const listarSecoes = vi.fn<ClienteBancoHome["listarSecoes"]>(async () => ({
    dados: secoes,
    erro: null,
  }));
  const listarPerfisDaSecao = vi.fn<ClienteBancoHome["listarPerfisDaSecao"]>(async (p) => ({
    dados: porChave[p.p_chave] ?? [perfil(1), perfil(2)],
    erro: null,
  }));
  return { banco: { listarSecoes, listarPerfisDaSecao }, listarSecoes, listarPerfisDaSecao };
}

describe("validarLocalizacaoHome (UF validada antes da chamada)", () => {
  it("normaliza cidade e UF", () => {
    expect(validarLocalizacaoHome({ cidade: "  São   Paulo ", uf: " sp " })).toEqual({
      cidade: "São Paulo",
      uf: "SP",
    });
  });
  it.each([
    [{ cidade: "Campinas", uf: "S" }],
    [{ cidade: "Campinas", uf: "SPP" }],
    [{ cidade: "Campinas", uf: "XX" }],
    [{ cidade: "Campinas", uf: "1A" }],
    [{ cidade: "Campinas" }],
    [{ uf: "SP" }],
    [{ cidade: "   ", uf: "SP" }],
    [{ cidade: "a".repeat(81), uf: "SP" }],
    [{ cidade: "Cam\u0000pinas", uf: "SP" }],
    [null],
    [undefined],
    ["SP"],
  ])("recusa %j", (e) => {
    expect(validarLocalizacaoHome(e)).toBeNull();
  });
  it("chave de cache ignora acento, caixa e espaços", () => {
    expect(chaveCacheHome({ cidade: "São  Paulo", uf: "SP" })).toBe(
      chaveCacheHome({ cidade: "sao paulo", uf: "SP" }),
    );
    expect(chaveCacheHome(null)).toBe("sem-cidade");
  });
});

describe("escolherLocalizacaoHome", () => {
  const meus = [
    { publicado: false, conteudoNoAr: { cidade: "Rascunho", uf: "RJ" } },
    { publicado: true, conteudoNoAr: null },
    { publicado: true, conteudoNoAr: { cidade: "Santos", uf: "SP" } },
  ];
  it("a busca vence o site", () => {
    expect(escolherLocalizacaoHome({ cidade: "Campinas", uf: "SP" }, meus)).toEqual({
      cidade: "Campinas",
      uf: "SP",
    });
  });
  it("sem busca usa o primeiro site publicado com cidade", () => {
    expect(escolherLocalizacaoHome(undefined, meus)).toEqual({ cidade: "Santos", uf: "SP" });
  });
  it("busca com UF inválida cai para o site, sem erro", () => {
    expect(escolherLocalizacaoHome({ cidade: "X", uf: "ZZ" }, meus)).toEqual({
      cidade: "Santos",
      uf: "SP",
    });
  });
  it("sem busca nem site publicado com cidade: null", () => {
    expect(escolherLocalizacaoHome(null, [meus[0]!, meus[1]!])).toBeNull();
    expect(escolherLocalizacaoHome(null, [])).toBeNull();
    expect(escolherLocalizacaoHome(null, undefined)).toBeNull();
  });
});

describe("paraCardDaHome", () => {
  it("monta card de site sem métrica nem dado de pessoa", () => {
    const c = paraCardDaHome(
      perfil(1, { conta_id: "x", responsavel_id: "y", telefone: "+5511999999999" }),
    );
    expect(c).toMatchObject({
      tipo: "perfil",
      id: id(1),
      slug: "perfil-1",
      link: "/perfil/perfil-1",
      nome: "Site 1",
      imagemPath: `perfil/${id(1)}/foto.jpg`,
      anuncioParticular: false,
    });
    const texto = JSON.stringify(c);
    for (const proibido of ["conta_id", "responsavel", "telefone", "5511", "metrica"]) {
      expect(texto).not.toContain(proibido);
    }
    expect(c).not.toHaveProperty("metrica");
  });
  it("linha sem slug ou nome some", () => {
    expect(paraCardDaHome(perfil(1, { o_slug: null }))).toBeNull();
    expect(paraCardDaHome(perfil(1, { o_nome: " " }))).toBeNull();
    expect(paraCardDaHome(perfil(1, { o_id: "x" }))).toBeNull();
  });
});

describe("obterSecoesDaHome", () => {
  it("devolve só seções com o_exibir, em ordem, com título do banco", async () => {
    const f = fake([
      secao("mais_curtidos", 3),
      secao("novidades", 1, { o_titulo: "Chegou agora" }),
      secao("mais_indicados", 2, { o_exibir: false }),
    ]);
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({});
    expect(r.ok && r.valor.map((s) => [s.chave, s.titulo])).toEqual([
      ["novidades", "Chegou agora"],
      ["mais_curtidos", "Título mais_curtidos"],
    ]);
    // a seção oculta nem é consultada
    expect(f.listarPerfisDaSecao.mock.calls.map((c) => c[0].p_chave).sort()).toEqual([
      "mais_curtidos",
      "novidades",
    ]);
  });

  it("omite seção sem itens, abaixo do mínimo ou com falha, sem derrubar as outras", async () => {
    const f = fake(
      [
        secao("novidades", 1),
        secao("mais_curtidos", 2),
        secao("mais_indicados", 3),
        secao("em_alta_semana", 4),
      ],
      { novidades: [], mais_curtidos: [perfil(1)], em_alta_semana: [perfil(1), perfil(2)] },
    );
    f.listarPerfisDaSecao.mockImplementation(async (p) => {
      if (p.p_chave === "mais_indicados") return { dados: null, erro: { code: "XX000" } };
      if (p.p_chave === "mais_curtidos") return { dados: [perfil(1)], erro: null };
      if (p.p_chave === "novidades") return { dados: [], erro: null };
      return { dados: [perfil(1), perfil(2)], erro: null };
    });
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({});
    expect(r.ok && r.valor.map((s) => s.chave)).toEqual(["em_alta_semana"]);
  });

  it("descarta linhas inutilizáveis e respeita o mínimo depois do descarte", async () => {
    const f = fake([secao("novidades", 1)], {
      novidades: [perfil(1), perfil(2, { o_slug: null })],
    });
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({});
    expect(r.ok && r.valor).toEqual([]);
  });

  it("na_sua_cidade some sem cidade, mesmo que o banco a devolva", async () => {
    const f = fake([secao("novidades", 1), secao("na_sua_cidade", 4)]);
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({});
    expect(r.ok && r.valor.map((s) => s.chave)).toEqual(["novidades"]);
    expect(f.listarPerfisDaSecao.mock.calls.map((c) => c[0].p_chave)).not.toContain(
      "na_sua_cidade",
    );
    expect(f.listarSecoes).toHaveBeenCalledWith({});
  });

  it("com cidade e UF válidas repassa ao banco e mostra na_sua_cidade", async () => {
    const f = fake([secao("novidades", 1), secao("na_sua_cidade", 4)]);
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({ cidade: " Campinas ", uf: "sp" });
    expect(r.ok && r.valor.map((s) => s.chave)).toEqual(["novidades", "na_sua_cidade"]);
    expect(f.listarSecoes).toHaveBeenCalledWith({ p_cidade: "Campinas", p_uf: "SP" });
    expect(f.listarPerfisDaSecao).toHaveBeenCalledWith({
      p_chave: "na_sua_cidade",
      p_cidade: "Campinas",
      p_uf: "SP",
    });
  });

  it("UF inválida nunca chega ao banco: a home segue sem a seção de cidade", async () => {
    const f = fake([secao("novidades", 1), secao("na_sua_cidade", 4)]);
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({ cidade: "Campinas", uf: "ZZ" });
    expect(r.ok && r.valor.map((s) => s.chave)).toEqual(["novidades"]);
    expect(f.listarSecoes).toHaveBeenCalledWith({});
    for (const [p] of f.listarPerfisDaSecao.mock.calls) {
      expect(p).not.toHaveProperty("p_uf");
      expect(p).not.toHaveProperty("p_cidade");
    }
  });

  it("ignora chave desconhecida e tipo de item não suportado", async () => {
    const f = fake([
      secao("mais_visitados", 1),
      secao("novidades", 2, { o_tipo_item: "produto" }),
      secao("mais_curtidos", 3),
    ]);
    const r = await criarServicoHome(f.banco).obterSecoesDaHome({});
    expect(r.ok && r.valor.map((s) => s.chave)).toEqual(["mais_curtidos"]);
  });

  it("erro do banco na lista de seções vira mensagem neutra", async () => {
    const banco: ClienteBancoHome = {
      listarSecoes: async () => ({
        dados: null,
        erro: { code: "42P01", message: "tabela segredo" },
      }),
      listarPerfisDaSecao: async () => ({ dados: [], erro: null }),
    };
    const r = await criarServicoHome(banco).obterSecoesDaHome({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.codigo).toBe("ERRO_INTERNO");
      expect(r.erro.mensagem).not.toContain("segredo");
    }
  });

  it("exceção do cliente vira erro neutro", async () => {
    const banco: ClienteBancoHome = {
      listarSecoes: async () => {
        throw new Error("rede");
      },
      listarPerfisDaSecao: async () => ({ dados: [], erro: null }),
    };
    const r = await criarServicoHome(banco).obterSecoesDaHome({});
    expect(r.ok === false && r.erro.mensagem).not.toContain("rede");
  });
});
