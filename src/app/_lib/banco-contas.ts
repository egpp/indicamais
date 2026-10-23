import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoContas, LinhaConta, RespostaBanco } from "@/modules/contas";

const COLUNAS = "id, nome_exibicao, whatsapp_e164, whatsapp_verificado, criado_em, atualizado_em";

/** Forma mínima do cliente, para permitir testes sem rede. */
type ClienteMinimo = Pick<SupabaseClient, "from" | "auth">;

type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

function paraErroBanco(erro: ErroPostgrest): RespostaBanco<LinhaConta>["erro"] {
  if (!erro) return null;
  return { code: erro.code, message: erro.message, details: erro.details };
}

/**
 * Adaptador de ClienteBancoContas sobre supabase-js com a SESSÃO DO USUÁRIO
 * (RLS restringe à própria conta). Nunca recebe service_role.
 */
export function criarBancoContas(supabase: ClienteMinimo): ClienteBancoContas {
  return {
    async buscarMinhaConta() {
      const { data, error } = await supabase
        .from("contas_conta")
        .select(COLUNAS)
        .maybeSingle<LinhaConta>();
      return { dados: data ?? null, erro: paraErroBanco(error) };
    },

    async atualizarMinhaConta(campos) {
      const { data: usuario } = await supabase.auth.getUser();
      const id = usuario.user?.id;
      if (!id) return { dados: null, erro: null };
      // .select().maybeSingle(): zero linhas afetadas volta como dados nulos sem erro.
      const { data, error } = await supabase
        .from("contas_conta")
        .update(campos)
        .eq("id", id)
        .select(COLUNAS)
        .maybeSingle<LinhaConta>();
      return { dados: data ?? null, erro: paraErroBanco(error) };
    },
  };
}
