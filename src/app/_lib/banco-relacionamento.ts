import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoRelacionamento } from "@/modules/relacionamento";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js do módulo relacionamento (Fase 5). Usa a SESSÃO do usuário: as visões e RPCs do banco
 * filtram por auth.uid(). Nunca recebe service_role. Colunas SEMPRE nomeadas (sem "*"); nenhuma coluna de conta.
 * Erros viram `ErroBanco` (só o código é usado; o texto ao usuário é sempre do módulo).
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_RELACIONAMENTO = {
  meusMembros:
    "id, perfil_id, perfil_nome, pessoa_nome, curtiu, curtida_em, indicou, primeira_indicacao_em, ultima_indicacao_em, indicacoes_validas, interacoes, entrou_em",
  meuResumo: "perfil_id, perfil_nome, membros, curtidas_ativas, indicadores, interacoes, saidas",
  minhasParticipacoes:
    "perfil_id, perfil_slug, perfil_nome, curtiu, curtida_em, indicou, indicacoes_validas, entrou_em",
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

export function criarBancoRelacionamento(supabase: Cliente): ClienteBancoRelacionamento {
  return {
    curtir: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("relacionamento_curtir", {
          p_perfil_id: a.perfilId,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    descurtir: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("relacionamento_descurtir", {
          p_perfil_id: a.perfilId,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    sairDaBase: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("relacionamento_sair_da_base", {
          p_perfil_id: a.perfilId,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarMeusMembros: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("relacionamento_meus_membros")
          .select(COLUNAS_RELACIONAMENTO.meusMembros);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    lerMeuResumo: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("relacionamento_meu_resumo")
          .select(COLUNAS_RELACIONAMENTO.meuResumo);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasParticipacoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("relacionamento_minhas_participacoes")
          .select(COLUNAS_RELACIONAMENTO.minhasParticipacoes);
        return { dados: data ?? [], erro: paraErro(error) };
      }),
  };
}
