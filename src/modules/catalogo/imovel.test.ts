import { describe, expect, it, vi } from "vitest";
import {
  camposItemSchema,
  criarServicoItens,
  formatarPrecoImovel,
  mapearErroBancoCatalogo,
  novoItemSchema,
  pendenciasDoItem,
  validarConteudoItem,
  type ClienteBancoItens,
  type LinhaItem,
  type LinhaItemVersao,
} from "./index";
import { CONTEUDO_ITEM_VAZIO } from "./modelos";

const PERFIL = "99999999-9999-4999-8999-999999999999";
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foto = (itemId: string, n = 1) =>
  `item/${itemId}/aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}.jpg`;

/** Banco em memória que imita os gatilhos da Loja (migração 20261103140000). */
function fakeBanco(lojaLiberada: boolean) {
  const itens = new Map<string, LinhaItem>();
  const versoes = new Map<string, LinhaItemVersao>();
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const lojaErro = { code: "42501", message: "a Loja não está liberada para este perfil" };
  const banco: ClienteBancoItens = {
    criarItem: vi.fn(async (c) => {
      if (c.tipo === "imovel" && !lojaLiberada) return { dados: null, erro: lojaErro };
      const { tipo, perfil_id, ...cols } = c;
      const i: LinhaItem = {
        id: id(),
        perfil_id,
        tipo,
        publicado: false,
        versao_aprovada_id: null,
        criado_em: "2026-11-03T10:00:00Z",
        atualizado_em: "2026-11-03T10:00:00Z",
      };
      itens.set(i.id, i);
      const v: LinhaItemVersao = {
        id: id(),
        item_id: i.id,
        situacao: "rascunho",
        foto_path: null,
        criado_em: "2026-11-03T10:00:00Z",
        enviada_em: null,
        ...cols,
      };
      versoes.set(v.id, v);
      return { dados: { item_id: i.id, versao_id: v.id }, erro: null };
    }),
    buscarMeuItem: vi.fn(async (itemId) => ({ dados: itens.get(itemId) ?? null, erro: null })),
    listarMeusItens: vi.fn(async () => ({ dados: [...itens.values()], erro: null })),
    listarVersoes: vi.fn(async (ids) => ({
      dados: [...versoes.values()].filter((v) => ids.includes(v.item_id)),
      erro: null,
    })),
    inserirVersao: vi.fn(async () => ({ dados: null, erro: null })),
    atualizarVersao: vi.fn(async (versaoId, c) => {
      const v = versoes.get(versaoId);
      if (!v) return { dados: null, erro: null };
      if (!lojaLiberada && (c.fotos_extras_paths?.length ?? 0) > 0) {
        return {
          dados: null,
          erro: { code: "42501", message: "fotos adicionais exigem a Loja liberada" },
        };
      }
      const novo = { ...v, ...c };
      versoes.set(versaoId, novo);
      return { dados: novo, erro: null };
    }),
    enviarVersao: vi.fn(async (versaoId) => {
      const v = versoes.get(versaoId)!;
      versoes.set(versaoId, { ...v, situacao: "pendente" });
      return { erro: null };
    }),
    definirPublicado: vi.fn(async () => ({ dados: null, erro: null })),
  };
  return { banco, itens, versoes };
}

const imovelCompleto = {
  tipo: "imovel" as const,
  perfilId: PERFIL,
  nome: "Casa com quintal",
  descricao: "Casa ampla perto do centro.",
  categoriaPrincipalId: CAT_A,
  preco: { modo: "fixo" as const, centavos: 45_000_000 },
  cidade: "Maceió",
  uf: "AL",
  imovelTipo: "casa",
  finalidade: "venda",
  areaM2: 120.5,
  quartos: 3,
  banheiros: 2,
  vagas: 2,
  bairro: "Ponta Verde",
  condominioCentavos: 35_000,
  iptuCentavos: 12_000,
  aceitaFinanciamento: true,
};

describe("imóvel: validação de entrada (IM-098, espelha os CHECKs)", () => {
  it("aceita imóvel completo com cidade e UF próprias, em item de perfil", () => {
    const r = novoItemSchema.safeParse(imovelCompleto);
    expect(r.success).toBe(true);
  });

  it("imóvel sem perfil é recusado (anúncio particular não tem Loja)", () => {
    const r = novoItemSchema.safeParse({ ...imovelCompleto, perfilId: null });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]!.path).toEqual(["perfilId"]);
  });

  it("recusa tipo, finalidade e contagens fora do banco", () => {
    const ruim = [
      { imovelTipo: "castelo" },
      { finalidade: "troca" },
      { areaM2: 0 },
      { areaM2: -3 },
      { areaM2: 100_000_001 },
      { areaM2: 10.123 },
      { quartos: 51 },
      { quartos: -1 },
      { quartos: 1.5 },
      { banheiros: 51 },
      { vagas: 51 },
      { bairro: "A" },
      { bairro: "x".repeat(81) },
      { condominioCentavos: -1 },
      { condominioCentavos: 100_000_001 },
      { iptuCentavos: 100_000_001 },
      { aceitaFinanciamento: "talvez" },
    ];
    for (const patch of ruim) {
      expect(camposItemSchema.safeParse(patch).success, JSON.stringify(patch)).toBe(false);
    }
  });

  it("aceita os limites do banco e valores vindos de formulário (texto)", () => {
    const r = camposItemSchema.parse({
      imovelTipo: "rural",
      finalidade: "aluguel",
      areaM2: "1200,50",
      quartos: "0",
      banheiros: "50",
      vagas: "",
      bairro: "  Jatiúca ",
      condominioCentavos: "0",
      iptuCentavos: "100000000",
      aceitaFinanciamento: "false",
    });
    expect(r).toMatchObject({
      imovelTipo: "rural",
      finalidade: "aluguel",
      areaM2: 1200.5,
      quartos: 0,
      banheiros: 50,
      vagas: null,
      bairro: "Jatiúca",
      condominioCentavos: 0,
      iptuCentavos: 100_000_000,
      aceitaFinanciamento: false,
    });
  });

  it("fotos adicionais: até 8, sem repetir, só caminho de item", () => {
    const ok = Array.from({ length: 8 }, (_, n) => foto("00000000-0000-4000-8000-000000000001", n));
    expect(camposItemSchema.safeParse({ fotosExtrasPaths: ok }).success).toBe(true);
    expect(
      camposItemSchema.safeParse({
        fotosExtrasPaths: [...ok, foto("00000000-0000-4000-8000-000000000001", 9)],
      }).success,
    ).toBe(false);
    expect(camposItemSchema.safeParse({ fotosExtrasPaths: [ok[0], ok[0]] }).success).toBe(false);
    expect(camposItemSchema.safeParse({ fotosExtrasPaths: ["perfil/x/y.jpg"] }).success).toBe(
      false,
    );
    expect(camposItemSchema.safeParse({ fotosExtrasPaths: ["../../etc/passwd"] }).success).toBe(
      false,
    );
  });

  it("produto com campo de imóvel é recusado na coerência do conteúdo", () => {
    const base = { ...CONTEUDO_ITEM_VAZIO, bairro: "Centro" };
    expect(validarConteudoItem(base, null, false, "produto").imovelTipo).toBeTruthy();
    expect(validarConteudoItem(base, null, false, "servico").imovelTipo).toBeTruthy();
    expect(validarConteudoItem(base, null, false, "imovel")).toEqual({});
  });

  it("foto adicional de outra pasta de item é recusada", () => {
    const outro = foto("00000000-0000-4000-8000-0000000000ff");
    const c = { ...CONTEUDO_ITEM_VAZIO, fotosExtrasPaths: [outro] };
    expect(
      validarConteudoItem(c, "00000000-0000-4000-8000-000000000001", false, "imovel")
        .fotosExtrasPaths,
    ).toBeTruthy();
  });
});

describe("imóvel: preço e pendências", () => {
  it("aluguel fixo é mensal; venda não leva 'por mês'", () => {
    const p = { modo: "fixo" as const, centavos: 250_000 };
    expect(formatarPrecoImovel(p, "aluguel")).toBe("R$ 2.500,00 por mês");
    expect(formatarPrecoImovel(p, "venda")).toBe("R$ 2.500,00");
    expect(formatarPrecoImovel({ modo: "a_partir_de", centavos: 100_000 }, "aluguel")).toBe(
      "A partir de R$ 1.000,00 por mês",
    );
    expect(formatarPrecoImovel({ modo: "sob_consulta", centavos: null }, "aluguel")).toBe(
      "Sob consulta",
    );
    expect(formatarPrecoImovel(null, "venda")).toBeNull();
  });

  it("imóvel incompleto lista o que falta; zero quartos conta como informado", () => {
    const falta = pendenciasDoItem({ ...CONTEUDO_ITEM_VAZIO }, false, "imovel");
    expect(falta.join(" ")).toMatch(/tipo do imóvel/);
    expect(falta.join(" ")).toMatch(/bairro/);
    expect(falta.join(" ")).toMatch(/cidade/);
    const quase = pendenciasDoItem(
      {
        ...CONTEUDO_ITEM_VAZIO,
        nome: "Terreno",
        descricao: "Terreno plano.",
        fotoPath: "item/x/a.jpg",
        categoriaPrincipalId: CAT_A,
        preco: { modo: "sob_consulta", centavos: null },
        imovelTipo: "terreno",
        finalidade: "venda",
        areaM2: 300,
        quartos: 0,
        banheiros: 0,
        vagas: 0,
        bairro: "Centro",
        cidade: "Maceió",
        uf: "AL",
      },
      false,
      "imovel",
    );
    expect(quase).toEqual([]);
  });

  it("produto e serviço não ganham pendência de imóvel", () => {
    expect(pendenciasDoItem({ ...CONTEUDO_ITEM_VAZIO }, false, "produto").join(" ")).not.toMatch(
      /imóvel|bairro/,
    );
  });
});

describe("imóvel: serviço de itens (criar, editar, enviar)", () => {
  it("cria imóvel com a Loja liberada e grava os campos extras no rascunho", async () => {
    const f = fakeBanco(true);
    const svc = criarServicoItens(f.banco);
    const r = await svc.criarRascunho(imovelCompleto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.tipo).toBe("imovel");
    expect(r.valor.perfilId).toBe(PERFIL);
    expect(r.valor.conteudoEdicao).toMatchObject({
      imovelTipo: "casa",
      finalidade: "venda",
      areaM2: 120.5,
      quartos: 3,
      bairro: "Ponta Verde",
      condominioCentavos: 35_000,
      aceitaFinanciamento: true,
      cidade: "Maceió",
      uf: "AL",
    });
    // A RPC de criação só leva os campos básicos; os de imóvel entram pelo update do rascunho.
    const chamada = vi.mocked(f.banco.criarItem).mock.calls[0]![0];
    expect(Object.keys(chamada)).not.toContain("imovel_tipo");
    expect(f.banco.atualizarVersao).toHaveBeenCalledTimes(1);
  });

  it("sem a Loja liberada: erro neutro em português, sem texto do banco", async () => {
    const f = fakeBanco(false);
    const r = await criarServicoItens(f.banco).criarRascunho(imovelCompleto);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("LOJA_NAO_LIBERADA");
    expect(r.erro.mensagem).toBe("A Loja não está liberada para este perfil.");
    expect(f.itens.size).toBe(0);
  });

  it("produto de perfil com campo de imóvel é recusado antes do banco", async () => {
    const f = fakeBanco(true);
    const r = await criarServicoItens(f.banco).criarRascunho({
      tipo: "produto",
      perfilId: PERFIL,
      nome: "Bolo",
      bairro: "Centro",
    });
    expect(r.ok).toBe(false);
    expect(f.banco.criarItem).not.toHaveBeenCalled();
  });

  it("edita foto adicional com a Loja; sem a Loja o banco recusa com mensagem neutra", async () => {
    const com = fakeBanco(true);
    const svc = criarServicoItens(com.banco);
    const c = await svc.criarRascunho(imovelCompleto);
    if (!c.ok) throw new Error("criar");
    const e = await svc.editar(c.valor.id, {
      fotosExtrasPaths: [foto(c.valor.id, 1), foto(c.valor.id, 2)],
    });
    expect(e.ok && e.valor.item.conteudoEdicao.fotosExtrasPaths).toHaveLength(2);

    const sem = fakeBanco(false);
    sem.itens.set("00000000-0000-4000-8000-0000000000aa", {
      id: "00000000-0000-4000-8000-0000000000aa",
      perfil_id: PERFIL,
      tipo: "produto",
      publicado: false,
      versao_aprovada_id: null,
      criado_em: "2026-11-03T10:00:00Z",
      atualizado_em: "2026-11-03T10:00:00Z",
    });
    sem.versoes.set("v1", {
      id: "v1",
      item_id: "00000000-0000-4000-8000-0000000000aa",
      situacao: "rascunho",
      nome: "Bolo",
      descricao: null,
      foto_path: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: null,
      categoria_secundaria_2_id: null,
      preco_modo: null,
      preco_centavos: null,
      criado_em: "2026-11-03T10:00:00Z",
      enviada_em: null,
    });
    const r = await criarServicoItens(sem.banco).editar("00000000-0000-4000-8000-0000000000aa", {
      fotosExtrasPaths: [foto("00000000-0000-4000-8000-0000000000aa", 1)],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("LOJA_NAO_LIBERADA");
  });

  it("recusa mais de 8 fotos e foto de outro item", async () => {
    const f = fakeBanco(true);
    const svc = criarServicoItens(f.banco);
    const c = await svc.criarRascunho(imovelCompleto);
    if (!c.ok) throw new Error("criar");
    const nove = Array.from({ length: 9 }, (_, n) => foto(c.valor.id, n));
    expect((await svc.editar(c.valor.id, { fotosExtrasPaths: nove })).ok).toBe(false);
    const alheia = await svc.editar(c.valor.id, {
      fotosExtrasPaths: [foto("00000000-0000-4000-8000-0000000000ff")],
    });
    expect(alheia.ok).toBe(false);
  });

  it("envio de imóvel incompleto devolve pendências e não chama o banco", async () => {
    const f = fakeBanco(true);
    const svc = criarServicoItens(f.banco);
    const c = await svc.criarRascunho({ tipo: "imovel", perfilId: PERFIL, nome: "Casa" });
    if (!c.ok) throw new Error("criar");
    const r = await svc.enviarParaAprovacao(c.valor.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("INCOMPLETO");
    expect(!r.ok && (r.erro.pendencias ?? []).join(" ")).toMatch(/bairro/);
    expect(f.banco.enviarVersao).not.toHaveBeenCalled();
  });

  it("prévia do imóvel usa o formato público com preço mensal e sem endereço exato", async () => {
    const f = fakeBanco(true);
    const svc = criarServicoItens(f.banco);
    const c = await svc.criarRascunho({
      ...imovelCompleto,
      finalidade: "aluguel",
      preco: { modo: "fixo", centavos: 250_000 },
    });
    if (!c.ok) throw new Error("criar");
    const p = await svc.previa(c.valor.id);
    expect(p.ok && p.valor.item.precoTexto).toBe("R$ 2.500,00 por mês");
    expect(p.ok && p.valor.item.imovel?.localTexto).toBe("Ponta Verde, Maceió/AL");
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/conta_id|responsavel|telefone|whatsapp|endereco/i);
  });
});

describe("imóvel: tradução de erros do banco (neutros, em português)", () => {
  const casos: Array<[string, { code: string; message?: string; constraint?: string }, string]> = [
    [
      "42501 Loja não liberada",
      { code: "42501", message: "a Loja não está liberada para este perfil" },
      "LOJA_NAO_LIBERADA",
    ],
    [
      "42501 foto adicional sem Loja",
      { code: "42501", message: "fotos adicionais exigem a Loja liberada para o perfil" },
      "LOJA_NAO_LIBERADA",
    ],
    [
      "42501 versão não encontrada continua neutro",
      { code: "42501", message: "versão não encontrada" },
      "NAO_ENCONTRADO",
    ],
    [
      "23514 imóvel incompleto",
      {
        code: "23514",
        message:
          "imóvel exige tipo, finalidade, preço, área, quartos, banheiros, vagas, bairro, cidade e UF",
      },
      "INCOMPLETO",
    ],
    [
      "23514 imóvel sem perfil",
      { code: "23514", message: "imóvel pertence a um perfil: anúncio particular não tem Loja" },
      "VALIDACAO",
    ],
    [
      "23514 campo de imóvel em produto",
      { code: "23514", message: "campos de imóvel só existem em item do tipo imóvel" },
      "VALIDACAO",
    ],
    ["23514 foto repetida", { code: "23514", message: "foto adicional repetida" }, "VALIDACAO"],
    [
      "23514 foto fora da pasta",
      { code: "23514", message: "caminho de foto adicional fora da pasta do item" },
      "VALIDACAO",
    ],
    [
      "23514 limite de fotos",
      { code: "23514", constraint: "catalogo_item_versao_fotos_extras" },
      "VALIDACAO",
    ],
    ["23514 área", { code: "23514", constraint: "catalogo_item_versao_area" }, "VALIDACAO"],
    ["23514 quartos", { code: "23514", constraint: "catalogo_item_versao_quartos" }, "VALIDACAO"],
    [
      "23514 finalidade",
      { code: "23514", constraint: "catalogo_item_versao_finalidade" },
      "VALIDACAO",
    ],
    [
      "23514 condomínio",
      { code: "23514", constraint: "catalogo_item_versao_condominio" },
      "VALIDACAO",
    ],
  ];
  it.each(casos)("%s", (_nome, erro, codigo) => {
    const e = mapearErroBancoCatalogo(erro);
    expect(e.codigo).toBe(codigo);
    expect(e.mensagem).toMatch(/^[A-ZÀ-Ú]/);
    expect(e.mensagem).not.toMatch(/catalogo_|violates|SQLSTATE|trigger|constraint/i);
    expect(e.mensagem).not.toContain(erro.message ?? "\u0000");
  });

  it("mensagens específicas para cada causa", () => {
    expect(
      mapearErroBancoCatalogo({ code: "23514", message: "foto adicional repetida" }).mensagem,
    ).toBe("Não repita a mesma foto.");
    expect(
      mapearErroBancoCatalogo({ code: "23514", constraint: "catalogo_item_versao_fotos_extras" })
        .mensagem,
    ).toBe("Envie no máximo 8 fotos adicionais.");
    expect(
      mapearErroBancoCatalogo({ code: "23514", message: "imóvel pertence a um perfil" }).mensagem,
    ).toBe("O imóvel pertence a um perfil. Escolha o perfil.");
  });

  it("erros antigos seguem iguais (regressão)", () => {
    expect(mapearErroBancoCatalogo({ code: "42501" }).codigo).toBe("SEM_PERMISSAO");
    expect(
      mapearErroBancoCatalogo({ code: "23514", message: "anúncio particular exige cidade e UF" })
        .mensagem,
    ).toBe("Confira a cidade e a UF informadas.");
    expect(
      mapearErroBancoCatalogo({ code: "23514", constraint: "catalogo_item_versao_preco" }).mensagem,
    ).toBe("Confira o preço informado.");
  });
});
