import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClienteBancoAdministracao,
  ClienteBancoPatrocinadores,
  LinhaFila,
  LinhaPatrocinadorAdmin,
  LinhaPatrocinadorPublico,
  LinhaResultadoRevisao,
} from "@/modules/administracao";
import type {
  ClienteBancoCategorias,
  ClienteBancoItens,
  LinhaCategoria,
  LinhaItem,
  LinhaItemVersao,
  LinhaSolicitacao,
  TipoItem,
} from "@/modules/catalogo";
import type { ClienteBancoBusca, LinhaBusca } from "@/modules/busca";
import type { ClienteBancoPerfis, LinhaPerfil, LinhaVersaoPerfil } from "@/modules/perfis";
import type { SituacaoVersao } from "@/shared/conteudo/ciclo-versao";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";
import type { DependenciasContexto } from "./contexto";
import { criarAssinadorImagens } from "./imagens-servidor";

/**
 * Adaptadores supabase-js dos contratos de banco da Fase 2. Sempre com a SESSÃO DO USUÁRIO (RLS decide);
 * nunca service_role. Colunas SEMPRE nomeadas: `select('*')` falha nas tabelas de perfil/item (privilégio de
 * coluna) e `responsavel_id`, `conta_id`, `autor_id` e `decidida_por` não são legíveis por ninguém.
 * Erros do banco viram `ErroBanco` (código + texto só para classificação); a mensagem ao usuário é sempre
 * montada pelos módulos, nunca repassada.
 */
export type ClienteSupabaseFase2 = SupabaseClient<Database>;

export const COLUNAS = {
  perfil: "id, slug, publicado, versao_aprovada_id, criado_em, atualizado_em",
  versaoPerfil:
    "id, perfil_id, situacao, nome, descricao_breve, imagem_path, categoria_principal_id, categoria_secundaria_1_id, categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, banners_paths, fotos_paths, site, informacoes_sociais, criado_em, enviada_em",
  item: "id, perfil_id, tipo, publicado, versao_aprovada_id, criado_em, atualizado_em",
  versaoItem:
    "id, item_id, situacao, nome, descricao, foto_path, categoria_principal_id, categoria_secundaria_1_id, categoria_secundaria_2_id, preco_modo, preco_centavos, cidade, uf, criado_em, enviada_em",
  categoria: "id, nome, slug, ativa, ordem",
  solicitacao:
    "id, solicitante_id, nome_sugerido, justificativa, situacao, categoria_id, motivo_resposta, decidida_em, criado_em",
  fila: "alvo_tipo, versao_id, alvo_id, nome, enviada_em, dono_id, eh_edicao",
  resultado:
    "tipo, alvo_id, versao_id, situacao, nome, motivo, decidida_em, enviada_em, autor_ref, slug, publicado, versao_vigente",
  patrocinadorPublico:
    "id, identificacao, titulo, imagem_path, destino_tipo, destino_perfil_id, destino_perfil_slug, destino_texto, ordem",
  patrocinadorAdmin:
    "id, titulo, imagem_path, perfil_destino_id, texto_destino, ordem, ativo, inicio_em, fim_em, criado_em, atualizado_em",
} as const;

type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

function paraErro(e: ErroPostgrest): ErroBanco | null {
  if (!e) return null;
  return { code: e.code, message: e.message, details: e.details };
}

/** Falha de rede/exceção: vira erro genérico, sem texto do banco. */
const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };

async function protegido<T>(
  f: () => PromiseLike<{ dados: T | null; erro: ErroBanco | null }>,
): Promise<{ dados: T | null; erro: ErroBanco | null }> {
  try {
    return await f();
  } catch {
    return { dados: null, erro: ERRO_DESCONHECIDO };
  }
}

async function protegidoErro(f: () => PromiseLike<ErroBanco | null>) {
  try {
    return { erro: await f() };
  } catch {
    return { erro: ERRO_DESCONHECIDO };
  }
}

/** rpc administracao_eh_admin (sem parâmetros). Falha fechado: qualquer erro = não é administrador. */
async function consultarAdmin(supabase: ClienteSupabaseFase2): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("administracao_eh_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

const opc = <T>(v: T | null | undefined): T | undefined => v ?? undefined;

// ---------------------------------------------------------------------------------------------------------
// Conversões de linha (as visões têm colunas anuláveis nos tipos gerados; o banco garante os valores)
// ---------------------------------------------------------------------------------------------------------

type LinhaBrutaPerfil = Database["public"]["Views"]["perfis_meus_perfis"]["Row"];
function paraPerfil(l: LinhaBrutaPerfil): LinhaPerfil {
  return {
    id: l.id as string,
    slug: l.slug as string,
    publicado: l.publicado === true,
    versao_aprovada_id: l.versao_aprovada_id,
    criado_em: l.criado_em as string,
    atualizado_em: l.atualizado_em as string,
  };
}

type LinhaBrutaItem = Database["public"]["Views"]["catalogo_meus_itens"]["Row"];
function paraItem(l: LinhaBrutaItem): LinhaItem {
  return {
    id: l.id as string,
    perfil_id: l.perfil_id,
    tipo: l.tipo as TipoItem,
    publicado: l.publicado === true,
    versao_aprovada_id: l.versao_aprovada_id,
    criado_em: l.criado_em as string,
    atualizado_em: l.atualizado_em as string,
  };
}

type LinhaBrutaVersaoPerfil = Database["public"]["Tables"]["perfis_perfil_versao"]["Row"];
function paraVersaoPerfil(
  l: Omit<LinhaBrutaVersaoPerfil, never>,
  whatsapp: string | null,
): LinhaVersaoPerfil {
  return {
    id: l.id,
    perfil_id: l.perfil_id,
    situacao: l.situacao as SituacaoVersao,
    nome: l.nome,
    descricao_breve: l.descricao_breve,
    imagem_path: l.imagem_path,
    categoria_principal_id: l.categoria_principal_id,
    categoria_secundaria_1_id: l.categoria_secundaria_1_id,
    categoria_secundaria_2_id: l.categoria_secundaria_2_id,
    cidade: l.cidade,
    uf: l.uf,
    endereco: l.endereco,
    areas_atendidas: l.areas_atendidas ?? [],
    banners_paths: l.banners_paths ?? [],
    fotos_paths: l.fotos_paths ?? [],
    site: l.site,
    informacoes_sociais: l.informacoes_sociais,
    criado_em: l.criado_em,
    enviada_em: l.enviada_em,
    whatsapp_comercial_e164: whatsapp,
  };
}

type LinhaBrutaVersaoItem = Database["public"]["Tables"]["catalogo_item_versao"]["Row"];
function paraVersaoItem(l: LinhaBrutaVersaoItem): LinhaItemVersao {
  return {
    id: l.id,
    item_id: l.item_id,
    situacao: l.situacao as SituacaoVersao,
    nome: l.nome,
    descricao: l.descricao,
    foto_path: l.foto_path,
    categoria_principal_id: l.categoria_principal_id,
    categoria_secundaria_1_id: l.categoria_secundaria_1_id,
    categoria_secundaria_2_id: l.categoria_secundaria_2_id,
    preco_modo: l.preco_modo,
    preco_centavos: l.preco_centavos,
    cidade: l.cidade,
    uf: l.uf,
    criado_em: l.criado_em,
    enviada_em: l.enviada_em,
  };
}

type LinhaBrutaSolicitacao = Pick<
  Database["public"]["Tables"]["catalogo_categoria_solicitacao"]["Row"],
  | "id"
  | "solicitante_id"
  | "nome_sugerido"
  | "justificativa"
  | "situacao"
  | "categoria_id"
  | "motivo_resposta"
  | "decidida_em"
  | "criado_em"
>;
function paraSolicitacao(l: LinhaBrutaSolicitacao): LinhaSolicitacao {
  return {
    id: l.id,
    solicitante_id: l.solicitante_id,
    nome_sugerido: l.nome_sugerido,
    justificativa: l.justificativa,
    situacao: l.situacao as LinhaSolicitacao["situacao"],
    categoria_id: l.categoria_id,
    motivo_resposta: l.motivo_resposta,
    decidida_em: l.decidida_em,
    criado_em: l.criado_em,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------------------------------------------

export function criarBancoPerfis(supabase: ClienteSupabaseFase2): ClienteBancoPerfis {
  return {
    ehAdministrador: () => consultarAdmin(supabase),

    buscarVersaoParaRevisao: (versaoId) =>
      protegido(async () => {
        // Sem tabela de contato e sem responsavel_id (IM-029). A RLS entrega a versão alheia só ao admin.
        const v = await supabase
          .from("perfis_perfil_versao")
          .select(COLUNAS.versaoPerfil)
          .eq("id", versaoId)
          .maybeSingle();
        if (v.error || !v.data) return { dados: null, erro: paraErro(v.error) };
        const p = await supabase
          .from("perfis_perfil")
          .select("id, slug")
          .eq("id", v.data.perfil_id)
          .maybeSingle();
        if (p.error || !p.data) return { dados: null, erro: paraErro(p.error) };
        return {
          dados: {
            perfil: { id: p.data.id, slug: p.data.slug },
            versao: paraVersaoPerfil(v.data, null),
          },
          erro: null,
        };
      }),
    criarRascunho: (c) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("perfis_criar_rascunho", {
          p_slug: c.slug,
          p_whatsapp_comercial: c.whatsapp_comercial_e164,
          p_nome: opc(c.nome),
          p_descricao_breve: opc(c.descricao_breve),
          p_categoria_principal_id: opc(c.categoria_principal_id),
          p_categoria_secundaria_1_id: opc(c.categoria_secundaria_1_id),
          p_categoria_secundaria_2_id: opc(c.categoria_secundaria_2_id),
          p_cidade: opc(c.cidade),
          p_uf: opc(c.uf),
          p_endereco: opc(c.endereco),
          p_areas_atendidas: c.areas_atendidas,
          p_site: opc(c.site),
          p_informacoes_sociais: opc(c.informacoes_sociais),
        });
        const linha = Array.isArray(data) ? data[0] : null;
        return {
          dados: linha ? { perfil_id: linha.o_perfil_id, versao_id: linha.o_versao_id } : null,
          erro: paraErro(error),
        };
      }),

    buscarMeuPerfil: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_meus_perfis")
          .select(COLUNAS.perfil)
          .eq("id", perfilId)
          .maybeSingle();
        return { dados: data ? paraPerfil(data) : null, erro: paraErro(error) };
      }),

    listarMeusPerfis: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_meus_perfis")
          .select(COLUNAS.perfil)
          .order("criado_em", { ascending: false });
        return { dados: (data ?? []).map(paraPerfil), erro: paraErro(error) };
      }),

    listarVersoes: (perfilIds) =>
      protegido(async () => {
        if (perfilIds.length === 0) return { dados: [], erro: null };
        const v = await supabase
          .from("perfis_perfil_versao")
          .select(COLUNAS.versaoPerfil)
          .in("perfil_id", perfilIds);
        if (v.error) return { dados: null, erro: paraErro(v.error) };
        const versoes = v.data ?? [];
        const ids = versoes.map((x) => x.id);
        const c =
          ids.length === 0
            ? { data: [], error: null }
            : await supabase
                .from("perfis_perfil_versao_contato")
                .select("versao_id, whatsapp_comercial_e164")
                .in("versao_id", ids);
        if (c.error) return { dados: null, erro: paraErro(c.error) };
        const contato = new Map(
          (c.data ?? []).map((x) => [x.versao_id, x.whatsapp_comercial_e164]),
        );
        return {
          dados: versoes.map((x) => paraVersaoPerfil(x, contato.get(x.id) ?? null)),
          erro: null,
        };
      }),

    gravarVersao: (perfilId, c) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("perfis_gravar_versao", {
          p_perfil_id: perfilId,
          p_whatsapp_comercial: c.whatsapp_comercial_e164,
          p_nome: opc(c.nome),
          p_descricao_breve: opc(c.descricao_breve),
          p_imagem_path: opc(c.imagem_path),
          p_categoria_principal_id: opc(c.categoria_principal_id),
          p_categoria_secundaria_1_id: opc(c.categoria_secundaria_1_id),
          p_categoria_secundaria_2_id: opc(c.categoria_secundaria_2_id),
          p_cidade: opc(c.cidade),
          p_uf: opc(c.uf),
          p_endereco: opc(c.endereco),
          p_areas_atendidas: c.areas_atendidas,
          p_banners_paths: c.banners_paths,
          p_fotos_paths: c.fotos_paths,
          p_site: opc(c.site),
          p_informacoes_sociais: opc(c.informacoes_sociais),
        });
        return { dados: typeof data === "string" ? data : null, erro: paraErro(error) };
      }),

    enviarVersao: (versaoId) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_enviar_versao", { p_versao_id: versaoId });
        return paraErro(error);
      }),

    atualizarPerfil: (perfilId, c) =>
      protegido(async () => {
        const campos: { publicado?: boolean; slug?: string } = {};
        if (c.publicado !== undefined) campos.publicado = c.publicado;
        if (c.slug !== undefined) campos.slug = c.slug;
        const { data, error } = await supabase
          .from("perfis_perfil")
          .update(campos)
          .eq("id", perfilId)
          .select(COLUNAS.perfil)
          .maybeSingle();
        return { dados: data ?? null, erro: paraErro(error) };
      }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------------------------------------

export function criarBancoItens(supabase: ClienteSupabaseFase2): ClienteBancoItens {
  return {
    ehAdministrador: () => consultarAdmin(supabase),

    buscarVersaoParaRevisao: (versaoId) =>
      protegido(async () => {
        const v = await supabase
          .from("catalogo_item_versao")
          .select(COLUNAS.versaoItem)
          .eq("id", versaoId)
          .maybeSingle();
        if (v.error || !v.data) return { dados: null, erro: paraErro(v.error) };
        const i = await supabase
          .from("catalogo_item")
          .select("id, perfil_id, tipo")
          .eq("id", v.data.item_id)
          .maybeSingle();
        if (i.error || !i.data) return { dados: null, erro: paraErro(i.error) };
        return {
          dados: {
            item: { id: i.data.id, perfil_id: i.data.perfil_id, tipo: i.data.tipo as TipoItem },
            versao: paraVersaoItem(v.data),
          },
          erro: null,
        };
      }),
    criarItem: (c) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("catalogo_criar_item", {
          p_tipo: c.tipo,
          p_perfil_id: opc(c.perfil_id),
          p_nome: opc(c.nome),
          p_descricao: opc(c.descricao),
          p_categoria_principal_id: opc(c.categoria_principal_id),
          p_categoria_secundaria_1_id: opc(c.categoria_secundaria_1_id),
          p_categoria_secundaria_2_id: opc(c.categoria_secundaria_2_id),
          p_preco_modo: opc(c.preco_modo),
          p_preco_centavos: opc(c.preco_centavos),
          // Só o anúncio particular leva localização (D-008); nulos são omitidos.
          ...(c.cidade ? { p_cidade: c.cidade } : {}),
          ...(c.uf ? { p_uf: c.uf } : {}),
        });
        const linha = Array.isArray(data) ? data[0] : null;
        return {
          dados: linha ? { item_id: linha.o_item_id, versao_id: linha.o_versao_id } : null,
          erro: paraErro(error),
        };
      }),

    buscarMeuItem: (itemId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_meus_itens")
          .select(COLUNAS.item)
          .eq("id", itemId)
          .maybeSingle();
        return { dados: data ? paraItem(data) : null, erro: paraErro(error) };
      }),

    listarMeusItens: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_meus_itens")
          .select(COLUNAS.item)
          .order("criado_em", { ascending: false });
        return { dados: (data ?? []).map(paraItem), erro: paraErro(error) };
      }),

    listarVersoes: (itemIds) =>
      protegido(async () => {
        if (itemIds.length === 0) return { dados: [], erro: null };
        const { data, error } = await supabase
          .from("catalogo_item_versao")
          .select(COLUNAS.versaoItem)
          .in("item_id", itemIds);
        return { dados: (data ?? []).map(paraVersaoItem), erro: paraErro(error) };
      }),

    inserirVersao: (c) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_item_versao")
          .insert({
            item_id: c.item_id,
            nome: c.nome,
            descricao: c.descricao,
            foto_path: c.foto_path,
            categoria_principal_id: c.categoria_principal_id,
            categoria_secundaria_1_id: c.categoria_secundaria_1_id,
            categoria_secundaria_2_id: c.categoria_secundaria_2_id,
            preco_modo: c.preco_modo,
            preco_centavos: c.preco_centavos,
            cidade: c.cidade,
            uf: c.uf,
          })
          .select(COLUNAS.versaoItem)
          .maybeSingle();
        return { dados: data ? paraVersaoItem(data) : null, erro: paraErro(error) };
      }),

    atualizarVersao: (versaoId, c) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_item_versao")
          .update({
            nome: c.nome,
            descricao: c.descricao,
            foto_path: c.foto_path,
            categoria_principal_id: c.categoria_principal_id,
            categoria_secundaria_1_id: c.categoria_secundaria_1_id,
            categoria_secundaria_2_id: c.categoria_secundaria_2_id,
            preco_modo: c.preco_modo,
            preco_centavos: c.preco_centavos,
            cidade: c.cidade,
            uf: c.uf,
          })
          .eq("id", versaoId)
          .select(COLUNAS.versaoItem)
          .maybeSingle();
        return { dados: data ? paraVersaoItem(data) : null, erro: paraErro(error) };
      }),

    enviarVersao: (versaoId) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("catalogo_enviar_item_versao", {
          p_versao_id: versaoId,
        });
        return paraErro(error);
      }),

    definirPublicado: (itemId, publicado) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_item")
          .update({ publicado })
          .eq("id", itemId)
          .select(COLUNAS.item)
          .maybeSingle();
        return {
          dados: data ? { ...data, tipo: data.tipo as TipoItem } : null,
          erro: paraErro(error),
        };
      }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------------------------------------

export function criarBancoCategorias(
  supabase: ClienteSupabaseFase2,
  contaId: string,
): ClienteBancoCategorias {
  return {
    contaId,
    ehAdministrador: () => consultarAdmin(supabase),

    listarTodasCategorias: () =>
      protegido(async () => {
        // Sem filtro de ativa: a RLS libera as inativas só ao administrador.
        const { data, error } = await supabase
          .from("catalogo_categoria")
          .select(COLUNAS.categoria)
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true });
        return { dados: (data ?? []) as LinhaCategoria[], erro: paraErro(error) };
      }),

    listarCategorias: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_categoria")
          .select(COLUNAS.categoria)
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true });
        return { dados: (data ?? []) as LinhaCategoria[], erro: paraErro(error) };
      }),

    inserirSolicitacao: (c) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_categoria_solicitacao")
          .insert({
            solicitante_id: c.solicitante_id,
            nome_sugerido: c.nome_sugerido,
            justificativa: c.justificativa,
          })
          .select(COLUNAS.solicitacao)
          .maybeSingle();
        return { dados: data ? paraSolicitacao(data) : null, erro: paraErro(error) };
      }),

    listarMinhasSolicitacoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_categoria_solicitacao")
          .select(COLUNAS.solicitacao)
          .eq("solicitante_id", contaId)
          .order("criado_em", { ascending: false });
        return { dados: (data ?? []).map(paraSolicitacao), erro: paraErro(error) };
      }),

    listarSolicitacoesPendentes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_categoria_solicitacao")
          .select(COLUNAS.solicitacao)
          .eq("situacao", "pendente")
          .order("criado_em", { ascending: true });
        return { dados: (data ?? []).map(paraSolicitacao), erro: paraErro(error) };
      }),

    async criarCategoria(a) {
      try {
        const { data, error } = await supabase.rpc("catalogo_criar_categoria", {
          p_nome: a.nome,
          p_slug: a.slug,
          p_ordem: a.ordem,
        });
        return { id: typeof data === "string" ? data : null, erro: paraErro(error) };
      } catch {
        return { id: null, erro: ERRO_DESCONHECIDO };
      }
    },

    alterarCategoria: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("catalogo_alterar_categoria", {
          p_id: a.id,
          p_nome: a.nome,
          p_ativa: a.ativa,
          p_ordem: a.ordem,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),

    decidirSolicitacao: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("catalogo_decidir_solicitacao", {
          p_id: a.id,
          p_atendida: a.atendida,
          p_motivo: a.motivo as string,
          p_categoria_id: opc(a.categoriaId),
        });
        return paraErro(error);
      }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------------------------------------

export function criarBancoAdministracao(
  supabase: ClienteSupabaseFase2,
  contaId: string,
): ClienteBancoAdministracao {
  return {
    contaId,
    ehAdministrador: () => consultarAdmin(supabase),

    listarFila: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_fila_pendencias")
          .select(COLUNAS.fila)
          .order("enviada_em", { ascending: true });
        return { dados: (data ?? []) as unknown as LinhaFila[], erro: paraErro(error) };
      }),

    decidirPerfil: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_decidir_versao", {
          p_versao_id: a.versaoId,
          p_aprovar: a.aprovar,
          p_motivo: opc(a.motivo),
        });
        return paraErro(error);
      }),

    decidirItem: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("catalogo_decidir_item_versao", {
          p_versao_id: a.versaoId,
          p_aprovar: a.aprovar,
          p_motivo: opc(a.motivo),
        });
        return paraErro(error);
      }),

    listarMinhasRevisoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_meus_resultados")
          .select(COLUNAS.resultado);
        return { dados: (data ?? []) as unknown as LinhaResultadoRevisao[], erro: paraErro(error) };
      }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Busca pública (IM-019) e patrocinadores (IM-020)
// ---------------------------------------------------------------------------------------------------------

/**
 * Busca pública: rpc busca_publica + categorias ativas. Funciona com a sessão anônima. Parâmetros nulos ou
 * ausentes são OMITIDOS (a função tem default para todos os filtros).
 */
export function criarBancoBusca(supabase: ClienteSupabaseFase2): ClienteBancoBusca {
  return {
    buscar: (params) =>
      protegido(async () => {
        const args: Record<string, string | number> = {};
        for (const [chave, valor] of Object.entries(params)) {
          if (valor !== null && valor !== undefined) args[chave] = valor;
        }
        const { data, error } = await supabase.rpc("busca_publica", args);
        return { dados: (data ?? []) as LinhaBusca[], erro: paraErro(error) };
      }),

    listarCategorias: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("catalogo_categoria")
          .select(COLUNAS.categoria)
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true });
        return { dados: (data ?? []) as LinhaCategoria[], erro: paraErro(error) };
      }),
  };
}

/**
 * Patrocinadores: leitura pública (visão) e funções de administrador (rpc). Sessão do usuário; quem decide é a
 * RLS e o papel conferido de novo dentro de cada função. Parâmetros opcionais nulos são omitidos na criação;
 * na alteração a função exige todos os parâmetros, então os nulos seguem como null.
 */
export function criarBancoPatrocinadores(
  supabase: ClienteSupabaseFase2,
): ClienteBancoPatrocinadores {
  return {
    listarPublicos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_patrocinador_publico")
          .select(COLUNAS.patrocinadorPublico);
        return { dados: (data ?? []) as LinhaPatrocinadorPublico[], erro: paraErro(error) };
      }),

    ehAdministrador: () => consultarAdmin(supabase),

    listarTodos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_patrocinador")
          .select(COLUNAS.patrocinadorAdmin)
          .order("ordem", { ascending: true })
          .order("criado_em", { ascending: true });
        return { dados: (data ?? []) as LinhaPatrocinadorAdmin[], erro: paraErro(error) };
      }),

    async criar(p) {
      try {
        const { data, error } = await supabase.rpc("administracao_criar_patrocinador", {
          p_titulo: p.p_titulo,
          p_imagem_path: p.p_imagem_path,
          p_ordem: p.p_ordem,
          p_ativo: p.p_ativo,
          p_id: p.p_id,
          ...(p.p_perfil_destino_id ? { p_perfil_destino_id: p.p_perfil_destino_id } : {}),
          ...(p.p_texto_destino ? { p_texto_destino: p.p_texto_destino } : {}),
          ...(p.p_inicio_em ? { p_inicio_em: p.p_inicio_em } : {}),
          ...(p.p_fim_em ? { p_fim_em: p.p_fim_em } : {}),
          ...(p.p_motivo ? { p_motivo: p.p_motivo } : {}),
        });
        return { id: typeof data === "string" ? data : null, erro: paraErro(error) };
      } catch {
        return { id: null, erro: ERRO_DESCONHECIDO };
      }
    },

    alterar: (p) =>
      protegidoErro(async () => {
        // A função exige todos os parâmetros; os tipos gerados não admitem null, mas o banco aceita.
        const { error } = await supabase.rpc("administracao_alterar_patrocinador", {
          p_id: p.p_id,
          p_titulo: p.p_titulo,
          p_imagem_path: p.p_imagem_path,
          p_perfil_destino_id: p.p_perfil_destino_id as string,
          p_texto_destino: p.p_texto_destino as string,
          p_ordem: p.p_ordem,
          p_inicio_em: p.p_inicio_em as string,
          p_fim_em: p.p_fim_em as string,
          p_motivo: p.p_motivo,
        });
        return paraErro(error);
      }),

    definirAtivo: (p) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("administracao_definir_patrocinador_ativo", {
          p_id: p.p_id,
          p_ativo: p.p_ativo,
          p_motivo: p.p_motivo,
        });
        return paraErro(error);
      }),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------------------------------------

export function criarBancosSupabase(
  supabase: ClienteSupabaseFase2,
  contaId: string,
): DependenciasContexto {
  const assinar = criarAssinadorImagens(supabase);
  return {
    contaId,
    bancoPerfis: criarBancoPerfis(supabase),
    bancoItens: criarBancoItens(supabase),
    bancoCategorias: criarBancoCategorias(supabase, contaId),
    bancoAdministracao: criarBancoAdministracao(supabase, contaId),
    assinarImagens: assinar,
  };
}
