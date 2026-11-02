import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoAparencia } from "@/modules/perfis";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database, Json } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js da aparência da página (D-016: estilo IM-091/IM-094 e banner IM-093). Usa a SESSÃO do
 * usuário (anon na vitrine): RLS e visões decidem o que cada um vê. Nunca recebe service_role. Colunas sempre
 * nomeadas; nenhuma coluna de conta. A coluna antiga perfis_perfil_versao.banners_paths NÃO é usada aqui.
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_APARENCIA = {
  estilos: "id, rotulo, ordem, habilitado",
  estilo: "estilo_pagina",
  bannerPublico: "id, perfil_id, imagem_path, texto_alternativo, destino_secao, ordem",
  bannerAguardando:
    "id, perfil_id, imagem_path, texto_alternativo, destino_secao, ordem, ativo, criado_em",
  bannerAdmin:
    "id, perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, ativo, motivo_resposta, respondido_em, criado_em",
} as const;

const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };

function paraErro(e: ErroPostgrest): ErroBanco | null {
  return e ? { code: e.code, message: e.message, details: e.details } : null;
}

async function protegido<T>(f: () => PromiseLike<{ dados: T | null; erro: ErroBanco | null }>) {
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

// Os tipos gerados exigem string nos opcionais; o banco aceita nulo (default null).
const nulo = null as unknown as string;

export function criarBancoAparencia(supabase: Cliente): ClienteBancoAparencia {
  return {
    listarEstilos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_estilo_pagina")
          .select(COLUNAS_APARENCIA.estilos)
          .order("ordem");
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    lerEstiloMeuPerfil: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_meus_perfis")
          .select(COLUNAS_APARENCIA.estilo)
          .eq("id", perfilId)
          .maybeSingle();
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    lerEstiloPublico: (slug) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_perfil_publico")
          .select(COLUNAS_APARENCIA.estilo)
          .eq("slug", slug)
          .maybeSingle();
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    definirEstilo: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_definir_estilo", {
          p_perfil_id: a.perfilId,
          p_estilo: a.estilo,
        });
        return paraErro(error);
      }),

    definirEstiloHabilitado: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_admin_definir_estilo_habilitado", {
          p_estilo: a.estilo,
          p_habilitado: a.habilitado,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),

    gravarBanners: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("perfis_gravar_banners", {
          p_perfil_id: a.perfilId,
          p_banners: a.banners as Json,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    responderBanner: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_responder_banner", {
          p_banner_id: a.bannerId,
          p_aceitar: a.aceitar,
          p_motivo: a.motivo ?? nulo,
        });
        return paraErro(error);
      }),

    definirBannerAtivo: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_definir_banner_ativo", {
          p_banner_id: a.bannerId,
          p_ativo: a.ativo,
        });
        return paraErro(error);
      }),

    adicionarBannerAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("perfis_admin_adicionar_banner", {
          p_perfil_id: a.perfilId,
          p_imagem_path: a.imagemPath,
          p_texto_alternativo: a.textoAlternativo,
          p_motivo: a.motivo,
          p_ordem: a.ordem,
          p_destino_secao: a.destinoSecao ?? nulo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    removerBannerAdmin: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_admin_remover_banner", {
          p_banner_id: a.bannerId,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),

    listarBannersPublicos: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_banner_publico")
          .select(COLUNAS_APARENCIA.bannerPublico)
          .eq("perfil_id", perfilId);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarBannersAguardandoAceite: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_banner_aguardando_aceite")
          .select(COLUNAS_APARENCIA.bannerAguardando);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarBannersAdmin: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_banners_empresa")
          .select(COLUNAS_APARENCIA.bannerAdmin)
          .eq("perfil_id", perfilId);
        return { dados: data ?? [], erro: paraErro(error) };
      }),
  };
}
