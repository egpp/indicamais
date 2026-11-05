import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarServicoNotificacoesContato,
  type ClienteBancoNotificacoes,
  type EnviadorEmail,
} from "@/modules/indicacoes";
import { LIMITES } from "@/shared/config/limites";
import type { Database } from "@/shared/db/database.types";
import { criarEnviadorResend, ERRO_EMAIL, lerConfigResend } from "@/shared/email/enviador-resend";
import { criarBancoNotificacoes } from "./banco-indicacoes";
import { CAMINHO_PAINEL_PEDIDOS } from "./notificacoes-contato";

/**
 * Reprocessamento das notificações de contato pelo cron (IM-027, IM-028, IM-080). Roda no Worker agendado, com o
 * cliente de serviço. Reaproveita o serviço existente (tentativasMax, alerta, idempotência por pedido e tentativa).
 * Sem EMAIL_API_KEY/EMAIL_FROM ou sem NEXT_PUBLIC_APP_URL não faz nada e não dá erro (os pedidos seguem pendentes).
 * Devolve só contagens; nunca e-mail, nome ou conteúdo.
 */

export type BancoNotificacoesCron = ClienteBancoNotificacoes & {
  /** rpc indicacoes_notificacoes_recolocar_falhas: devolve à fila as falhas com tentativas sobrando. */
  recolocarFalhas(a: {
    limite: number;
    tentativasMax: number;
    esperaMinutos: number;
  }): Promise<{ dados: number | null; erro: boolean }>;
};

export function criarBancoNotificacoesCron(
  servico: SupabaseClient<Database>,
): BancoNotificacoesCron {
  return {
    ...criarBancoNotificacoes(servico),
    async recolocarFalhas(a) {
      try {
        const { data, error } = await servico.rpc("indicacoes_notificacoes_recolocar_falhas", {
          p_limite: a.limite,
          p_tentativas_max: a.tentativasMax,
          p_espera_minutos: a.esperaMinutos,
        });
        return error || typeof data !== "number"
          ? { dados: null, erro: true }
          : { dados: data, erro: false };
      } catch {
        return { dados: null, erro: true };
      }
    },
  };
}

export type AmbienteNotificacoesCron = Record<string, string | undefined>;

export type DependenciasCron = {
  banco: BancoNotificacoesCron;
  env: AmbienteNotificacoesCron;
  /** Injetável nos testes (nunca e-mail real). Padrão: Resend por fetch. */
  criarEnviador?: (cfg: { chave: string; remetente: string }) => EnviadorEmail;
};

function urlDoPainel(env: AmbienteNotificacoesCron): string | null {
  const bruto = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!bruto) return null;
  try {
    const u = new URL(bruto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${CAMINHO_PAINEL_PEDIDOS}`;
  } catch {
    return null;
  }
}

/** Contagens por execução; vazio quando não há o que fazer (sem chave/URL). */
export async function processarNotificacoesNoCron(
  d: DependenciasCron,
): Promise<Record<string, number | "falhou">> {
  const cfg = lerConfigResend(d.env);
  const urlPainel = urlDoPainel(d.env);
  if (!cfg || !urlPainel) return {};

  const { tentativasMax, loteCron, esperaReenvioMin } = LIMITES.notificacaoContato;
  const saida: Record<string, number | "falhou"> = {};

  const rec = await d.banco.recolocarFalhas({
    limite: loteCron,
    tentativasMax,
    esperaMinutos: esperaReenvioMin,
  });
  saida.notificacoes_contato_recolocadas = rec.erro || rec.dados === null ? "falhou" : rec.dados;

  const enviador = d.criarEnviador ? d.criarEnviador(cfg) : criarEnviadorResend(cfg);
  const r = await criarServicoNotificacoesContato(d.banco, enviador).processarNotificacoesPendentes(
    {
      urlPainel,
      tentativasMax,
      lote: loteCron,
      // Limite diário/por segundo do provedor: para o lote, sem gastar tentativa dos pedidos restantes.
      pararQuando: (erro) => erro === ERRO_EMAIL.limite,
    },
  );
  if (!r.ok) {
    saida.notificacoes_contato_processamento = "falhou";
    return saida;
  }
  saida.notificacoes_contato_lidas = r.resumo.lidas;
  saida.notificacoes_contato_enviadas = r.resumo.enviadas;
  saida.notificacoes_contato_falhas = r.resumo.falhas;
  saida.notificacoes_contato_limite_tentativas = r.resumo.limiteAtingido;
  saida.notificacoes_contato_sem_registro = r.resumo.semRegistro;
  saida.notificacoes_contato_interrompido = r.resumo.interrompido ? 1 : 0;
  return saida;
}

/** Encaixe no agendador: recebe o cliente de serviço do Worker e o `env` do handler. */
export function tarefasNotificacoesCron(env: AmbienteNotificacoesCron) {
  return (cliente: unknown) => [
    {
      nome: "notificacoes_contato",
      executar: () =>
        processarNotificacoesNoCron({
          banco: criarBancoNotificacoesCron(cliente as SupabaseClient<Database>),
          env,
        }),
    },
  ];
}
