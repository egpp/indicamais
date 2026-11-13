import { describe, expect, it, vi } from "vitest";
import {
  criarServicoLoja,
  filtrosImoveisSchema,
  paraCartaoImovel,
  paraCartaoLoja,
  paraParamsListarImoveis,
  type ClienteBancoLoja,
  type LinhaImovelListado,
  type LinhaLojaItemPublico,
} from "./index";

const PERFIL = "99999999-9999-4999-8999-999999999999";
const ITEM = "11111111-1111-4111-8111-111111111111";

const linhaImovel = (o: Partial<LinhaImovelListado> = {}): LinhaImovelListado => ({
  o_id: ITEM,
  o_perfil_id: PERFIL,
  o_perfil_slug: "imobiliaria-sol",
  o_nome: "Apartamento na orla",
  o_descricao: "x".repeat(300),
  o_foto_path: `item/${ITEM}/a.jpg`,
  o_fotos_extras_paths: [`item/${ITEM}/b.jpg`],
  o_imovel_tipo: "apartamento",
  o_finalidade: "aluguel",
  o_preco_modo: "fixo",
  o_preco_centavos: 250_000,
  o_area_m2: "85.50",
  o_quartos: 2,
  o_banheiros: 1,
  o_vagas: 1,
  o_bairro: "Pajuçara",
  o_cidade: "Maceió",
  o_uf: "AL",
  o_condominio_centavos: 40_000,
  o_iptu_centavos: null,
  o_aceita_financiamento: null,
  o_total: 3,
  ...o,
});

const linhaLoja = (o: Partial<LinhaLojaItemPublico> = {}): LinhaLojaItemPublico => ({
  id: ITEM,
  perfil_id: PERFIL,
  perfil_slug: "imobiliaria-sol",
  tipo: "produto",
  nome: "Bolo",
  descricao: "Bolo caseiro",
  foto_path: null,
  fotos_extras_paths: [],
  categoria_principal_id: null,
  categoria_secundaria_1_id: null,
  categoria_secundaria_2_id: null,
  preco_modo: "fixo",
  preco_centavos: 4500,
  cidade: "Maceió",
  uf: "AL",
  bairro: null,
  imovel_tipo: null,
  finalidade: null,
  area_m2: null,
  quartos: null,
  banheiros: null,
  vagas: null,
  condominio_centavos: null,
  iptu_centavos: null,
  aceita_financiamento: null,
  criado_em: "2026-11-03T10:00:00Z",
  ...o,
});

function fakeBanco(o: Partial<ClienteBancoLoja> = {}): ClienteBancoLoja {
  return {
    lerLiberacoes: vi.fn(async () => ({ dados: [], erro: null })),
    listarItensDoPerfil: vi.fn(async () => ({ dados: [], erro: null })),
    buscarItemPorId: vi.fn(async () => ({ dados: null, erro: null })),
    listarImoveis: vi.fn(async () => ({ dados: [], erro: null })),
    ...o,
  };
}

describe("cartão público da Loja (IM-098, IM-029)", () => {
  it("imóvel: preço mensal, local sem endereço exato, área numérica e descrição curta", () => {
    const c = paraCartaoImovel(linhaImovel())!;
    expect(c.tipo).toBe("imovel");
    expect(c.precoTexto).toBe("R$ 2.500,00 por mês");
    expect(c.imovel).toMatchObject({
      areaM2: 85.5,
      localTexto: "Pajuçara, Maceió/AL",
      condominioTexto: "R$ 400,00",
      iptuTexto: null,
      aceitaFinanciamento: null,
    });
    expect(c.descricaoCurta!.length).toBeLessThanOrEqual(200);
    expect(c.link).toBe(`/item/${ITEM}`);
    expect(c.perfilLink).toBe("/perfil/imobiliaria-sol");
  });

  it("não carrega dado de pessoa nem coluna extra do banco", () => {
    const c = paraCartaoLoja({
      ...linhaLoja(),
      conta_id: "c",
      telefone: "5511999990001",
      email: "dono@exemplo.com",
      endereco: "Rua X, 10",
    } as LinhaLojaItemPublico)!;
    const json = JSON.stringify(c);
    expect(json).not.toMatch(/conta_id|telefone|5511999990001|dono@exemplo|Rua X|endereco/i);
  });

  it("linhas inutilizáveis somem: id ruim, sem nome, tipo desconhecido, imóvel sem site", () => {
    expect(paraCartaoLoja(linhaLoja({ id: "nao-e-uuid" }))).toBeNull();
    expect(paraCartaoLoja(linhaLoja({ nome: "  " }))).toBeNull();
    expect(paraCartaoLoja(linhaLoja({ tipo: "carro" }))).toBeNull();
    expect(paraCartaoLoja(linhaLoja({ tipo: "imovel", perfil_slug: null }))).toBeNull();
    expect(paraCartaoLoja(linhaLoja({ tipo: "imovel", perfil_id: null }))).toBeNull();
  });

  it("produto da Loja não ganha bloco de imóvel e mantém a galeria", () => {
    const c = paraCartaoLoja(linhaLoja({ fotos_extras_paths: [`item/${ITEM}/z.jpg`] }))!;
    expect(c.imovel).toBeNull();
    expect(c.fotosExtrasPaths).toEqual([`item/${ITEM}/z.jpg`]);
    expect(c.precoTexto).toBe("R$ 45,00");
  });
});

describe("filtros de imóveis (validados antes do banco)", () => {
  it("padrões: limite 20, página 1, sem filtros", () => {
    const f = filtrosImoveisSchema.parse({});
    expect(paraParamsListarImoveis(f)).toEqual({ p_limite: 20, p_pagina: 1 });
  });

  it("aceita texto de query string e normaliza UF", () => {
    const f = filtrosImoveisSchema.parse({
      finalidade: "venda",
      tipo: "casa",
      precoMinCentavos: "100000",
      precoMaxCentavos: "50000000",
      quartosMin: "2",
      uf: " al ",
      cidade: " Maceió ",
      bairro: "",
      perfilId: PERFIL.toUpperCase(),
      limite: "50",
      pagina: "3",
    });
    expect(paraParamsListarImoveis(f)).toEqual({
      p_finalidade: "venda",
      p_imovel_tipo: "casa",
      p_preco_min: 100_000,
      p_preco_max: 50_000_000,
      p_quartos_min: 2,
      p_uf: "AL",
      p_cidade: "Maceió",
      p_perfil_id: PERFIL,
      p_limite: 50,
      p_pagina: 3,
    });
  });

  it("recusa valores inválidos", () => {
    const ruins: Record<string, unknown>[] = [
      { finalidade: "troca" },
      { tipo: "castelo" },
      { precoMinCentavos: -1 },
      { precoMinCentavos: "abc" },
      { precoMinCentavos: 500, precoMaxCentavos: 100 },
      { quartosMin: 51 },
      { uf: "XX" },
      { uf: "ALA" },
      { cidade: "x".repeat(81) },
      { perfilId: "nao-uuid" },
      { limite: 0 },
      { limite: 51 },
      { pagina: 0 },
      { pagina: 1001 },
    ];
    for (const r of ruins) {
      expect(filtrosImoveisSchema.safeParse(r).success, JSON.stringify(r)).toBe(false);
    }
  });
});

describe("serviço da Loja", () => {
  it("listarImoveis: filtro inválido não chama o banco", async () => {
    const banco = fakeBanco();
    const r = await criarServicoLoja(banco).listarImoveis({ finalidade: "troca" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(banco.listarImoveis).not.toHaveBeenCalled();
  });

  it("listarImoveis: mapeia cartões, total e paginação", async () => {
    const banco = fakeBanco({
      listarImoveis: vi.fn(async () => ({
        dados: [linhaImovel({ o_total: 45 }), linhaImovel({ o_id: "ruim", o_total: 45 })],
        erro: null,
      })),
    });
    const r = await criarServicoLoja(banco).listarImoveis({ pagina: 2, limite: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.itens).toHaveLength(1);
    expect(r.valor).toMatchObject({
      total: 45,
      pagina: 2,
      limite: 20,
      temAnterior: true,
      temProxima: true,
    });
  });

  it("listarImoveis: erro do banco vira mensagem neutra, sem texto do banco", async () => {
    const banco = fakeBanco({
      listarImoveis: vi.fn(async () => ({
        dados: null,
        erro: { code: "22023", message: "finalidade inválida" },
      })),
    });
    const r = await criarServicoLoja(banco).listarImoveis({});
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(!r.ok && r.erro.mensagem).toBe("Confira os filtros informados.");
    const x = await criarServicoLoja(
      fakeBanco({
        listarImoveis: vi.fn(async () => {
          throw new Error("boom SQL");
        }),
      }),
    ).listarImoveis({});
    expect(!x.ok && x.erro.mensagem).not.toMatch(/boom|SQL/);
  });

  it("lojaLiberada: true só com linha liberada; falha fechada em erro, exceção e id inválido", async () => {
    const liberada = fakeBanco({
      lerLiberacoes: vi.fn(async () => ({
        dados: [{ perfil_id: PERFIL, liberada: true }],
        erro: null,
      })),
    });
    expect(await criarServicoLoja(liberada).lojaLiberada(PERFIL)).toBe(true);
    const desligada = fakeBanco({
      lerLiberacoes: vi.fn(async () => ({
        dados: [{ perfil_id: PERFIL, liberada: false }],
        erro: null,
      })),
    });
    expect(await criarServicoLoja(desligada).lojaLiberada(PERFIL)).toBe(false);
    expect(await criarServicoLoja(fakeBanco()).lojaLiberada(PERFIL)).toBe(false);
    const erro = fakeBanco({
      lerLiberacoes: vi.fn(async () => ({ dados: null, erro: { code: "XX000" } })),
    });
    expect(await criarServicoLoja(erro).lojaLiberada(PERFIL)).toBe(false);
    const lanca = fakeBanco({
      lerLiberacoes: vi.fn(async () => {
        throw new Error("rede");
      }),
    });
    expect(await criarServicoLoja(lanca).lojaLiberada(PERFIL)).toBe(false);
    const invalido = fakeBanco();
    expect(await criarServicoLoja(invalido).lojaLiberada("x")).toBe(false);
    expect(invalido.lerLiberacoes).not.toHaveBeenCalled();
  });

  it("lojasLiberadas: mapa por site, ignora linha de site não pedido", async () => {
    const outro = "22222222-2222-4222-8222-222222222222";
    const banco = fakeBanco({
      lerLiberacoes: vi.fn(async () => ({
        dados: [
          { perfil_id: PERFIL, liberada: true },
          { perfil_id: "33333333-3333-4333-8333-333333333333", liberada: true },
        ],
        erro: null,
      })),
    });
    expect(await criarServicoLoja(banco).lojasLiberadas([PERFIL, outro])).toEqual({
      [PERFIL]: true,
      [outro]: false,
    });
  });

  it("listarItensDoPerfil e buscarItem: mapeiam, ignoram id inválido e tratam erro", async () => {
    const banco = fakeBanco({
      listarItensDoPerfil: vi.fn(async () => ({
        dados: [linhaLoja(), linhaLoja({ nome: null })],
        erro: null,
      })),
      buscarItemPorId: vi.fn(async () => ({ dados: linhaLoja(), erro: null })),
    });
    const svc = criarServicoLoja(banco);
    const l = await svc.listarItensDoPerfil(PERFIL);
    expect(l.ok && l.valor).toHaveLength(1);
    const i = await svc.buscarItem(ITEM);
    expect(i.ok && i.valor?.nome).toBe("Bolo");
    const invalido = await svc.buscarItem("x");
    expect(invalido).toEqual({ ok: true, valor: null });
    expect(banco.buscarItemPorId).toHaveBeenCalledTimes(1);
    const falha = await criarServicoLoja(
      fakeBanco({
        listarItensDoPerfil: vi.fn(async () => ({ dados: null, erro: { code: "XX000" } })),
      }),
    ).listarItensDoPerfil(PERFIL);
    expect(!falha.ok && falha.erro.codigo).toBe("ERRO_INTERNO");
  });
});
