import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoLocalizacao } from "@/modules/perfis";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js da localização (D-016; IM-018, IM-092). Usa a SESSÃO do usuário (anon na vitrine):
 * RLS e funções do banco decidem. Nunca recebe service_role. Colunas nomeadas; sem coluna de conta.
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_LOCALIZACAO = {
  endereco: "endereco, cidade, uf",
  mapa: "latitude, longitude, mostrar_mapa",
} as const;

const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };
const paraErro = (e: ErroPostgrest): ErroBanco | null =>
  e ? { code: e.code, message: e.message, details: e.details } : null;

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

export function criarBancoLocalizacao(supabase: Cliente): ClienteBancoLocalizacao {
  return {
    lerEnderecoVersao: (versaoId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_perfil_versao")
          .select(COLUNAS_LOCALIZACAO.endereco)
          .eq("id", versaoId)
          .maybeSingle();
        const ok =
          data && data.endereco !== null && data.cidade !== null && data.uf !== null
            ? { endereco: data.endereco, cidade: data.cidade, uf: data.uf }
            : null;
        return { dados: ok, erro: paraErro(error) };
      }),
    gravarCoordenadas: (versaoId, latitude, longitude, origem) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_gravar_coordenadas", {
          p_versao_id: versaoId,
          p_latitude: latitude,
          p_longitude: longitude,
          p_origem: origem,
        });
        return paraErro(error);
      }),
    limparCoordenadas: (versaoId) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_limpar_coordenadas", {
          p_versao_id: versaoId,
        });
        return paraErro(error);
      }),
    definirMostrarMapa: (perfilId, mostrar) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("perfis_definir_mostrar_mapa", {
          p_perfil_id: perfilId,
          p_mostrar: mostrar,
        });
        return paraErro(error);
      }),
    lerMeuMapa: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_meus_perfis")
          .select(COLUNAS_LOCALIZACAO.mapa)
          .eq("id", perfilId)
          .maybeSingle();
        return { dados: data ?? null, erro: paraErro(error) };
      }),
    lerMapaPublico: (perfilId) =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("perfis_perfil_publico")
          .select(COLUNAS_LOCALIZACAO.mapa)
          .eq("id", perfilId)
          .maybeSingle();
        return { dados: data ?? null, erro: paraErro(error) };
      }),
  };
}
