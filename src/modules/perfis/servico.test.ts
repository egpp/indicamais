import { describe, expect, it, vi } from "vitest";
import {
  criarServicoPerfis,
  mapearErroBancoPerfis,
  paraPerfilExibicao,
  paraPerfilPublico,
  type ClienteBancoPerfis,
  type DadosCriarPerfil,
  type DadosGravarVersaoPerfil,
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

/**
 * Banco em memória que imita o contrato novo: criação e gravação por RPC atômica, posse dada só por estar na
 * lista "meus" (o dono fica num mapa interno que o contrato nunca expõe), slug único, uma versão aberta,
 * versão pendente imutável.
 */
function fakeBanco(contaId = DONO, slugsOcupados: string[] = []) {
  const perfis = new Map<string, LinhaPerfil>();
  const donos = new Map<string, string>();
  const versoes = new Map<string, LinhaVersaoPerfil>();
  const contatos = new Map<string, string>();
  const slugs = new Set(slugsOcupados);
  let seq = 0;
  let relogio = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const t = () => new Date(Date.UTC(2026, 9, 1, 0, 0, ++relogio)).toISOString();
  const meu = (pid: string) => donos.get(pid) === contaId;
  const comContato = (v: LinhaVersaoPerfil): LinhaVersaoPerfil => ({
    ...v,
    whatsapp_comercial_e164: contatos.get(v.id) ?? null,
  });
  const colunas = (c: DadosGravarVersaoPerfil) => {
    return { ...c, whatsapp_comercial_e164: null }; // o contato vive em tabela à parte (contatos)
  };

  const banco: ClienteBancoPerfis = {
    criarRascunho: vi.fn(async (c) => {
      if (!c.whatsapp_comercial_e164) {
        return {
          dados: null,
          erro: { code: "23514", message: "WhatsApp comercial é obrigatório" },
        };
      }
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
      const p: LinhaPerfil = {
        id: id(),
        slug: c.slug,
        publicado: false,
        versao_aprovada_id: null,
        criado_em: t(),
        atualizado_em: t(),
      };
      perfis.set(p.id, p);
      donos.set(p.id, contaId);
      const whats = c.whatsapp_comercial_e164;
      const cols: Omit<DadosCriarPerfil, "slug" | "whatsapp_comercial_e164"> = { ...c };
      const v: LinhaVersaoPerfil = {
        id: id(),
        perfil_id: p.id,
        situacao: "rascunho",
        imagem_path: null,
        banners_paths: [],
        fotos_paths: [],
        criado_em: t(),
        enviada_em: null,
        whatsapp_comercial_e164: null,
        ...cols,
      };
      versoes.set(v.id, v);
      contatos.set(v.id, whats);
      return { dados: { perfil_id: p.id, versao_id: v.id }, erro: null };
    }),
    buscarMeuPerfil: vi.fn(async (pid) => ({
      dados: meu(pid) ? (perfis.get(pid) ?? null) : null,
      erro: null,
    })),
    listarMeusPerfis: vi.fn(async () => ({
      dados: [...perfis.values()].filter((p) => meu(p.id)),
      erro: null,
    })),
    listarVersoes: vi.fn(async (ids) => ({
      dados: [...versoes.values()]
        .filter((v) => ids.includes(v.perfil_id) && meu(v.perfil_id))
        .map(comContato),
      erro: null,
    })),
    gravarVersao: vi.fn(async (pid, c) => {
      if (!meu(pid)) {
        return { dados: null, erro: { code: "42501", message: "perfil não encontrado" } };
      }
      if (!c.whatsapp_comercial_e164) {
        return {
          dados: null,
          erro: { code: "23514", message: "WhatsApp comercial é obrigatório" },
        };
      }
      const aberta = [...versoes.values()].find(
        (v) => v.perfil_id === pid && ["rascunho", "pendente"].includes(v.situacao),
      );
      if (aberta?.situacao === "pendente") {
        return {
          dados: null,
          erro: { code: "P0001", message: "versão pendente não pode ser editada" },
        };
      }
      let vid: string;
      if (aberta) {
        vid = aberta.id;
        versoes.set(vid, { ...aberta, ...colunas(c) });
      } else {
        vid = id();
        versoes.set(vid, {
          id: vid,
          perfil_id: pid,
          situacao: "rascunho",
          criado_em: t(),
          enviada_em: null,
          ...colunas(c),
        });
      }
      contatos.set(vid, c.whatsapp_comercial_e164);
      return { dados: vid, erro: null };
    }),
    enviarVersao: vi.fn(async (vid) => {
      const v = versoes.get(vid);
      if (!v || !meu(v.perfil_id)) {
        return { erro: { code: "42501", message: "versão não encontrada" } };
      }
      if (!contatos.has(vid)) {
        return { erro: { code: "23514", message: "WhatsApp comercial é obrigatório" } };
      }
      versoes.set(vid, { ...v, situacao: "pendente", enviada_em: t() });
      return { erro: null };
    }),
    atualizarPerfil: vi.fn(async (pid, c) => {
      const p = perfis.get(pid);
      if (!p || !meu(pid)) return { dados: null, erro: null };
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
  return { banco, perfis, donos, versoes, contatos, slugs, aprovar, rejeitar };
}

/** Caminho opaco válido na pasta do perfil (o upload acontece depois de criar o rascunho). */
const img = (perfilId: string, n = 1, ext = "png", prefixo = "aaaaaaaa-aaaa-4aaa-8aaa") =>
  `perfil/${perfilId}/${prefixo}-${String(n).padStart(12, "0")}.${ext}`;

const valido = {
  nome: "Padaria Pão Quente",
  descricaoBreve: "Pães e bolos fresquinhos.",
  categoriaPrincipalId: CAT_A,
  cidade: "Campinas",
  uf: "SP",
  whatsappComercial: WHATS,
};

/** Fluxo na ordem certa: criar rascunho -> enviar imagem -> gravar versão (editar). */
async function criarPronto(f = fakeBanco()) {
  const svc = criarServicoPerfis(f.banco);
  const c = await svc.criarRascunho(valido);
  if (!c.ok) throw new Error(`falha ao criar: ${JSON.stringify(c.erro)}`);
  const e = await svc.editar(c.valor.id, { imagemPath: img(c.valor.id) });
  if (!e.ok) throw new Error(`falha ao gravar imagem: ${JSON.stringify(e.erro)}`);
  return { ...f, svc, perfil: e.valor.perfil };
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
    const f = fakeBanco();
    const c = await criarServicoPerfis(f.banco).criarRascunho(valido);
    if (!c.ok) throw new Error();
    const perfil = c.valor;
    const { contatos, banco } = f;
    expect(perfil.slug).toBe("padaria-pao-quente");
    expect(perfil.estado.rotulo).toBe("Rascunho");
    expect(perfil.publicado).toBe(false);
    expect(perfil.conteudoEdicao.whatsappComercialE164).toBe(WHATS_E164);
    expect([...contatos.values()]).toEqual([WHATS_E164]);
    // RPC única: sem INSERT direto e sem parâmetro de dono (o banco usa auth.uid()).
    expect(banco.criarRascunho).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(banco.criarRascunho).mock.calls)).not.toMatch(/responsavel/);
    expect(f.donos.get(perfil.id)).toBe(DONO);
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
    expect(f.perfis.size).toBe(0);
  });

  it.each(["entrar", "admin", "api", "minha-conta", "categorias", "perfil", "anuncio"])(
    "slug reservado %s é recusado sem tocar no banco",
    async (slug) => {
      const f = fakeBanco();
      const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, slug });
      expect(!r.ok && r.erro.codigo).toBe("SLUG_RESERVADO");
      expect(f.banco.criarRascunho).not.toHaveBeenCalled();
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
    expect(f.banco.criarRascunho).not.toHaveBeenCalled();
  });

  it("sem nome e sem slug: validação por campo", async () => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).criarRascunho({ cidade: "Campinas" });
    expect(!r.ok && r.erro.campos).toHaveProperty("nome");
    expect(f.banco.criarRascunho).not.toHaveBeenCalled();
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
    ["WhatsApp ausente", { whatsappComercial: undefined }],
    ["WhatsApp vazio", { whatsappComercial: "" }],
    ["WhatsApp nulo", { whatsappComercial: null }],
  ])("recusa %s sem tocar no banco", async (_n, extra) => {
    const f = fakeBanco();
    const r = await criarServicoPerfis(f.banco).criarRascunho({ ...valido, ...extra });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(f.banco.criarRascunho).not.toHaveBeenCalled();
  });

  it("o WhatsApp é obrigatório no primeiro rascunho: sem ele, nada é criado", async () => {
    const f = fakeBanco();
    const semWhats = { ...valido, whatsappComercial: undefined };
    const r = await criarServicoPerfis(f.banco).criarRascunho(semWhats);
    expect(!r.ok && r.erro.campos).toHaveProperty("whatsappComercial");
    expect(f.banco.criarRascunho).not.toHaveBeenCalled();
    expect(f.perfis.size).toBe(0);
  });

  it("imagens não entram na criação (o perfil precisa existir antes do upload)", async () => {
    const f = fakeBanco();
    await criarServicoPerfis(f.banco).criarRascunho({
      ...valido,
      imagemPath: `${OUTRO}/logo.png`,
      fotosPaths: [img(OUTRO)],
      bannersPaths: [img(OUTRO)],
    });
    const chamada = vi.mocked(f.banco.criarRascunho).mock.calls[0]![0];
    expect(Object.keys(chamada)).not.toEqual(
      expect.arrayContaining(["imagem_path", "fotos_paths", "banners_paths"]),
    );
    expect(JSON.stringify(chamada)).not.toContain(OUTRO);
    expect([...f.versoes.values()][0]!.imagem_path).toBeNull();
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
    const chamada = vi.mocked(f.banco.criarRascunho).mock.calls[0]![0];
    expect(chamada.slug).toBe("padaria-pao-quente");
    expect(JSON.stringify(chamada)).not.toMatch(/situacao|publicado|responsavel|aprovada/);
    expect(f.perfis.get([...f.perfis.keys()][0]!)!.publicado).toBe(false);
  });

  it("o banco recebe o WhatsApp já normalizado em E.164, nunca o texto digitado", async () => {
    const f = fakeBanco();
    await criarServicoPerfis(f.banco).criarRascunho(valido);
    const chamada = vi.mocked(f.banco.criarRascunho).mock.calls[0]![0];
    expect(chamada.whatsapp_comercial_e164).toBe(WHATS_E164);
    expect(JSON.stringify(chamada)).not.toContain("99999-0001");
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
    const c = await svc.criarRascunho({ nome: "Só o nome", whatsappComercial: WHATS });
    if (!c.ok) throw new Error();
    const r = await svc.enviarParaAprovacao(c.valor.id);
    expect(!r.ok && r.erro.codigo).toBe("INCOMPLETO");
    expect(!r.ok && r.erro.pendencias).toEqual([
      "Informe a descrição breve.",
      "Envie a imagem do perfil.",
      "Escolha a categoria principal.",
      "Informe a cidade.",
      "Escolha a UF.",
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

  it("trocar o WhatsApp do rascunho regrava o contato (E.164) na mesma gravação", async () => {
    const { svc, perfil, contatos, banco } = await criarPronto();
    await svc.editar(perfil.id, { whatsappComercial: "(11) 98888-7777" });
    expect([...contatos.values()]).toEqual(["+5511988887777"]);
    const dados = vi.mocked(banco.gravarVersao).mock.calls.at(-1)![1];
    expect(dados.whatsapp_comercial_e164).toBe("+5511988887777");
  });

  it("grava o conteúdo COMPLETO de uma vez (substitui), não só o que mudou", async () => {
    const { svc, perfil, banco } = await criarPronto();
    await svc.editar(perfil.id, { descricaoBreve: "Outra" });
    const [pid, dados] = vi.mocked(banco.gravarVersao).mock.calls.at(-1)!;
    expect(pid).toBe(perfil.id);
    expect(dados).toMatchObject({
      nome: "Padaria Pão Quente",
      descricao_breve: "Outra",
      imagem_path: img(perfil.id),
      cidade: "Campinas",
      uf: "SP",
      whatsapp_comercial_e164: WHATS_E164,
    });
  });

  it("não deixa apagar o WhatsApp comercial (obrigatório)", async () => {
    const { svc, perfil, banco } = await criarPronto();
    const antes = vi.mocked(banco.gravarVersao).mock.calls.length;
    for (const w of [null, ""]) {
      const r = await svc.editar(perfil.id, { whatsappComercial: w });
      expect(!r.ok && r.erro.campos).toHaveProperty("whatsappComercial");
    }
    expect(vi.mocked(banco.gravarVersao).mock.calls.length).toBe(antes);
  });

  it("versão pendente: recusada antes do banco e também se o banco recusar (P0001)", async () => {
    const { svc, perfil, banco } = await criarPronto();
    await svc.enviarParaAprovacao(perfil.id);
    const antes = vi.mocked(banco.gravarVersao).mock.calls.length;
    const r = await svc.editar(perfil.id, { nome: "Outro" });
    expect(!r.ok && r.erro.codigo).toBe("EM_ANALISE");
    expect(vi.mocked(banco.gravarVersao).mock.calls.length).toBe(antes);
    // estado velho no cliente (versão ainda como rascunho): o banco é a última palavra
    const velho = await banco.listarVersoes([perfil.id]);
    banco.listarVersoes = async () => ({
      dados: (velho.dados ?? []).map((v) => ({ ...v, situacao: "rascunho" as const })),
      erro: null,
    });
    const r2 = await svc.editar(perfil.id, { nome: "Outro" });
    expect(!r2.ok && r2.erro.codigo).toBe("EM_ANALISE");
  });

  it("imagens: só caminhos opacos da pasta do PRÓPRIO perfil; limites 6 fotos e 3 banners", async () => {
    const { svc, perfil } = await criarPronto();
    const id = perfil.id;
    const fotos = (n: number) => Array.from({ length: n }, (_, i) => img(id, 10 + i, "webp"));
    const banners = (n: number) =>
      Array.from({ length: n }, (_, i) => img(id, 20 + i, "jpg", "bbbbbbbb-bbbb-4bbb-8bbb"));
    const ok = await svc.editar(id, { fotosPaths: fotos(6), bannersPaths: banners(3) });
    expect(ok.ok).toBe(true);
    const muitas = await svc.editar(id, { fotosPaths: fotos(7) });
    expect(!muitas.ok && muitas.erro.campos).toHaveProperty("fotosPaths");
    const muitosBanners = await svc.editar(id, { bannersPaths: banners(4) });
    expect(!muitosBanners.ok && muitosBanners.erro.campos).toHaveProperty("bannersPaths");
    const outroPerfil = "99999999-9999-4999-8999-999999999999";
    for (const campos of [
      { imagemPath: img(outroPerfil) },
      { fotosPaths: [img(outroPerfil)] },
      { bannersPaths: [img(outroPerfil)] },
      { imagemPath: `item/${id}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.png` },
      { imagemPath: `${DONO}/${id}.png` }, // caminho antigo, por conta
      { imagemPath: `perfil/${DONO}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.png` }, // pasta de conta
      { imagemPath: `perfil/${id}/logo.png` }, // nome não é uuid
      { imagemPath: `perfil/${id}/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.gif` },
      { imagemPath: `perfil/${id}/../x.png` },
    ]) {
      const r = await svc.editar(id, campos);
      expect(!r.ok && r.erro.codigo, JSON.stringify(campos)).toBe("VALIDACAO");
    }
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
    const r2 = await svc.editar(perfil.id, { imagemPath: img(OUTRO) });
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

  it("o contrato do dono não lê responsável: só a lista 'meus' prova a posse", async () => {
    const f = fakeBanco();
    const svc = criarServicoPerfis(f.banco);
    const c = await svc.criarRascunho(valido);
    if (!c.ok) throw new Error();
    for (const velho of [
      "contaId",
      "buscarPerfil",
      "inserirPerfil",
      "inserirVersao",
      "gravarContato",
    ]) {
      expect(f.banco).not.toHaveProperty(velho);
    }
    const lista = await svc.listarMeus();
    expect(JSON.stringify(lista)).not.toContain(DONO);
    expect(JSON.stringify(lista)).not.toMatch(/responsavel/i);
    // quem não é dono tem a lista vazia (a visão filtra por auth.uid())
    const outro = { ...f.banco, listarMeusPerfis: async () => ({ dados: [], erro: null }) };
    const vazia = await criarServicoPerfis(outro).listarMeus();
    expect(vazia.ok && vazia.valor).toEqual([]);
  });

  it("perfil de outra conta é tratado como inexistente", async () => {
    const f = fakeBanco();
    const svc = criarServicoPerfis(f.banco);
    const c = await svc.criarRascunho(valido);
    if (!c.ok) throw new Error();
    f.donos.set(c.valor.id, OUTRO); // a linha sai da lista "meus"; o contrato não tem coluna de dono
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
    expect(f.banco.buscarMeuPerfil).not.toHaveBeenCalled();
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
      { code: "P0001", message: `versão pendente não pode ser editada ${segredo}` },
      { code: "42501", message: `perfil não encontrado ${segredo}` },
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
    expect(mapearErroBancoPerfis(casos[10]!).codigo).toBe("EM_ANALISE");
    expect(mapearErroBancoPerfis(casos[11]!).codigo).toBe("NAO_ENCONTRADO");
  });

  it("23514 do banco numa operação vira mensagem sem vazar", async () => {
    const f = fakeBanco();
    f.banco.criarRascunho = async () => ({
      dados: null,
      erro: { code: "23514", constraint: "perfis_versao_sociais", message: "SEGREDO" },
    });
    const r = await criarServicoPerfis(f.banco).criarRascunho(valido);
    expect(!r.ok && r.erro.mensagem).not.toContain("SEGREDO");
  });

  it("exceção do banco injetado vira erro genérico", async () => {
    const f = fakeBanco();
    f.banco.criarRascunho = async () => {
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
    imagem_path: `perfil/p1/aaaaaaaa-aaaa-4aaa-8aaa-000000000001.png`,
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
