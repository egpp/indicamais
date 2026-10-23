import { randomUUID } from "node:crypto";
import type {
  ClienteBancoAdministracao,
  LinhaFila,
  LinhaResultadoRevisao,
} from "@/modules/administracao";
import type {
  ClienteBancoCategorias,
  ClienteBancoItens,
  LinhaCategoria,
  LinhaItem,
  LinhaItemVersao,
  LinhaSolicitacao,
} from "@/modules/catalogo";
import type { ClienteBancoPerfis, LinhaPerfil, LinhaVersaoPerfil } from "@/modules/perfis";
import { criarContexto, type BancoRevisaoConteudo, type Contexto } from "@/app/_lib/contexto";

/**
 * Banco em memória para testar telas e Server Actions sobre os MÓDULOS REAIS (só o banco é falso).
 * Imita o que as migrações garantem: dono por conta, uma versão aberta, versão pendente imutável, publicar só
 * o aprovado, administrador decidindo (nunca o próprio conteúdo), motivo obrigatório na rejeição.
 * Os erros usam os códigos do Postgres que os módulos já sabem classificar.
 */

const erro = (code: string, message: string, constraint?: string) => ({
  dados: null,
  erro: { code, message, constraint },
});

type PerfilMem = LinhaPerfil & { dono: string };
type ItemMem = LinhaItem & { dono: string };
type RevisaoMem = {
  versaoId: string;
  motivo: string | null;
  decididaEm: string;
  autorRef: string;
};

export type Mundo = ReturnType<typeof criarMundo>;

export function criarMundo(opcoes: { administradores?: string[] } = {}) {
  const admins = new Set(opcoes.administradores ?? []);
  const perfis = new Map<string, PerfilMem>();
  const versoesPerfil: LinhaVersaoPerfil[] = [];
  const itens = new Map<string, ItemMem>();
  const versoesItem: LinhaItemVersao[] = [];
  const revisoes: RevisaoMem[] = [];
  const categorias: LinhaCategoria[] = [
    { id: randomUUID(), nome: "Alimentação", slug: "alimentacao", ativa: true, ordem: 1 },
    { id: randomUUID(), nome: "Beleza e estética", slug: "beleza", ativa: true, ordem: 2 },
    { id: randomUUID(), nome: "Tecnologia", slug: "tecnologia", ativa: true, ordem: 3 },
  ];
  const solicitacoes: (LinhaSolicitacao & { solicitante: string })[] = [];
  const auditoria: { acao: string; motivo: string | null }[] = [];
  let relogio = Date.UTC(2026, 9, 23, 15, 0, 0);
  const agora = () => new Date((relogio += 1000)).toISOString();
  const ehAdmin = (c: string) => admins.has(c);

  const versaoPerfil = (id: string) => versoesPerfil.find((v) => v.id === id);
  const versaoItem = (id: string) => versoesItem.find((v) => v.id === id);

  function bancoPerfis(contaId: string): ClienteBancoPerfis {
    return {
      async criarRascunho(c) {
        if ([...perfis.values()].some((p) => p.slug === c.slug)) {
          return erro("23505", "duplicate key", "perfis_perfil_slug_unico");
        }
        const id = randomUUID();
        const t = agora();
        perfis.set(id, {
          id,
          slug: c.slug,
          publicado: false,
          versao_aprovada_id: null,
          criado_em: t,
          atualizado_em: t,
          dono: contaId,
        });
        const versaoId = randomUUID();
        versoesPerfil.push({
          id: versaoId,
          perfil_id: id,
          situacao: "rascunho",
          nome: c.nome,
          descricao_breve: c.descricao_breve,
          imagem_path: null,
          categoria_principal_id: c.categoria_principal_id,
          categoria_secundaria_1_id: c.categoria_secundaria_1_id,
          categoria_secundaria_2_id: c.categoria_secundaria_2_id,
          cidade: c.cidade,
          uf: c.uf,
          endereco: c.endereco,
          areas_atendidas: c.areas_atendidas,
          banners_paths: [],
          fotos_paths: [],
          site: c.site,
          informacoes_sociais: c.informacoes_sociais,
          criado_em: t,
          enviada_em: null,
          whatsapp_comercial_e164: c.whatsapp_comercial_e164,
        });
        return { dados: { perfil_id: id, versao_id: versaoId }, erro: null };
      },
      async buscarMeuPerfil(id) {
        const p = perfis.get(id);
        return { dados: p && p.dono === contaId ? semDono(p) : null, erro: null };
      },
      async listarMeusPerfis() {
        const lista = [...perfis.values()].filter((p) => p.dono === contaId).map(semDono);
        return { dados: lista.reverse(), erro: null };
      },
      async listarVersoes(ids) {
        const meus = ids.filter((i) => perfis.get(i)?.dono === contaId);
        return { dados: versoesPerfil.filter((v) => meus.includes(v.perfil_id)), erro: null };
      },
      async gravarVersao(perfilId, c) {
        const p = perfis.get(perfilId);
        if (!p || p.dono !== contaId) return erro("42501", "perfil não encontrado");
        const todas = versoesPerfil.filter((v) => v.perfil_id === perfilId);
        if (todas.some((v) => v.situacao === "pendente")) {
          return erro("P0001", "já existe versão pendente");
        }
        const { whatsapp_comercial_e164, ...cols } = c;
        const rascunho = todas.find((v) => v.situacao === "rascunho");
        if (rascunho) {
          Object.assign(rascunho, cols, { whatsapp_comercial_e164 });
          return { dados: rascunho.id, erro: null };
        }
        const id = randomUUID();
        versoesPerfil.push({
          id,
          perfil_id: perfilId,
          situacao: "rascunho",
          ...cols,
          criado_em: agora(),
          enviada_em: null,
          whatsapp_comercial_e164,
        });
        return { dados: id, erro: null };
      },
      async enviarVersao(versaoId) {
        const v = versaoPerfil(versaoId);
        if (!v || perfis.get(v.perfil_id)?.dono !== contaId) {
          return { erro: { code: "42501", message: "versão não encontrada" } };
        }
        if (v.situacao !== "rascunho") return { erro: { code: "P0001", message: "estado" } };
        v.situacao = "pendente";
        v.enviada_em = agora();
        return { erro: null };
      },
      async atualizarPerfil(perfilId, c) {
        const p = perfis.get(perfilId);
        if (!p || p.dono !== contaId) return { dados: null, erro: null };
        if (c.publicado && p.versao_aprovada_id === null) {
          return erro("23514", "check", "perfis_perfil_publicado_exige_aprovada");
        }
        if (c.publicado !== undefined) p.publicado = c.publicado;
        if (c.slug !== undefined) p.slug = c.slug;
        return { dados: semDono(p), erro: null };
      },
    };
  }

  function bancoItens(contaId: string): ClienteBancoItens {
    return {
      async criarItem(c) {
        if (c.perfil_id && perfis.get(c.perfil_id)?.dono !== contaId) {
          return erro("23503", "fk", "catalogo_item_perfil_fk");
        }
        const id = randomUUID();
        const t = agora();
        itens.set(id, {
          id,
          perfil_id: c.perfil_id,
          tipo: c.tipo,
          publicado: false,
          versao_aprovada_id: null,
          criado_em: t,
          atualizado_em: t,
          dono: contaId,
        });
        const versaoId = randomUUID();
        versoesItem.push({
          id: versaoId,
          item_id: id,
          situacao: "rascunho",
          nome: c.nome,
          descricao: c.descricao,
          foto_path: null,
          categoria_principal_id: c.categoria_principal_id,
          categoria_secundaria_1_id: c.categoria_secundaria_1_id,
          categoria_secundaria_2_id: c.categoria_secundaria_2_id,
          preco_modo: c.preco_modo,
          preco_centavos: c.preco_centavos,
          criado_em: t,
          enviada_em: null,
        });
        return { dados: { item_id: id, versao_id: versaoId }, erro: null };
      },
      async buscarMeuItem(id) {
        const i = itens.get(id);
        return { dados: i && i.dono === contaId ? semDono(i) : null, erro: null };
      },
      async listarMeusItens() {
        return {
          dados: [...itens.values()]
            .filter((i) => i.dono === contaId)
            .map(semDono)
            .reverse(),
          erro: null,
        };
      },
      async listarVersoes(ids) {
        const meus = ids.filter((i) => itens.get(i)?.dono === contaId);
        return { dados: versoesItem.filter((v) => meus.includes(v.item_id)), erro: null };
      },
      async inserirVersao(c) {
        if (itens.get(c.item_id)?.dono !== contaId) return erro("42501", "item não encontrado");
        if (
          versoesItem.some(
            (v) =>
              v.item_id === c.item_id && (v.situacao === "rascunho" || v.situacao === "pendente"),
          )
        ) {
          return erro("23505", "duplicate", "catalogo_item_versao_uma_aberta");
        }
        const v: LinhaItemVersao = {
          id: randomUUID(),
          situacao: "rascunho",
          criado_em: agora(),
          enviada_em: null,
          ...c,
        };
        versoesItem.push(v);
        return { dados: v, erro: null };
      },
      async atualizarVersao(versaoId, c) {
        const v = versaoItem(versaoId);
        if (!v || itens.get(v.item_id)?.dono !== contaId) return { dados: null, erro: null };
        if (v.situacao !== "rascunho") return erro("42501", "versão imutável");
        Object.assign(v, c);
        return { dados: v, erro: null };
      },
      async enviarVersao(versaoId) {
        const v = versaoItem(versaoId);
        if (!v || itens.get(v.item_id)?.dono !== contaId) {
          return { erro: { code: "42501", message: "versão não encontrada" } };
        }
        v.situacao = "pendente";
        v.enviada_em = agora();
        return { erro: null };
      },
      async definirPublicado(itemId, publicado) {
        const i = itens.get(itemId);
        if (!i || i.dono !== contaId) return { dados: null, erro: null };
        if (publicado && i.versao_aprovada_id === null) {
          return erro("23514", "check", "catalogo_item_publicado_exige_aprovada");
        }
        i.publicado = publicado;
        return { dados: semDono(i), erro: null };
      },
    };
  }

  function bancoCategorias(contaId: string): ClienteBancoCategorias {
    const admin = () => ehAdmin(contaId);
    const negado = () => ({ erro: { code: "42501", message: "apenas administradores" } });
    return {
      contaId,
      async listarCategorias() {
        return { dados: categorias.filter((c) => c.ativa || admin()), erro: null };
      },
      async inserirSolicitacao(c) {
        const pendentes = solicitacoes.filter(
          (s) => s.solicitante === contaId && s.situacao === "pendente",
        );
        if (pendentes.length >= 5) return erro("P0001", "limite de pedidos pendentes");
        const s = {
          id: randomUUID(),
          solicitante_id: c.solicitante_id,
          solicitante: contaId,
          nome_sugerido: c.nome_sugerido,
          justificativa: c.justificativa,
          situacao: "pendente" as const,
          categoria_id: null,
          motivo_resposta: null,
          decidida_em: null,
          criado_em: agora(),
        };
        solicitacoes.push(s);
        return { dados: s, erro: null };
      },
      async listarMinhasSolicitacoes() {
        return { dados: solicitacoes.filter((s) => s.solicitante === contaId), erro: null };
      },
      async listarSolicitacoesPendentes() {
        return {
          dados: admin() ? solicitacoes.filter((s) => s.situacao === "pendente") : [],
          erro: null,
        };
      },
      async criarCategoria(a) {
        if (!admin()) return { id: null, ...negado() };
        if (categorias.some((c) => c.slug === a.slug)) {
          return {
            id: null,
            erro: { code: "23505", message: "dup", constraint: "catalogo_categoria_slug_unico" },
          };
        }
        const c = { id: randomUUID(), nome: a.nome, slug: a.slug, ativa: true, ordem: a.ordem };
        categorias.push(c);
        auditoria.push({ acao: "categoria_criada", motivo: null });
        return { id: c.id, erro: null };
      },
      async alterarCategoria(a) {
        if (!admin()) return negado();
        const c = categorias.find((x) => x.id === a.id);
        if (!c) return { erro: { code: "P0002", message: "não encontrada" } };
        auditoria.push({ acao: "categoria_alterada", motivo: a.motivo });
        Object.assign(c, { nome: a.nome, ativa: a.ativa, ordem: a.ordem });
        return { erro: null };
      },
      async decidirSolicitacao(a) {
        if (!admin()) return negado();
        const s = solicitacoes.find((x) => x.id === a.id);
        if (!s) return { erro: { code: "P0002", message: "não encontrado" } };
        if (s.situacao !== "pendente")
          return { erro: { code: "P0001", message: "pedido já decidido" } };
        s.situacao = a.atendida ? "atendida" : "recusada";
        s.categoria_id = a.categoriaId;
        s.motivo_resposta = a.motivo;
        s.decidida_em = agora();
        return { erro: null };
      },
    };
  }

  function decidir(
    contaId: string,
    versao: { id: string; situacao: string } | undefined,
    dono: string | undefined,
    aprovar: boolean,
    motivo: string | null,
    aoAprovar: () => void,
  ) {
    if (!ehAdmin(contaId)) return { erro: { code: "42501", message: "apenas administradores" } };
    if (!versao) return { erro: { code: "P0002", message: "versão não encontrada" } };
    if (dono === contaId) {
      return { erro: { code: "42501", message: "não decida o próprio conteúdo" } };
    }
    if (versao.situacao !== "pendente") return { erro: { code: "P0001", message: "estado" } };
    if (!aprovar && !motivo) return { erro: { code: "22023", message: "motivo obrigatório" } };
    versao.situacao = aprovar ? "aprovada" : "rejeitada";
    revisoes.push({
      versaoId: versao.id,
      motivo: aprovar ? null : motivo,
      decididaEm: agora(),
      autorRef: `ref-${contaId.slice(0, 4)}`,
    });
    auditoria.push({ acao: aprovar ? "aprovada" : "rejeitada", motivo });
    if (aprovar) aoAprovar();
    return { erro: null };
  }

  function bancoAdministracao(contaId: string): ClienteBancoAdministracao {
    return {
      contaId,
      async listarFila() {
        if (!ehAdmin(contaId)) return { dados: [], erro: null };
        const fila: LinhaFila[] = [
          ...versoesPerfil
            .filter((v) => v.situacao === "pendente")
            .map((v) => ({
              alvo_tipo: "perfil" as const,
              versao_id: v.id,
              alvo_id: v.perfil_id,
              nome: v.nome,
              enviada_em: v.enviada_em ?? v.criado_em,
              dono_id: perfis.get(v.perfil_id)!.dono,
              eh_edicao: perfis.get(v.perfil_id)!.versao_aprovada_id !== null,
            })),
          ...versoesItem
            .filter((v) => v.situacao === "pendente")
            .map((v) => ({
              alvo_tipo: "item" as const,
              versao_id: v.id,
              alvo_id: v.item_id,
              nome: v.nome,
              enviada_em: v.enviada_em ?? v.criado_em,
              dono_id: itens.get(v.item_id)!.dono,
              eh_edicao: itens.get(v.item_id)!.versao_aprovada_id !== null,
            })),
        ];
        return { dados: fila, erro: null };
      },
      async decidirPerfil(a) {
        const v = versaoPerfil(a.versaoId);
        return decidir(contaId, v, v && perfis.get(v.perfil_id)?.dono, a.aprovar, a.motivo, () => {
          perfis.get(v!.perfil_id)!.versao_aprovada_id = v!.id;
        });
      },
      async decidirItem(a) {
        const v = versaoItem(a.versaoId);
        return decidir(contaId, v, v && itens.get(v.item_id)?.dono, a.aprovar, a.motivo, () => {
          itens.get(v!.item_id)!.versao_aprovada_id = v!.id;
        });
      },
      async listarMinhasRevisoes() {
        const saida: LinhaResultadoRevisao[] = [];
        const monta = (
          tipo: "perfil" | "item",
          alvoId: string,
          v: { id: string; situacao: string; nome: string | null; enviada_em: string | null },
          extra: { slug: string | null; publicado: boolean; vigente: boolean },
        ) => {
          if (!["pendente", "aprovada", "rejeitada"].includes(v.situacao)) return;
          const r = revisoes.find((x) => x.versaoId === v.id);
          saida.push({
            tipo,
            alvo_id: alvoId,
            versao_id: v.id,
            situacao: v.situacao as "pendente" | "aprovada" | "rejeitada",
            nome: v.nome,
            motivo: r?.motivo ?? null,
            decidida_em: r?.decididaEm ?? null,
            enviada_em: v.enviada_em ?? "",
            autor_ref: r?.autorRef ?? null,
            slug: extra.slug,
            publicado: extra.publicado,
            versao_vigente: extra.vigente,
          });
        };
        for (const v of versoesPerfil) {
          const p = perfis.get(v.perfil_id);
          if (p?.dono === contaId) {
            monta("perfil", p.id, v, {
              slug: p.slug,
              publicado: p.publicado,
              vigente: p.versao_aprovada_id === v.id,
            });
          }
        }
        for (const v of versoesItem) {
          const i = itens.get(v.item_id);
          if (i?.dono === contaId) {
            monta("item", i.id, v, {
              slug: null,
              publicado: i.publicado,
              vigente: i.versao_aprovada_id === v.id,
            });
          }
        }
        return { dados: saida, erro: null };
      },
    };
  }

  function revisao(contaId: string): BancoRevisaoConteudo {
    return {
      async buscarVersaoPerfil(versaoId) {
        const v = versaoPerfil(versaoId);
        if (!ehAdmin(contaId) || !v) return { dados: null, erro: null };
        const p = perfis.get(v.perfil_id)!;
        return { dados: { perfil: { id: p.id, slug: p.slug }, versao: v }, erro: null };
      },
      async buscarVersaoItem(versaoId) {
        const v = versaoItem(versaoId);
        if (!ehAdmin(contaId) || !v) return { dados: null, erro: null };
        const i = itens.get(v.item_id)!;
        return {
          dados: { item: { id: i.id, perfil_id: i.perfil_id, tipo: i.tipo }, versao: v },
          erro: null,
        };
      },
      async listarTodasCategorias() {
        return { dados: ehAdmin(contaId) ? [...categorias] : [], erro: null };
      },
    };
  }

  /** Contexto de uma conta, com os serviços REAIS dos módulos sobre este banco em memória. */
  function contexto(contaId: string): Contexto {
    return criarContexto({
      contaId,
      bancoPerfis: bancoPerfis(contaId),
      bancoItens: bancoItens(contaId),
      bancoCategorias: bancoCategorias(contaId),
      bancoAdministracao: bancoAdministracao(contaId),
      revisao: revisao(contaId),
      ehAdministrador: async () => ehAdmin(contaId),
      assinarImagens: async (caminhos) =>
        Object.fromEntries(caminhos.map((c) => [c, `https://storage.exemplo/assinada/${c}`])),
    });
  }

  return {
    contexto,
    categorias,
    perfis,
    versoesPerfil,
    itens,
    versoesItem,
    revisoes,
    solicitacoes,
    auditoria,
  };
}

function semDono<T extends { dono: string }>(x: T): Omit<T, "dono"> {
  const { dono, ...resto } = x;
  void dono;
  return resto;
}

export function formulario(campos: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) for (const x of v) f.append(k, x);
    else f.set(k, v);
  }
  return f;
}

/** Caminho de imagem válido na pasta do perfil ou item (formato exigido pelos módulos). */
export const caminhoDe = (pasta: "perfil" | "item", donoId: string, ext = "webp") =>
  `${pasta}/${donoId}/${randomUUID()}.${ext}`;
