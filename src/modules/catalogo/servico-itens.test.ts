import { describe, expect, it, vi } from "vitest";
import {
  criarServicoItens,
  mapearErroBancoCatalogo,
  paraItemPublico,
  type ClienteBancoItens,
  type LinhaItem,
  type LinhaItemPublico,
  type LinhaItemVersao,
} from "./index";

const DONO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CAT_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FOTO = "item/00000000-0000-4000-8000-0000000000aa/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.jpg";
const PERFIL = "99999999-9999-4999-8999-999999999999";

/**
 * Banco em memória que imita o contrato novo: item nasce por RPC (sem INSERT direto), a posse é dada só por
 * estar na lista "meus" (o dono fica num mapa interno nunca exposto), uma versão aberta, pendente imutável.
 */
function fakeBanco(contaId = DONO) {
  const itens = new Map<string, LinhaItem>();
  const donos = new Map<string, string>();
  const versoes = new Map<string, LinhaItemVersao>();
  let seq = 0;
  let relogio = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const t = () => new Date(Date.UTC(2026, 9, 1, 0, 0, ++relogio)).toISOString();
  const meu = (iid: string) => donos.get(iid) === contaId;

  const banco: ClienteBancoItens = {
    criarItem: vi.fn(async (c) => {
      const { tipo, perfil_id, ...cols } = c;
      const i: LinhaItem = {
        id: id(),
        perfil_id,
        tipo,
        publicado: false,
        versao_aprovada_id: null,
        criado_em: t(),
        atualizado_em: t(),
      };
      itens.set(i.id, i);
      donos.set(i.id, contaId);
      const v: LinhaItemVersao = {
        id: id(),
        item_id: i.id,
        situacao: "rascunho",
        foto_path: null,
        criado_em: t(),
        enviada_em: null,
        ...cols,
      };
      versoes.set(v.id, v);
      return { dados: { item_id: i.id, versao_id: v.id }, erro: null };
    }),
    buscarMeuItem: vi.fn(async (itemId) => ({
      dados: meu(itemId) ? (itens.get(itemId) ?? null) : null,
      erro: null,
    })),
    listarMeusItens: vi.fn(async () => ({
      dados: [...itens.values()].filter((i) => meu(i.id)),
      erro: null,
    })),
    listarVersoes: vi.fn(async (ids) => ({
      dados: [...versoes.values()].filter((v) => ids.includes(v.item_id) && meu(v.item_id)),
      erro: null,
    })),
    inserirVersao: vi.fn(async (c) => {
      const aberta = [...versoes.values()].find(
        (v) => v.item_id === c.item_id && ["rascunho", "pendente"].includes(v.situacao),
      );
      if (aberta) {
        return {
          dados: null,
          erro: { code: "23505", constraint: "catalogo_item_versao_uma_aberta" },
        };
      }
      const l: LinhaItemVersao = {
        id: id(),
        situacao: "rascunho",
        criado_em: t(),
        enviada_em: null,
        ...c,
      };
      versoes.set(l.id, l);
      return { dados: l, erro: null };
    }),
    atualizarVersao: vi.fn(async (versaoId, c) => {
      const v = versoes.get(versaoId);
      if (!v) return { dados: null, erro: null };
      if (v.situacao !== "rascunho") {
        return { dados: null, erro: { code: "42501", message: "versão enviada é imutável" } };
      }
      const novo = { ...v, ...c };
      versoes.set(versaoId, novo);
      return { dados: novo, erro: null };
    }),
    enviarVersao: vi.fn(async (versaoId) => {
      const v = versoes.get(versaoId);
      if (!v) return { erro: { code: "42501", message: "versão não encontrada" } };
      versoes.set(versaoId, { ...v, situacao: "pendente", enviada_em: t() });
      return { erro: null };
    }),
    definirPublicado: vi.fn(async (itemId, publicado) => {
      const i = itens.get(itemId);
      if (!i || !meu(itemId)) return { dados: null, erro: null };
      if (publicado && !i.versao_aprovada_id) {
        return {
          dados: null,
          erro: { code: "23514", constraint: "catalogo_item_publicado_exige_aprovada" },
        };
      }
      const novo = { ...i, publicado };
      itens.set(itemId, novo);
      return { dados: novo, erro: null };
    }),
  };

  /** Simula a decisão do administrador no banco. */
  function aprovar(versaoId: string) {
    const v = versoes.get(versaoId)!;
    versoes.set(versaoId, { ...v, situacao: "aprovada" });
    const i = itens.get(v.item_id)!;
    itens.set(i.id, { ...i, versao_aprovada_id: versaoId });
  }
  function rejeitar(versaoId: string) {
    const v = versoes.get(versaoId)!;
    versoes.set(versaoId, { ...v, situacao: "rejeitada" });
  }
  return { banco, itens, donos, versoes, aprovar, rejeitar };
}

/** Caminho opaco válido na pasta do item (o upload acontece depois de criar o item). */
const foto = (itemId: string, n = 1, ext = "jpg") =>
  `item/${itemId}/aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}.${ext}`;

/** Item de PERFIL: herda cidade/UF do perfil (D-008), então não traz localização. */
const validoPerfil = {
  tipo: "produto" as const,
  nome: "Bolo de cenoura",
  descricao: "Bolo caseiro com cobertura de chocolate.",
  categoriaPrincipalId: CAT_A,
  preco: { modo: "fixo" as const, centavos: 4500 },
};
/** Anúncio particular: cidade e UF obrigatórias (D-008, IM-015). */
const valido = { ...validoPerfil, cidade: "Campinas", uf: "SP" };

/** Fluxo na ordem certa: criar item -> enviar foto -> gravar a foto na versão (editar). */
async function criarPronto(f = fakeBanco()) {
  const svc = criarServicoItens(f.banco);
  const c = await svc.criarRascunho(valido);
  if (!c.ok) throw new Error("falha ao criar");
  const e = await svc.editar(c.valor.id, { fotoPath: foto(c.valor.id) });
  if (!e.ok) throw new Error("falha ao gravar a foto");
  return { ...f, svc, item: e.valor.item };
}

describe("itens: criação (IM-014, IM-015)", () => {
  it("cria produto de perfil e serviço sem preço", async () => {
    const f = fakeBanco();
    const svc = criarServicoItens(f.banco);
    const r = await svc.criarRascunho({ ...validoPerfil, perfilId: PERFIL });
    expect(r.ok && r.valor.perfilId).toBe(PERFIL);
    expect(r.ok && r.valor.anuncioParticular).toBe(false);
    const s = await svc.criarRascunho({
      tipo: "servico",
      nome: "Corte de cabelo",
      cidade: "Campinas",
      uf: "SP",
    });
    expect(s.ok && s.valor.conteudoEdicao.preco).toBeNull();
    expect(s.ok && s.valor.estado.rotulo).toBe("Rascunho");
  });

  it("anúncio particular fica vinculado à conta, sem perfil", async () => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).criarRascunho(valido);
    expect(r.ok && r.valor.anuncioParticular).toBe(true);
    expect(vi.mocked(f.banco.criarItem).mock.calls[0]![0]).toMatchObject({
      perfil_id: null,
      tipo: "produto",
      nome: "Bolo de cenoura",
    });
    expect(f.donos.get(r.ok ? r.valor.id : "")).toBe(DONO);
  });

  it("cria por RPC única, sem parâmetro de dono e sem foto (o item precisa existir antes do upload)", async () => {
    const f = fakeBanco();
    await criarServicoItens(f.banco).criarRascunho({ ...valido, fotoPath: FOTO });
    expect(f.banco.criarItem).toHaveBeenCalledTimes(1);
    const chamada = vi.mocked(f.banco.criarItem).mock.calls[0]![0];
    expect(Object.keys(chamada)).not.toContain("foto_path");
    expect(Object.keys(chamada)).not.toContain("conta_id");
    expect(JSON.stringify(chamada)).not.toMatch(/conta|dono|item\//);
    expect([...f.versoes.values()][0]!.foto_path).toBeNull();
  });

  it("o contrato do dono não lê conta_id: só a lista 'meus' prova a posse", async () => {
    const f = fakeBanco();
    const svc = criarServicoItens(f.banco);
    await svc.criarRascunho(valido);
    for (const velho of ["contaId", "buscarItem", "inserirItem"]) {
      expect(f.banco).not.toHaveProperty(velho);
    }
    const lista = await svc.listarMeus();
    expect(JSON.stringify(lista)).not.toContain(DONO);
    expect(JSON.stringify(lista)).not.toMatch(/conta_id/i);
  });

  it("serviço não tem estoque: campo de estoque na entrada é descartado", async () => {
    const f = fakeBanco();
    await criarServicoItens(f.banco).criarRascunho({ tipo: "servico", nome: "X", estoque: 5 });
    expect(JSON.stringify(vi.mocked(f.banco.criarItem).mock.calls)).not.toMatch(/estoque/);
  });

  it("descarta campos que o cliente não pode definir (situação, aprovada, dono)", async () => {
    const f = fakeBanco();
    await criarServicoItens(f.banco).criarRascunho({
      ...valido,
      situacao: "aprovada",
      versao_aprovada_id: "x",
      publicado: true,
      conta_id: OUTRO,
    });
    const chamada = JSON.stringify(vi.mocked(f.banco.criarItem).mock.calls);
    expect(chamada).not.toMatch(/aprovada|publicado|x"|conta/);
    expect(f.donos.get([...f.itens.keys()][0]!)).toBe(DONO);
  });

  it.each([
    ["tipo inválido", { ...valido, tipo: "vaga" }],
    ["quarta categoria", { ...valido, categoriasSecundariasIds: [CAT_B, CAT_C, CAT_D] }],
    ["categoria repetida", { ...valido, categoriasSecundariasIds: [CAT_A] }],
    ["secundária sem principal", { tipo: "produto", categoriasSecundariasIds: [CAT_B] }],
    ["preço zero", { ...valido, preco: { modo: "fixo", centavos: 0 } }],
    ["fixo sem valor", { ...valido, preco: { modo: "fixo" } }],
    ["nome muito longo", { ...valido, nome: "a".repeat(101) }],
    ["descrição muito longa", { ...valido, descricao: "a".repeat(1501) }],
    ["perfil não é uuid", { ...validoPerfil, perfilId: "abc" }],
  ])("recusa %s sem tocar no banco", async (_n, entrada) => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).criarRascunho(entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    expect(f.banco.criarItem).not.toHaveBeenCalled();
  });
});

describe("itens: prévia e envio (IM-017, IM-021)", () => {
  it("prévia tem o formato da página pública, com preço formatado e sem dono", async () => {
    const { svc, item } = await criarPronto();
    const r = await svc.previa(item.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.item.precoTexto).toBe("R$ 45,00");
    expect(r.valor.item.nome).toBe("Bolo de cenoura");
    expect(r.valor.podeEnviar).toBe(true);
    // O caminho da imagem é opaco (item/<item_id>/<uuid>.<ext>): nada do dono em lugar nenhum.
    expect(JSON.stringify(r.valor)).not.toContain(DONO);
    expect(Object.keys(r.valor.item)).not.toContain("conta_id");
  });

  it("não envia incompleto e lista o que falta", async () => {
    const f = fakeBanco();
    const svc = criarServicoItens(f.banco);
    const c = await svc.criarRascunho({
      tipo: "produto",
      nome: "Só o nome",
      cidade: "Campinas",
      uf: "SP",
    });
    if (!c.ok) throw new Error();
    const r = await svc.enviarParaAprovacao(c.valor.id);
    expect(!r.ok && r.erro.codigo).toBe("INCOMPLETO");
    expect(!r.ok && r.erro.pendencias).toEqual([
      "Informe a descrição.",
      "Envie uma foto.",
      "Escolha a categoria principal.",
    ]);
    expect(f.banco.enviarVersao).not.toHaveBeenCalled();
  });

  it("envia o rascunho e fica aguardando aprovação; nada fica público", async () => {
    const { svc, item, banco, itens } = await criarPronto();
    const r = await svc.enviarParaAprovacao(item.id);
    expect(r.ok && r.valor.estado.rotulo).toBe("Aguardando aprovação");
    expect(banco.enviarVersao).toHaveBeenCalledTimes(1);
    expect(itens.get(item.id)!.publicado).toBe(false);
  });

  it("não reenvia o que já está em análise", async () => {
    const { svc, item } = await criarPronto();
    await svc.enviarParaAprovacao(item.id);
    const r = await svc.enviarParaAprovacao(item.id);
    expect(!r.ok && r.erro.codigo).toBe("EM_ANALISE");
  });
});

describe("itens: edição e versões (IM-022)", () => {
  async function publicado() {
    const ctx = await criarPronto();
    await ctx.svc.enviarParaAprovacao(ctx.item.id);
    const v = [...ctx.versoes.values()][0]!;
    ctx.aprovar(v.id);
    const p = await ctx.svc.publicar(ctx.item.id);
    expect(p.ok && p.valor.estado.noAr).toBe(true);
    return { ...ctx, versaoAprovadaId: v.id };
  }

  it("editar rascunho atualiza a mesma versão", async () => {
    const { svc, item, versoes } = await criarPronto();
    const r = await svc.editar(item.id, { nome: "Bolo de fubá" });
    expect(r.ok && r.valor.criouNovaVersao).toBe(false);
    expect(versoes.size).toBe(1);
    expect(r.ok && r.valor.item.conteudoEdicao.nome).toBe("Bolo de fubá");
    expect(r.ok && r.valor.item.conteudoEdicao.descricao).toBe(valido.descricao);
  });

  it("editar item público cria versão nova e mantém a aprovada no ar", async () => {
    const { svc, item, versoes, itens, versaoAprovadaId } = await publicado();
    const r = await svc.editar(item.id, { nome: "Bolo de cenoura premium" });
    expect(r.ok && r.valor.criouNovaVersao).toBe(true);
    expect(versoes.size).toBe(2);
    expect(versoes.get(versaoAprovadaId)!.nome).toBe("Bolo de cenoura");
    expect(versoes.get(versaoAprovadaId)!.situacao).toBe("aprovada");
    expect(itens.get(item.id)!.versao_aprovada_id).toBe(versaoAprovadaId);
    expect(itens.get(item.id)!.publicado).toBe(true);
    if (r.ok) {
      expect(r.valor.item.conteudoNoAr?.nome).toBe("Bolo de cenoura");
      expect(r.valor.item.conteudoEdicao.nome).toBe("Bolo de cenoura premium");
      expect(r.valor.item.conteudoEdicao.preco).toEqual(valido.preco);
      expect(r.valor.item.estado.rotulo).toBe("Edição em rascunho");
    }
  });

  it("edição enviada fica pendente e bloqueia nova edição; a aprovada segue no ar", async () => {
    const { svc, item } = await publicado();
    await svc.editar(item.id, { nome: "Novo nome" });
    const env = await svc.enviarParaAprovacao(item.id);
    expect(env.ok && env.valor.estado.rotulo).toBe("Edição aguardando aprovação");
    expect(env.ok && env.valor.estado.noAr).toBe(true);
    const outra = await svc.editar(item.id, { nome: "Outro" });
    expect(!outra.ok && outra.erro.codigo).toBe("EM_ANALISE");
  });

  it("edição rejeitada não derruba a aprovada; nova edição parte da rejeitada", async () => {
    const { svc, item, versoes, itens, rejeitar, versaoAprovadaId } = await publicado();
    await svc.editar(item.id, { nome: "Nome ruim" });
    await svc.enviarParaAprovacao(item.id);
    const pendente = [...versoes.values()].find((v) => v.situacao === "pendente")!;
    rejeitar(pendente.id);
    expect(itens.get(item.id)!.versao_aprovada_id).toBe(versaoAprovadaId);
    const obter = await svc.obter(item.id);
    expect(obter.ok && obter.valor.estado.rotulo).toBe("Edição rejeitada");
    const r = await svc.editar(item.id, { descricao: "Descrição melhor" });
    expect(r.ok && r.valor.criouNovaVersao).toBe(true);
    expect(r.ok && r.valor.item.conteudoEdicao.nome).toBe("Nome ruim");
  });

  it("editar item DESPUBLICADO não o republica", async () => {
    const { svc, item, banco, itens } = await publicado();
    const d = await svc.despublicar(item.id);
    expect(d.ok && d.valor.publicado).toBe(false);
    vi.mocked(banco.definirPublicado).mockClear();
    const r = await svc.editar(item.id, { nome: "Nome novo" });
    expect(r.ok).toBe(true);
    await svc.enviarParaAprovacao(item.id);
    expect(banco.definirPublicado).not.toHaveBeenCalled();
    expect(itens.get(item.id)!.publicado).toBe(false);
    expect(r.ok && r.valor.item.estado.noAr).toBe(false);
  });

  it("recusa edição inválida sem criar versão", async () => {
    const { svc, item, versoes } = await publicado();
    const antes = versoes.size;
    const r = await svc.editar(item.id, { categoriasSecundariasIds: [CAT_B, CAT_C, CAT_D] });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    const r2 = await svc.editar(item.id, { preco: { modo: "fixo", centavos: 0 } });
    expect(r2.ok).toBe(false);
    expect(versoes.size).toBe(antes);
  });

  it("foto: só caminho opaco da pasta do PRÓPRIO item, com uuid e extensão permitida", async () => {
    const { svc, item, versoes } = await criarPronto();
    const id = item.id;
    const outroItem = "99999999-9999-4999-8999-999999999998";
    for (const fotoPath of [
      foto(outroItem),
      `perfil/${id}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.jpg`,
      `${DONO}/foto-1.jpg`, // caminho antigo, por conta
      `item/${DONO}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.jpg`,
      `item/${id}/foto.jpg`, // nome não é uuid
      `item/${id}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.svg`,
      `item/${id}/../x.jpg`,
    ]) {
      const r = await svc.editar(id, { fotoPath });
      expect(!r.ok && r.erro.codigo, fotoPath).toBe("VALIDACAO");
    }
    const ok = await svc.editar(id, { fotoPath: foto(id, 2, "webp") });
    expect(ok.ok && ok.valor.item.conteudoEdicao.fotoPath).toBe(foto(id, 2, "webp"));
    expect(versoes.size).toBe(1);
  });

  it("secundária igual à principal que já existe na base é recusada depois do patch", async () => {
    const { svc, item } = await criarPronto();
    const r = await svc.editar(item.id, { categoriasSecundariasIds: [CAT_A] });
    expect(!r.ok && r.erro.campos).toHaveProperty("categoriasSecundariasIds");
  });

  it("limpar o preço (null) e depois definir sob consulta", async () => {
    const { svc, item } = await criarPronto();
    const a = await svc.editar(item.id, { preco: null });
    expect(a.ok && a.valor.item.conteudoEdicao.preco).toBeNull();
    const b = await svc.editar(item.id, { preco: { modo: "sob_consulta" } });
    expect(b.ok && b.valor.item.conteudoEdicao.preco).toEqual({
      modo: "sob_consulta",
      centavos: null,
    });
  });

  it("item de outra conta é tratado como inexistente", async () => {
    const f = fakeBanco(DONO);
    const svc = criarServicoItens(f.banco);
    const r = await svc.criarRascunho(valido);
    if (!r.ok) throw new Error();
    f.donos.set(r.valor.id, OUTRO); // a linha sai da lista "meus"; o contrato não tem coluna de dono
    for (const res of [
      await svc.editar(r.valor.id, { nome: "x" }),
      await svc.obter(r.valor.id),
      await svc.previa(r.valor.id),
      await svc.despublicar(r.valor.id),
    ]) {
      expect(!res.ok && res.erro.codigo).toBe("NAO_ENCONTRADO");
    }
    expect(f.banco.atualizarVersao).not.toHaveBeenCalled();
  });

  it("id que não é uuid não chega ao banco", async () => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).obter("1; drop table");
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
    expect(f.banco.buscarMeuItem).not.toHaveBeenCalled();
  });
});

describe("itens: publicar e despublicar (IM-079)", () => {
  it("não publica o que não foi aprovado", async () => {
    const { svc, item, banco } = await criarPronto();
    const r = await svc.publicar(item.id);
    expect(!r.ok && r.erro.codigo).toBe("NAO_APROVADO");
    expect(banco.definirPublicado).not.toHaveBeenCalled();
  });

  it("despublicar é imediato e independe de aprovação", async () => {
    const ctx = await criarPronto();
    await ctx.svc.enviarParaAprovacao(ctx.item.id);
    ctx.aprovar([...ctx.versoes.values()][0]!.id);
    await ctx.svc.publicar(ctx.item.id);
    const r = await ctx.svc.despublicar(ctx.item.id);
    expect(r.ok && r.valor.publicado).toBe(false);
    expect(r.ok && r.valor.estado.rotulo).toBe("Despublicado");
    expect(r.ok && r.valor.versaoAprovadaId).not.toBeNull();
  });
});

describe("itens: listagem", () => {
  it("lista só os da própria conta com o estado de cada um", async () => {
    const f = fakeBanco();
    const svc = criarServicoItens(f.banco);
    await svc.criarRascunho(valido);
    await svc.criarRascunho({ tipo: "servico", nome: "Aula", cidade: "Recife", uf: "PE" });
    const r = await svc.listarMeus();
    expect(r.ok && r.valor).toHaveLength(2);
    expect(r.ok && r.valor.map((i) => i.estado.rotulo)).toEqual(["Rascunho", "Rascunho"]);
  });
  it("sem itens não consulta versões", async () => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).listarMeus();
    expect(r.ok && r.valor).toEqual([]);
    expect(f.banco.listarVersoes).not.toHaveBeenCalled();
  });
});

describe("itens: erros do banco e privacidade (IM-029, IM-086)", () => {
  it("23514 de preço, 23505 de versão aberta e 42501 viram mensagens pt-BR sem texto do banco", () => {
    const segredo = "SEGREDO-DO-BANCO";
    const casos = [
      { code: "23514", constraint: "catalogo_item_versao_preco", message: segredo },
      { code: "23514", constraint: "catalogo_item_versao_completa", message: segredo },
      { code: "23514", message: `categoria inexistente ou inativa ${segredo}` },
      { code: "23505", constraint: "catalogo_item_versao_uma_aberta", details: segredo },
      { code: "23505", constraint: "catalogo_categoria_slug_unico", details: segredo },
      { code: "42501", message: `versão enviada é imutável ${segredo}` },
      { code: "42501", message: segredo },
      { code: "P0001", message: `limite de 5 pedidos pendentes ${segredo}` },
      { code: "P0002", message: segredo },
      { code: "XX000", message: segredo },
      { code: "42501", message: `item não encontrado ${segredo}` },
    ];
    for (const c of casos) {
      const e = mapearErroBancoCatalogo(c);
      expect(e.mensagem).not.toContain(segredo);
      expect(e.mensagem).not.toMatch(/constraint|violates|catalogo_|SQL/i);
      expect(e.mensagem.length).toBeGreaterThan(10);
    }
    expect(mapearErroBancoCatalogo(casos[0]!).codigo).toBe("VALIDACAO");
    expect(mapearErroBancoCatalogo(casos[1]!).codigo).toBe("INCOMPLETO");
    expect(mapearErroBancoCatalogo(casos[2]!).codigo).toBe("CATEGORIA_INVALIDA");
    expect(mapearErroBancoCatalogo(casos[3]!).codigo).toBe("CONFLITO");
    expect(mapearErroBancoCatalogo(casos[4]!).codigo).toBe("CATEGORIA_DUPLICADA");
    expect(mapearErroBancoCatalogo(casos[5]!).codigo).toBe("EM_ANALISE");
    expect(mapearErroBancoCatalogo(casos[6]!).codigo).toBe("SEM_PERMISSAO");
    expect(mapearErroBancoCatalogo(casos[7]!).codigo).toBe("LIMITE_SOLICITACOES");
    expect(mapearErroBancoCatalogo(casos[9]!).codigo).toBe("ERRO_INTERNO");
    expect(mapearErroBancoCatalogo(casos[10]!).codigo).toBe("NAO_ENCONTRADO");
  });

  it("exceção do banco injetado vira erro genérico, sem vazar a mensagem", async () => {
    const f = fakeBanco();
    f.banco.criarItem = async () => {
      throw new Error("connection string postgres://segredo");
    };
    const r = await criarServicoItens(f.banco).criarRascunho(valido);
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toMatch(/postgres|segredo/);
  });

  it("modelo público ignora colunas extras (conta_id, e-mail, telefone)", () => {
    const linha = {
      id: "i1",
      perfil_id: null,
      tipo: "produto",
      nome: "Bolo",
      descricao: "Bom",
      foto_path: FOTO,
      categoria_principal_id: CAT_A,
      categoria_secundaria_1_id: null,
      categoria_secundaria_2_id: null,
      preco_modo: "a_partir_de",
      preco_centavos: "1500",
      criado_em: "2026-10-01T00:00:00Z",
      // não deveriam existir na visão, mas o modelo não pode repassar:
      conta_id: DONO,
      email: "dono@exemplo.com",
      whatsapp_e164: "+5511999990001",
    } as LinhaItemPublico;
    const m = paraItemPublico(linha);
    const json = JSON.stringify({ ...m, fotoPath: null });
    expect(json).not.toContain(DONO);
    expect(json).not.toContain("dono@exemplo.com");
    expect(json).not.toContain("5511999990001");
    expect(m.anuncioParticular).toBe(true);
    expect(m.precoTexto).toBe("A partir de R$ 15,00");
    expect(Object.keys(m).sort()).toEqual(
      [
        "anuncioParticular",
        "categoriaPrincipalId",
        "categoriasSecundariasIds",
        "cidade",
        "descricao",
        "fotoPath",
        "id",
        "nome",
        "perfilId",
        "preco",
        "precoTexto",
        "tipo",
        "uf",
      ].sort(),
    );
  });
});

describe("itens: obterVersaoParaRevisao (IM-021, IM-023, IM-029)", () => {
  const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  async function cenario(admin: boolean) {
    const ctx = await criarPronto();
    await ctx.svc.enviarParaAprovacao(ctx.item.id);
    const versao = [...ctx.versoes.values()][0]!;
    const lerAlheia = vi.fn(async (vid: string) => {
      const v = ctx.versoes.get(vid);
      const i = v ? ctx.itens.get(v.item_id) : undefined;
      if (!v || !i) return { dados: null, erro: null };
      return {
        dados: {
          item: { id: i.id, perfil_id: i.perfil_id, tipo: i.tipo, conta_id: DONO },
          versao: { ...v, conta_id: DONO, email: "dono@exemplo.com" },
        },
        erro: null,
      };
    });
    const banco: ClienteBancoItens = {
      ...fakeBanco(ADMIN).banco,
      ehAdministrador: vi.fn(async () => admin),
      buscarVersaoParaRevisao: lerAlheia,
    };
    return { versao, item: ctx.item, lerAlheia, svc: criarServicoItens(banco) };
  }

  it("administrador obtém a versão alheia no formato de exibição, sem dono", async () => {
    const { svc, versao, item } = await cenario(true);
    const r = await svc.obterVersaoParaRevisao(versao.id);
    if (!r.ok) throw new Error(JSON.stringify(r.erro));
    expect(r.valor.versaoId).toBe(versao.id);
    expect(r.valor.situacao).toBe("pendente");
    expect(r.valor.item.id).toBe(item.id);
    const json = JSON.stringify(r);
    expect(json).not.toContain(DONO);
    expect(json).not.toMatch(/conta_id|email/i);
  });

  it("não administrador não obtém versão alheia e o banco nem é lido", async () => {
    const { svc, versao, lerAlheia } = await cenario(false);
    const r = await svc.obterVersaoParaRevisao(versao.id);
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    expect(lerAlheia).not.toHaveBeenCalled();
  });

  it("falha fechado sem a checagem; id inválido ou inexistente = NAO_ENCONTRADO", async () => {
    const { versao, svc } = await cenario(true);
    const sem = await criarServicoItens(fakeBanco(ADMIN).banco).obterVersaoParaRevisao(versao.id);
    expect(!sem.ok && sem.erro.codigo).toBe("SEM_PERMISSAO");
    const a = await svc.obterVersaoParaRevisao("nao-e-uuid");
    expect(!a.ok && a.erro.codigo).toBe("NAO_ENCONTRADO");
    const b = await svc.obterVersaoParaRevisao("00000000-0000-4000-8000-0000000000ff");
    expect(!b.ok && b.erro.codigo).toBe("NAO_ENCONTRADO");
  });
});

describe("itens: localização do anúncio particular (D-008, IM-015)", () => {
  const rejeita = async (entrada: Record<string, unknown>, campo: string) => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).criarRascunho(entrada);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(!r.ok && Object.keys(r.erro.campos ?? {})).toContain(campo);
    expect(f.banco.criarItem).not.toHaveBeenCalled();
  };

  it("anúncio particular com cidade e UF é criado e grava a localização", async () => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).criarRascunho({
      ...validoPerfil,
      cidade: "  São Paulo ",
      uf: "sp",
    });
    expect(r.ok && r.valor.conteudoEdicao.cidade).toBe("São Paulo");
    expect(r.ok && r.valor.conteudoEdicao.uf).toBe("SP");
    expect(f.banco.criarItem).toHaveBeenCalledWith(
      expect.objectContaining({ cidade: "São Paulo", uf: "SP", perfil_id: null }),
    );
  });

  it("anúncio particular SEM cidade é recusado", () =>
    rejeita({ ...validoPerfil, uf: "SP" }, "cidade"));
  it("anúncio particular SEM UF é recusado", () =>
    rejeita({ ...validoPerfil, cidade: "Campinas" }, "uf"));
  it("anúncio particular sem nenhum dos dois é recusado", async () => {
    await rejeita(validoPerfil, "cidade");
    await rejeita(validoPerfil, "uf");
  });
  it("cidade em branco, de 1 letra ou com mais de 80 é recusada", async () => {
    await rejeita({ ...valido, cidade: "   " }, "cidade");
    await rejeita({ ...valido, cidade: "A" }, "cidade");
    await rejeita({ ...valido, cidade: "x".repeat(81) }, "cidade");
  });
  it("UF inexistente ou com formato errado é recusada", async () => {
    await rejeita({ ...valido, uf: "XX" }, "uf");
    await rejeita({ ...valido, uf: "SPP" }, "uf");
    await rejeita({ ...valido, uf: "S" }, "uf");
    await rejeita({ ...valido, uf: 12 }, "uf");
  });

  it("item de PERFIL com cidade ou UF é recusado (herda do perfil)", async () => {
    await rejeita({ ...validoPerfil, perfilId: PERFIL, cidade: "Campinas" }, "cidade");
    await rejeita({ ...validoPerfil, perfilId: PERFIL, uf: "SP" }, "uf");
  });

  it("item de perfil sem localização continua sendo criado, com cidade/UF nulas", async () => {
    const f = fakeBanco();
    const r = await criarServicoItens(f.banco).criarRascunho({ ...validoPerfil, perfilId: PERFIL });
    expect(r.ok && r.valor.conteudoEdicao.cidade).toBeNull();
    expect(r.ok && r.valor.conteudoEdicao.uf).toBeNull();
  });

  it("edição do anúncio particular troca a cidade, mas não pode apagá-la", async () => {
    const { svc, item } = await criarPronto();
    const ok = await svc.editar(item.id, { cidade: "Recife", uf: "PE" });
    expect(ok.ok && ok.valor.item.conteudoEdicao.cidade).toBe("Recife");
    const limpa = await svc.editar(item.id, { cidade: null });
    expect(!limpa.ok && limpa.erro.campos).toHaveProperty("cidade");
    const ufRuim = await svc.editar(item.id, { uf: "ZZ" });
    expect(!ufRuim.ok && ufRuim.erro.codigo).toBe("VALIDACAO");
  });

  it("edição de item de perfil não aceita cidade nem UF", async () => {
    const f = fakeBanco();
    const svc = criarServicoItens(f.banco);
    const c = await svc.criarRascunho({ ...validoPerfil, perfilId: PERFIL });
    if (!c.ok) throw new Error();
    const r = await svc.editar(c.valor.id, { cidade: "Campinas", uf: "SP" });
    expect(!r.ok && r.erro.campos).toHaveProperty("cidade");
    expect(!r.ok && r.erro.campos).toHaveProperty("uf");
    expect(f.banco.atualizarVersao).not.toHaveBeenCalled();
  });

  it("modelo público do anúncio particular mostra cidade/UF; item de perfil mostra null", () => {
    const base = {
      id: "i1",
      perfil_id: null,
      tipo: "produto" as const,
      nome: "Bike",
      descricao: null,
      foto_path: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: null,
      categoria_secundaria_2_id: null,
      preco_modo: null,
      preco_centavos: null,
      criado_em: "2026-10-01T00:00:00Z",
    };
    const a = paraItemPublico({ ...base, cidade: "Campinas", uf: "SP" });
    expect([a.cidade, a.uf, a.anuncioParticular]).toEqual(["Campinas", "SP", true]);
    const p = paraItemPublico({ ...base, perfil_id: PERFIL });
    expect([p.cidade, p.uf]).toEqual([null, null]);
  });

  it("erro de CHECK de localização no banco vira mensagem genérica em pt-BR", () => {
    const e = mapearErroBancoCatalogo({
      code: "23514",
      constraint: "catalogo_item_versao_localizacao",
      message: "new row for relation violates check constraint (dados internos)",
    });
    expect(e.codigo).toBe("VALIDACAO");
    expect(e.mensagem).toBe("Confira a cidade e a UF informadas.");
    expect(e.mensagem).not.toMatch(/relation|constraint/i);
  });
});
