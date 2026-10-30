import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoNotificacoesApp } from "@/modules/notificacoes";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js do módulo notificacoes (Fase 5): avisos, leitura e abas. Usa a SESSÃO do usuário; as visões
 * e RPCs filtram por auth.uid(). Nunca recebe service_role. Colunas SEMPRE nomeadas. Não confundir com
 * banco-indicacoes.ts (criarBancoNotificacoes), que é o envio de e-mail pelo servidor.
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_AVISOS = {
  avisos:
    "origem, origem_id, tipo, destino_tipo, destino_id, destino_nome, ator_nome, criado_em, lida, lida_em",
  quemMeIndicou:
    "id, destino_tipo, destino_id, destino_nome, perfil_destino_id, perfil_destino_nome, indicador_nome, indicador_ref, indicador_saiu_da_base, criado_em",
  minhasIndicacoes: "id, destino_tipo, destino_id, destino_nome, criado_em, status",
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

export function criarBancoAvisos(supabase: Cliente): ClienteBancoNotificacoesApp {
  return {
    listarMeusAvisos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("notificacoes_meus_avisos")
          .select(COLUNAS_AVISOS.avisos);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    contarNaoLidas: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("notificacoes_contar_nao_lidas");
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    marcarLida: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("notificacoes_marcar_lida", {
          p_origem: a.origem,
          p_origem_id: a.origemId,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    marcarTodasLidas: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("notificacoes_marcar_todas_lidas");
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarQuemMeIndicou: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("notificacoes_quem_me_indicou")
          .select(COLUNAS_AVISOS.quemMeIndicou);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasIndicacoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("indicacoes_minhas_indicacoes")
          .select(COLUNAS_AVISOS.minhasIndicacoes);
        return { dados: data ?? [], erro: paraErro(error) };
      }),
  };
}
