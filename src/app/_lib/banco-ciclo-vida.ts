import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoCicloVida } from "@/modules/administracao";
import type { ClienteBancoCicloVidaConta } from "@/modules/contas";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptadores supabase-js da Fase 6 (D-014): administração (permissões, denúncias, suspensão, invalidação) e ciclo de
 * vida da própria conta. Só SESSÃO do usuário (ou anônima na denúncia pública); NUNCA service_role. Colunas sempre
 * nomeadas. O banimento no Auth e as rotinas agendadas (service_role) ficam com o devops.
 * `conta_id` só é lido onde é o alvo de uma ação do administrador (permissões concedidas e contas fora do normal).
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_CICLO_VIDA = {
  minhasPermissoes: "permissao, criado_em",
  permissoesConcedidas: "conta_id, permissao, concedida_por_ref, criado_em",
  filaDenuncias:
    "id, alvo_tipo, alvo_id, tipo, texto, situacao, denunciante_tipo, denunciante_ref, total_no_alvo, alvo_nome, criado_em, atualizado_em",
  decisoesDenuncia: "denuncia_id, de_situacao, para_situacao, motivo, autor_ref, criado_em",
  contasCicloVida:
    "conta_id, situacao, suspensa_em, encerramento_solicitado_em, encerramento_executar_apos, anonimizada_em, atualizado_em",
  indicacoesInvalidadas: "pedido_id, motivo, tem_reversao, autor_ref, criado_em",
} as const;

const semDados = { erro: null as ErroBanco | null };
const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };

function paraErro(e: ErroPostgrest): ErroBanco | null {
  return e ? { code: e.code, message: e.message, details: e.details } : null;
}

async function protegido<T extends { erro: ErroBanco | null }>(
  f: () => PromiseLike<T>,
  vazio: T,
): Promise<T> {
  try {
    return await f();
  } catch {
    return { ...vazio, erro: ERRO_DESCONHECIDO };
  }
}

export function criarBancoCicloVida(supabase: Cliente): ClienteBancoCicloVida {
  const ler = <L>(tabela: keyof Database["public"]["Views"], colunas: string) =>
    protegido(
      async () => {
        const { data, error } = await supabase.from(tabela).select(colunas);
        return { dados: (data ?? []) as unknown as L[], erro: paraErro(error) };
      },
      { dados: null as L[] | null, erro: null as ErroBanco | null },
    );
  const sem = (e: ErroPostgrest) => ({ erro: paraErro(e) });

  return {
    listarMinhasPermissoes: () =>
      ler("administracao_minhas_permissoes", COLUNAS_CICLO_VIDA.minhasPermissoes),
    listarPermissoesConcedidas: () =>
      ler("administracao_permissoes_concedidas", COLUNAS_CICLO_VIDA.permissoesConcedidas),
    concederPermissao: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_conceder_permissao", {
          p_conta: a.contaId,
          p_permissao: a.permissao,
          p_motivo: a.motivo,
        });
        return sem(error);
      }, semDados),
    revogarPermissao: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_revogar_permissao", {
          p_conta: a.contaId,
          p_permissao: a.permissao,
          p_motivo: a.motivo,
        });
        return sem(error);
      }, semDados),
    denunciar: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_denunciar", {
          p_alvo_tipo: a.alvoTipo,
          p_alvo_id: a.alvoId,
          p_tipo: a.tipo,
          ...(a.texto !== null ? { p_texto: a.texto } : {}),
          ...(a.origem !== null ? { p_origem: a.origem } : {}),
          ...(a.site !== null ? { p_site: a.site } : {}),
        });
        return sem(error);
      }, semDados),
    listarFilaDenuncias: () =>
      ler("administracao_fila_denuncias", COLUNAS_CICLO_VIDA.filaDenuncias),
    listarDecisoesDenuncia: () =>
      ler("administracao_denuncia_decisoes", COLUNAS_CICLO_VIDA.decisoesDenuncia),
    decidirDenuncia: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_decidir_denuncia", {
          p_denuncia_id: a.denunciaId,
          p_decisao: a.decisao,
          p_motivo: a.motivo,
        });
        return sem(error);
      }, semDados),
    suspenderConta: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_suspender_conta", {
          p_conta: a.contaId,
          p_motivo: a.motivo,
        });
        return sem(error);
      }, semDados),
    reativarConta: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("administracao_reativar_conta", {
          p_conta: a.contaId,
          p_motivo: a.motivo,
        });
        return sem(error);
      }, semDados),
    listarContasCicloVida: () =>
      ler("administracao_contas_ciclo_vida", COLUNAS_CICLO_VIDA.contasCicloVida),
    invalidarIndicacao: (a) =>
      protegido(
        async () => {
          const { data, error } = await supabase.rpc("administracao_invalidar_indicacao", {
            p_pedido_id: a.pedidoId,
            p_motivo: a.motivo,
            p_confirmar_saldo_negativo: a.confirmarSaldoNegativo,
          });
          return { dados: (data ?? null) as string | null, erro: paraErro(error) };
        },
        { dados: null as string | null, erro: null as ErroBanco | null },
      ),
    listarIndicacoesInvalidadas: () =>
      ler("administracao_indicacoes_invalidadas", COLUNAS_CICLO_VIDA.indicacoesInvalidadas),
  };
}

export function criarBancoCicloVidaConta(supabase: Cliente): ClienteBancoCicloVidaConta {
  return {
    lerMeuEstado: () =>
      protegido(
        async () => {
          const { data, error } = await supabase.rpc("contas_meu_estado");
          return { dados: data ?? [], erro: paraErro(error) };
        },
        { dados: [] as never[], erro: null as ErroBanco | null },
      ),
    solicitarEncerramento: (a) =>
      protegido(
        async () => {
          const { data, error } = await supabase.rpc("contas_solicitar_encerramento", {
            p_confirmacao: a.confirmacao,
          });
          return { dados: data ?? null, erro: paraErro(error) };
        },
        { dados: null, erro: null as ErroBanco | null },
      ),
    cancelarEncerramento: () =>
      protegido(async () => {
        const { error } = await supabase.rpc("contas_cancelar_encerramento");
        return { erro: paraErro(error) };
      }, semDados),
  };
}
