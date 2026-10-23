import { describe, expect, it, vi } from "vitest";
import {
  criarServicoPerfis,
  mapearErroBancoPerfis,
  paraPerfilExibicao,
  paraPerfilPublico,
  type ClienteBancoPerfis,
  type LinhaPerfil,
  type LinhaPerfilPublico,
  type LinhaVersaoPerfil,
} from "./index";

const DONO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WHATS = "(19) 99999-0001";
const WHATS_E164 = "+5519999990001";

/** Banco em memória que imita o contrato (slug único, uma versão aberta, enviada é imutável). */
function fakeBanco(contaId = DONO, slugsOcupados: string[] = []) {
  const perfis = new Map<string, LinhaPerfil>();
  const versoes = new Map<string, LinhaVersaoPerfil>();
  const contatos = new Map<string, string>();
  const slugs = new Set(slugsOcupados);
  let seq = 0;
  let relogio = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const t = () => new Date(Date.UTC(2026, 9, 1, 0, 0, ++relogio)).toISOString();
  const comContato = (v: LinhaVersaoPerfil): LinhaVersaoPerfil => ({
    ...v,
    whatsapp_comercial_e164: contatos.get(v.id) ?? null,
  });

  const banco: ClienteBancoPerfis = {
    contaId,
    inserirPerfil: vi.fn(async (c) => {
      if (slugs.has(c.slug)) {
        return {
          dados: null,
          erro: {
            code: "23505",
            constraint: "perfis_perfil_slug_unico",
            message: 'duplicate key value violates unique constraint "perfis_perfil_slug_unico"',
          },
        };
      }
      slugs.add(c.slug);
      const l: LinhaPerfil = {
        id: id(),
        responsavel_id: c.responsavel_id,
        slug: c.slug,
        publicado: false,
        versao_aprovada_id: null,
        criado_em: t(),
        atualizado_em: t(),
      };
      perfis.set(l.id, l);
      return { dados: l, erro: null };
    }),
    buscarPerfil: vi.fn(async (pid) => ({ dados: perfis.get(pid) ?? null, erro: null })),
    listarMeusPerfis: vi.fn(async () => ({
      dados: [...perfis.values()].filter((p) => p.responsavel_id === contaId),
      erro: null,
    })),
    listarVersoes: vi.fn(async (ids) => ({
      dados: [...versoes.values()].filter((v) => ids.includes(v.perfil_id)).map(comContato),
      erro: null,
    })),
    inserirVersao: vi.fn(async (c) => {
      const aberta = [...versoes.values()].find(
        (v) => v.perfil_id === c.perfil_id && ["rascunho", "pendente"].includes(v.situacao),
      );
      if (aberta) {
        return { dados: null, erro: { code: "23505", constraint: "perfis_versao_uma_aberta" } };
      }
      const l: LinhaVersaoPerfil = {
        id: id(),
        situacao: "rascunho",
        criado_em: t(),
        enviada_em: null,
        whatsapp_comercial_e164: null,
        ...c,
      };
      versoes.set(l.id, l);
      return { dados: l, erro: null };
    }),
    atualizarVersao: vi.fn(async (vid, c) => {
      const v = versoes.get(vid);
      if (!v) return { dados: null, erro: null };
      if (v.situacao !== "rascunho") {
        return { dados: null, erro: { code: "42501", message: "versão enviada é imutável" } };
      }
      const novo = { ...v, ...c };
      versoes.set(vid, novo);
      return { dados: comContato(novo), erro: null };
    }),
    gravarContato: vi.fn(async (vid, e164) => {
      if (versoes.get(vid)?.situacao !== "rascunho") {
        return {
          erro: { code: "42501", message: "WhatsApp comercial de versão enviada é imutável" },
        };
      }
      if (e164 === null) contatos.delete(vid);
      else contatos.set(vid, e164);
      return { erro: null };
    }),
    enviarVersao: vi.fn(async (vid) => {
      const v = versoes.get(vid);
      if (!v) return { erro: { code: "42501", message: "versão não encontrada" } };
      if (!contatos.has(vid)) {
        return { erro: { code: "23514", message: "WhatsApp comercial é obrigatório" } };
      }
      versoes.set(vid, { ...v, situacao: "pendente", enviada_em: t() });
      return { erro: null };
    }),
    atualizarPerfil: vi.fn(async (pid, c) => {
      const p = perfis.get(pid);
      if (!p) return { dados: null, erro: null };
      if (c.publicado && !p.versao_aprovada_id) {
        return {
          dados: null,
          erro: { code: "23514", constraint: "perfis_perfil_publicado_exige_aprovada" },
        };
      }
      if (c.slug && p.versao_aprovada_id) {
        return {
          dados: null,
          erro: { code: "42501", message: "slug não muda depois da primeira aprovação" },
        };
      }
      if (c.slug && slugs.has(c.slug)) {
        return { dados: null, erro: { code: "23505", constraint: "perfis_perfil_slug_unico" } };
      }
      const novo = { ...p, ...c };
      perfis.set(pid, novo);
      return { dados: novo, erro: null };
    }),
  };

  function aprovar(vid: string) {
    const v = versoes.get(vid)!;
    versoes.set(vid, { ...v, situacao: "aprovada" });
    perfis.set(v.perfil_id, { ...perfis.get(v.perfil_id)!, versao_aprovada_id: vid });
  }
  function rejeitar(vid: string) {
    versoes.set(vid, { ...versoes.get(vid)!, situacao: "rejeitada" });
  }
  return { banco, perfis, versoes, contatos, slugs, aprovar, rejeitar };
}

const valido = {
  nome: "Padaria Pão Quente",
  descricaoBreve: "Pães e bolos fresquinhos.",
  imagemPath: `${DONO}/logo.png`,
  categoriaPrincipalId: CAT_A,
  cidade: "Campinas",
  uf: "SP",
  whatsappComercial: WHATS,
};

async function criarPronto(f = fakeBanco()) {
  const svc = criarServicoPerfis(f.banco);
  const r = await svc.criarRascunho(valido);
  if (!r.ok) throw new Error(`falha ao criar: ${JSON.stringify(r.erro)}`);
  return { ...f, svc, perfil: r.valor };
}

async function publicado() {
  const ctx = await criarPronto();
  await ctx.svc.enviarParaAprovacao(ctx.perfil.id);
  const v = [...ctx.versoes.values()][0]!;
  ctx.aprovar(v.id);
  const p = await ctx.svc.publicar(ctx.perfil.id);
  expect(p.ok && p.valor.estado.noAr).toBe(true);
  return { ...ctx, versaoAprovadaId: v.id };
}

describe("perfis: criar rascunho (IM-006, IM-011, IM-012)", () => {
  it("cria perfil + rascunho com slug do nome e WhatsApp normalizado", async () => {
    const { perfil, contatos, banco } = await criarPronto();
    expect(perfil.slug).toBe("padaria-pao-quente");
    expect(perfil.estado.rotulo).toBe("Rascunho");
    expect(perfil.publicado).toBe(false);
    expect(perfil.conteudoEdicao.whatsappComercialE164).toBe(WHATS_E164);
    expect([...contatos.values()]).toEqual([WHATS_E164]);
    expect(vi.mocked(banco.inserirPerfil).mock.calls[0]![0].responsavel_id).toBe(DONO);
  });

  it("uma conta pode ter vários perfis; slug gerado ganha sufixo se já existir", async () => {
    const f = fakeBanco(DONO, ["padaria-pao-quente"]);
    const svc = criarServicoPerfis(f.banco);
    const a = await svc.criarRascunho(valido);
    const b = await svc.criarRascunho(valido);
    expect(a.ok && a.valor.slug).toBe("padaria-pao-quente-2");
    expect(b.ok && b.valor.slug).toBe("padaria-pao-quente-3");
    const lista = await svc.listarMeus();
    expect(lista.ok && lista.valor).toHaveLength(2);
  });

  it("slug informado duplicado é recusado com mensagem clara (23505)", async () => {
    const f = fakeBanco(DONO, ["minha-loja"]);
    const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, slug: "minha-loja" });
    expect(!r.ok && r.erro.codigo).toBe("SLUG_INDISPONIVEL");
    expect(!r.ok && r.erro.mensagem).toBe("Este endereço já está em uso. Escolha outro.");
    expect(f.banco.inserirVersao).not.toHaveBeenCalled();
  });

  it.each(["entrar", "admin", "api", "minha-conta", "categorias", "perfil", "anuncio"])(
    "slug reservado %s é recusado sem tocar no banco",
    async (slug) => {
      const f = fakeBanco();
      const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, slug });
      expect(!r.ok && r.erro.codigo).toBe("SLUG_RESERVADO");
      expect(f.banco.inserirPerfil).not.toHaveBeenCalled();
    },
  );

  it("nome que gera slug reservado recebe sufixo, nunca a rota", async () => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, nome: "Admin" });
    expect(r.ok && r.valor.slug).toBe("admin-2");
  });

  it("slug informado com formato inválido é recusado", async () => {
    const f = fakeBanco();
    for (const slug of ["Minha Loja", "pão", "ab", "a_b"]) {
      const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, slug });
      expect(!r.ok && r.erro.codigo, slug).toBe("SLUG_INVALIDO");
    }
    expect(f.banco.inserirPerfil).not.toHaveBeenCalled();
  });

  it("sem nome e sem slug: validação por campo", async () => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).criarRascunho({ cidade: "Campinas" });
    expect(!r.ok && r.erro.campos).toHaveProperty("nome");
    expect(f.banco.inserirPerfil).not.toHaveBeenCalled();
  });

  it.each([
    ["informações sociais com URL", { informacoesSociais: "https://instagram.com/loja" }],
    ["informações sociais com @", { informacoesSociais: "@minhaloja" }],
    [
      "quarta categoria",
      {
        categoriasSecundariasIds: [
          CAT_B,
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        ],
      },
    ],
    ["categoria secundária repetida da principal", { categoriasSecundariasIds: [CAT_A] }],
    ["UF inválida", { uf: "ZZ" }],
    ["WhatsApp inválido", { whatsappComercial: "12345" }],
    ["imagem de outra conta", { imagemPath: `${OUTRO}/logo.png` }],
    ["foto de outra conta", { fotosPaths: [`${OUTRO}/f.jpg`] }],
    ["banner de outra conta", { bannersPaths: [`${OUTRO}/b.jpg`] }],
  ])("recusa %s sem tocar no banco", async (_n, extra) => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, ...extra });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(f.banco.inserirPerfil).not.toHaveBeenCalled();
  });

  it("descarta campos que o cliente não pode definir (situação, publicado, responsável)", async () => {
    const f = fakeBanco();
    await criarServicoPerfis(f.banco).criarRascunho({
      ...valido,
      situacao: "aprovada",
      publicado: true,
      responsavel_id: OUTRO,
      versao_aprovada_id: CAT_A,
    });
    expect(vi.mocked(f.banco.inserirPerfil).mock.calls[0]![0]).toEqual({
      responsavel_id: DONO,
      slug: "padaria-pao-quente",
    });
    const cols = JSON.stringify(vi.mocked(f.banco.inserirVersao).mock.calls);
    expect(cols).not.toMatch(/situacao|publicado|responsavel|aprovada/);
  });

  it("o WhatsApp comercial não entra nas colunas da versão (tabela à parte)", async () => {
    const f = fakeBanco();
    await criarServicoPerfis(f.banco).criarRascunho(valido);
    const cols = JSON.stringify(vi.mocked(f.banco.inserirVersao).mock.calls);
    expect(cols).not.toMatch(/whatsapp|5519999990001/i);
    expect(f.banco.gravarContato).toHaveBeenCalledTimes(1);
  });
});

describe("perfis: prévia e envio (IM-017, IM-021)", () => {
  it("prévia no formato público, sem WhatsApp nem responsável, e sem publicar", async () => {
    const { svc, perfil, perfis } = await criarPronto();
    const r = await svc.previa(perfil.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.perfil.nome).toBe("Padaria Pão Quente");
    expect(r.valor.podeEnviar).toBe(true);
    const json = JSON.stringify({ ...r.valor, perfil: { ...r.valor.perfil, imagemPath: null } });
    expect(json).not.toMatch(/5519999990001|99999-0001|whatsapp|responsavel/i);
    expect(json).not.toContain(DONO);
    expect(perfis.get(perfil.id)!.publicado).toBe(false);
  });

  it("não envia incompleto e lista o que falta", async () => {
    const f = fakeBanco();
    const svc = criarServicoPerfis(f.banco);
    const c = await svc.criarRascunho({ nome: "Só o nome" });
    if (!c.ok) throw new Error();
    const r = await svc.enviarParaAprovacao(c.valor.id);
    expect(!r.ok && r.erro.codigo).toBe("INCOMPLETO");
    expect(!r.ok && r.erro.pendencias).toEqual([
      "Informe a descrição breve.",
      "Envie a imagem do perfil.",
      "Escolha a categoria principal.",
      "Informe a cidade.",
      "Escolha a UF.",
      "Informe o WhatsApp comercial.",
    ]);
    expect(f.banco.enviarVersao).not.toHaveBeenCalled();
  });

  it("envia e fica aguardando; nada vira público", async () => {
    const { svc, perfil, perfis } = await criarPronto();
    const r = await svc.enviarParaAprovacao(perfil.id);
    expect(r.ok && r.valor.estado.rotulo).toBe("Aguardando aprovação");
    expect(perfis.get(perfil.id)!.publicado).toBe(false);
    expect(perfis.get(perfil.id)!.versao_aprovada_id).toBeNull();
  });

  it("não reenvia o que já está em análise e não publica sem aprovação", async () => {
    const { svc, perfil, banco } = await criarPronto();
    await svc.enviarParaAprovacao(perfil.id);
    const de = await svc.enviarParaAprovacao(perfil.id);
    expect(!de.ok && de.erro.codigo).toBe("EM_ANALISE");
    const p = await svc.publicar(perfil.id);
    expect(!p.ok && p.erro.codigo).toBe("NAO_APROVADO");
    expect(banco.atualizarPerfil).not.toHaveBeenCalled();
  });
});

describe("perfis: edição e versões (IM-022)", () => {
  it("editar rascunho atualiza a mesma versão", async () => {
    const { svc, perfil, versoes } = await criarPronto();
    const r = await svc.editar(perfil.id, { descricaoBreve: "Nova descrição" });
    expect(r.ok && r.valor.criouNovaVersao).toBe(false);
    expect(versoes.size).toBe(1);
    expect(r.ok && r.valor.perfil.conteudoEdicao.descricaoBreve).toBe("Nova descrição");
    expect(r.ok && r.valor.perfil.conteudoEdicao.nome).toBe("Padaria Pão Quente");
  });

  it("trocar o WhatsApp do rascunho regrava o contato", async () => {
    const { svc, perfil, contatos } = await criarPronto();
    await svc.editar(perfil.id, { whatsappComercial: "(11) 98888-7777" });
    expect([...contatos.values()]).toEqual(["+5511988887777"]);
  });

  it("editar perfil público cria versão nova (copiando o contato) e mantém a aprovada no ar", async () => {
    const { svc, perfil, versoes, perfis, versaoAprovadaId, contatos } = await publicado();
    const r = await svc.editar(perfil.id, { nome: "Padaria Nova" });
    expect(r.ok && r.valor.criouNovaVersao).toBe(true);
    expect(versoes.size).toBe(2);
    expect(versoes.get(versaoAprovadaId)!.nome).toBe("Padaria Pão Quente");
    expect(versoes.get(versaoAprovadaId)!.situacao).toBe("aprovada");
    expect(perfis.get(perfil.id)!.versao_aprovada_id).toBe(versaoAprovadaId);
    expect(perfis.get(perfil.id)!.publicado).toBe(true);
    expect(contatos.size).toBe(2);
    if (r.ok) {
      expect(r.valor.perfil.conteudoNoAr?.nome).toBe("Padaria Pão Quente");
      expect(r.valor.perfil.conteudoEdicao.nome).toBe("Padaria Nova");
      expect(r.valor.perfil.conteudoEdicao.whatsappComercialE164).toBe(WHATS_E164);
      expect(r.valor.perfil.estado.rotulo).toBe("Edição em rascunho");
      expect(r.valor.perfil.slug).toBe("padaria-pao-quente");
    }
  });

  it("edição em análise bloqueia nova edição; aprovada segue no ar", async () => {
    const { svc, perfil } = await publicado();
    await svc.editar(perfil.id, { nome: "Novo" });
    const env = await svc.enviarParaAprovacao(perfil.id);
    expect(env.ok && env.valor.estado.noAr).toBe(true);
    expect(env.ok && env.valor.estado.rotulo).toBe("Edição aguardando aprovação");
    const outra = await svc.editar(perfil.id, { nome: "Outro" });
    expect(!outra.ok && outra.erro.codigo).toBe("EM_ANALISE");
  });

  it("edição rejeitada não derruba a aprovada", async () => {
    const { svc, perfil, versoes, perfis, rejeitar, versaoAprovadaId } = await publicado();
    await svc.editar(perfil.id, { nome: "Ruim" });
    await svc.enviarParaAprovacao(perfil.id);
    rejeitar([...versoes.values()].find((v) => v.situacao === "pendente")!.id);
    expect(perfis.get(perfil.id)!.versao_aprovada_id).toBe(versaoAprovadaId);
    expect(perfis.get(perfil.id)!.publicado).toBe(true);
    const o = await svc.obter(perfil.id);
    expect(o.ok && o.valor.estado.rotulo).toBe("Edição rejeitada");
  });

  it("editar perfil DESPUBLICADO não o republica", async () => {
    const { svc, perfil, banco, perfis } = await publicado();
    const d = await svc.despublicar(perfil.id);
    expect(d.ok && d.valor.publicado).toBe(false);
    vi.mocked(banco.atualizarPerfil).mockClear();
    const r = await svc.editar(perfil.id, { nome: "Nome Novo" });
    expect(r.ok).toBe(true);
    await svc.enviarParaAprovacao(perfil.id);
    expect(banco.atualizarPerfil).not.toHaveBeenCalled();
    expect(perfis.get(perfil.id)!.publicado).toBe(false);
    expect(r.ok && r.valor.perfil.estado.noAr).toBe(false);
  });

  it("recusa edição inválida sem criar versão", async () => {
    const { svc, perfil, versoes } = await publicado();
    const antes = versoes.size;
    const r = await svc.editar(perfil.id, { informacoesSociais: "instagram.com/loja" });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    const r2 = await svc.editar(perfil.id, { imagemPath: `${OUTRO}/x.png` });
    expect(!r2.ok && r2.erro.campos).toHaveProperty("imagemPath");
    expect(versoes.size).toBe(antes);
  });

  it("limpar campos opcionais com null", async () => {
    const { svc, perfil } = await criarPronto();
    await svc.editar(perfil.id, { endereco: "Rua A", site: "meusite.com.br" });
    const r = await svc.editar(perfil.id, { endereco: null, site: null });
    expect(r.ok && r.valor.perfil.conteudoEdicao.endereco).toBeNull();
    expect(r.ok && r.valor.perfil.conteudoEdicao.site).toBeNull();
  });

  it("perfil de outra conta é tratado como inexistente", async () => {
    const f = fakeBanco();
    const svc = criarServicoPerfis(f.banco);
    const c = await svc.criarRascunho(valido);
    if (!c.ok) throw new Error();
    f.perfis.set(c.valor.id, { ...f.perfis.get(c.valor.id)!, responsavel_id: OUTRO });
    for (const r of [
      await svc.editar(c.valor.id, { nome: "x" }),
      await svc.obter(c.valor.id),
      await svc.previa(c.valor.id),
      await svc.enviarParaAprovacao(c.valor.id),
      await svc.despublicar(c.valor.id),
      await svc.alterarSlug(c.valor.id, "novo-slug"),
    ]) {
      expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
    }
    expect(f.banco.atualizarPerfil).not.toHaveBeenCalled();
  });

  it("id que não é uuid não chega ao banco", async () => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).obter("' or 1=1 --");
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
    expect(f.banco.buscarPerfil).not.toHaveBeenCalled();
  });
});

describe("perfis: slug congelado depois da primeira aprovação", () => {
  it("antes da aprovação o slug pode mudar; reservado e duplicado são recusados", async () => {
    const { svc, perfil, slugs } = await criarPronto();
    slugs.add("ocupado");
    const ok = await svc.alterarSlug(perfil.id, "padaria-nova");
    expect(ok.ok && ok.valor.slug).toBe("padaria-nova");
    const res = await svc.alterarSlug(perfil.id, "admin");
    expect(!res.ok && res.erro.codigo).toBe("SLUG_RESERVADO");
    const dup = await svc.alterarSlug(perfil.id, "ocupado");
    expect(!dup.ok && dup.erro.codigo).toBe("SLUG_INDISPONIVEL");
    expect(ok.ok && ok.valor.slugEditavel).toBe(true);
  });
  it("depois de aprovado o slug não muda", async () => {
    const { svc, perfil, banco } = await publicado();
    vi.mocked(banco.atualizarPerfil).mockClear();
    const r = await svc.alterarSlug(perfil.id, "outro-endereco");
    expect(!r.ok && r.erro.codigo).toBe("SLUG_CONGELADO");
    expect(banco.atualizarPerfil).not.toHaveBeenCalled();
  });
});

describe("perfis: publicar e despublicar (IM-079)", () => {
  it("despublicar é imediato; a versão aprovada permanece", async () => {
    const { svc, perfil } = await publicado();
    const r = await svc.despublicar(perfil.id);
    expect(r.ok && r.valor.publicado).toBe(false);
    expect(r.ok && r.valor.estado.rotulo).toBe("Despublicado");
    expect(r.ok && r.valor.versaoAprovadaId).not.toBeNull();
    const de = await svc.publicar(perfil.id);
    expect(de.ok && de.valor.estado.noAr).toBe(true);
  });
});

describe("perfis: erros do banco (23505, 23514, 42501) sem vazar texto", () => {
  it("mapeia para mensagens pt-BR genéricas", () => {
    const segredo = "SEGREDO-DO-BANCO";
    const casos = [
      { code: "23505", constraint: "perfis_perfil_slug_unico", details: `Key (slug)=(${segredo})` },
      { code: "23514", constraint: "perfis_versao_sociais", message: segredo },
      { code: "23514", constraint: "perfis_versao_categorias", message: segredo },
      { code: "23514", constraint: "perfis_versao_completa", message: segredo },
      { code: "23514", constraint: "perfis_contato_whatsapp_formato", message: segredo },
      { code: "23514", message: `caminho de imagem fora da pasta do responsável ${segredo}` },
      { code: "42501", message: `slug não muda depois da primeira aprovação ${segredo}` },
      { code: "42501", message: `versão enviada é imutável ${segredo}` },
      { code: "42501", message: segredo },
      { code: "XX000", message: segredo },
    ];
    for (const c of casos) {
      const e = mapearErroBancoPerfis(c);
      expect(e.mensagem).not.toContain(segredo);
      expect(e.mensagem).not.toMatch(/constraint|violates|perfis_|duplicate|SQL/i);
    }
    expect(mapearErroBancoPerfis(casos[0]!).codigo).toBe("SLUG_INDISPONIVEL");
    expect(mapearErroBancoPerfis(casos[1]!).mensagem).toMatch(/apenas texto/);
    expect(mapearErroBancoPerfis(casos[3]!).codigo).toBe("INCOMPLETO");
    expect(mapearErroBancoPerfis(casos[6]!).codigo).toBe("SLUG_CONGELADO");
    expect(mapearErroBancoPerfis(casos[7]!).codigo).toBe("EM_ANALISE");
    expect(mapearErroBancoPerfis(casos[8]!).codigo).toBe("SEM_PERMISSAO");
    expect(mapearErroBancoPerfis(casos[9]!).codigo).toBe("ERRO_INTERNO");
  });

  it("23514 do banco numa operação vira mensagem sem vazar", async () => {
    const f = fakeBanco();
    f.banco.inserirVersao = async () => ({
      dados: null,
      erro: { code: "23514", constraint: "perfis_versao_sociais", message: "SEGREDO" },
    });
    const r = await criarServicoPerfis(f.banco).criarRascunho(valido);
    expect(!r.ok && r.erro.mensagem).not.toContain("SEGREDO");
  });

  it("exceção do banco injetado vira erro genérico", async () => {
    const f = fakeBanco();
    f.banco.inserirPerfil = async () => {
      throw new Error("postgres://usuario:senha@host");
    };
    const r = await criarServicoPerfis(f.banco).criarRascunho(valido);
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toMatch(/postgres|senha/);
  });
});

describe("perfis: privacidade dos modelos públicos (IM-029)", () => {
  const linhaPublica = {
    id: "p1",
    slug: "padaria",
    nome: "Padaria",
    descricao_breve: "Pães",
    imagem_path: `${DONO}/logo.png`,
    categoria_principal_id: CAT_A,
    categoria_secundaria_1_id: null,
    categoria_secundaria_2_id: null,
    cidade: "Campinas",
    uf: "SP",
    endereco: null,
    areas_atendidas: [],
    banners_paths: [],
    fotos_paths: [],
    site: "https://padaria.com.br",
    informacoes_sociais: null,
    // Colunas que a visão NÃO tem, mas que um adaptador errado poderia repassar:
    responsavel_id: DONO,
    whatsapp_comercial_e164: WHATS_E164,
    email: "dono@exemplo.com",
  } as LinhaPerfilPublico;

  it("modelo público nunca contém WhatsApp, responsável ou e-mail", () => {
    const m = paraPerfilPublico(linhaPublica);
    const json = JSON.stringify({ ...m, imagemPath: null });
    expect(json).not.toContain(DONO);
    expect(json).not.toContain("5519999990001");
    expect(json).not.toContain("dono@exemplo.com");
    expect(Object.keys(m).sort()).toEqual(
      [
        "areasAtendidas",
        "bannersPaths",
        "categoriaPrincipalId",
        "categoriasSecundariasIds",
        "cidade",
        "descricaoBreve",
        "endereco",
        "fotosPaths",
        "id",
        "imagemPath",
        "informacoesSociais",
        "nome",
        "site",
        "slug",
        "uf",
      ].sort(),
    );
  });

  it("modelo de exibição ignora o WhatsApp mesmo se o conteúdo o tiver", () => {
    const m = paraPerfilExibicao(
      { id: "p1", slug: "padaria" },
      {
        nome: "Padaria",
        descricaoBreve: null,
        imagemPath: null,
        categoriaPrincipalId: null,
        categoriasSecundariasIds: [],
        cidade: null,
        uf: null,
        endereco: null,
        areasAtendidas: [],
        bannersPaths: [],
        fotosPaths: [],
        site: null,
        informacoesSociais: null,
        whatsappComercialE164: WHATS_E164,
      },
    );
    expect(JSON.stringify(m)).not.toContain("5519999990001");
    expect(m).not.toHaveProperty("whatsappComercialE164");
  });
});
