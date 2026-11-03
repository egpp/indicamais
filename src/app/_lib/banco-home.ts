import type { ClienteBancoHomeAdmin, LinhaSecaoHomeAdmin } from "@/modules/administracao";
import type { ClienteBancoHome, LinhaPerfilHome, LinhaSecaoHome } from "@/modules/busca";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import { consultarAdmin, type ClienteSupabaseFase2 } from "./bancos-supabase";

/**
 * Adaptadores supabase-js das seções da home (IM-095, IM-096). Sempre com a sessão em uso (anônima na página pública,
 * do administrador no painel); nunca service_role. Erros viram `ErroBanco` só com o código (o texto não passa).
 */

const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };
const comoErro = (e: { code?: string } | null): ErroBanco | null => (e ? { code: e.code } : null);

/** Leitura pública: rpc busca_home_secoes e busca_home_secao_perfis. Parâmetros ausentes são omitidos. */
export function criarBancoHome(supabase: ClienteSupabaseFase2): ClienteBancoHome {
  return {
    async listarSecoes(p) {
      try {
        const { data, error } = await supabase.rpc("busca_home_secoes", {
          ...(p.p_cidade ? { p_cidade: p.p_cidade } : {}),
          ...(p.p_uf ? { p_uf: p.p_uf } : {}),
        });
        return { dados: (data ?? []) as LinhaSecaoHome[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async listarPerfisDaSecao(p) {
      try {
        const { data, error } = await supabase.rpc("busca_home_secao_perfis", {
          p_chave: p.p_chave,
          ...(p.p_cidade ? { p_cidade: p.p_cidade } : {}),
          ...(p.p_uf ? { p_uf: p.p_uf } : {}),
          ...(p.p_limite ? { p_limite: p.p_limite } : {}),
        });
        return { dados: (data ?? []) as LinhaPerfilHome[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
  };
}

const COLUNAS_SECAO =
  "chave, titulo, ativa, ordem, minimo_itens, limite_padrao, tipo_item, atualizado_em";

/** Edição pelo administrador geral: select em busca_home_secao (a RLS libera as inativas só a ele) e rpc de alteração. */
export function criarBancoHomeAdmin(supabase: ClienteSupabaseFase2): ClienteBancoHomeAdmin {
  return {
    ehAdministrador: () => consultarAdmin(supabase),
    async listarSecoes() {
      try {
        const { data, error } = await supabase
          .from("busca_home_secao")
          .select(COLUNAS_SECAO)
          .order("ordem", { ascending: true })
          .order("chave", { ascending: true });
        return { dados: (data ?? []) as LinhaSecaoHomeAdmin[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async alterarSecao(p) {
      try {
        const { error } = await supabase.rpc("administracao_alterar_home_secao", p);
        return { erro: comoErro(error) };
      } catch {
        return { erro: ERRO_DESCONHECIDO };
      }
    },
  };
}
