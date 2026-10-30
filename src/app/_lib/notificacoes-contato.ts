import { after } from "next/server";
import {
  criarServicoNotificacoesContato,
  ENVIADOR_EMAIL_SEM_PROVEDOR,
  type ClienteBancoNotificacoes,
  type EnviadorEmail,
  type ResultadoProcessamento,
} from "@/modules/indicacoes";
import { criarClienteServico } from "@/shared/supabase/servico";
import { criarBancoNotificacoes } from "./banco-indicacoes";
import { origemPublica } from "./site";

/**
 * Aviso por e-mail ao responsável (IM-027, IM-028, IM-050). Sem provedor configurado (EMAIL_API_KEY vazia) NADA
 * é disparado: o pedido fica com a notificação "pendente" e o responsável o vê no painel. Provedor real ainda
 * não existe (decisão do Emerson): por enquanto o enviador é o padrão do módulo, que falha de forma controlada.
 */

/** Só uma chave preenchida liga o processamento. */
export function provedorEmailConfigurado(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.EMAIL_API_KEY ?? "").trim() !== "";
}

/** Caminho do painel do responsável (aparece no e-mail). */
export const CAMINHO_PAINEL_PEDIDOS = "/pedidos-de-contato";

export type DependenciasDisparo = {
  configurado: boolean;
  /** Banco do servidor; só é criado (e a chave de serviço só é lida) se `configurado`. */
  criarBanco: () => ClienteBancoNotificacoes;
  enviador: EnviadorEmail;
  urlPainel: string | null;
  /** Só após reenvio forçado pelo administrador (IM-028): ignora o limite de tentativas nesta execução. */
  ignorarLimiteTentativas?: boolean;
  /** Agenda trabalho em segundo plano no servidor (`after` do Next). */
  agendar: (tarefa: () => Promise<void>) => void;
};

/**
 * Dispara o processamento das notificações pendentes em segundo plano, DEPOIS da resposta ao visitante.
 * Devolve false (e não faz nada) quando não há provedor ou URL do painel. Falha nunca chega ao visitante.
 */
export function dispararNotificacoes(d: DependenciasDisparo): boolean {
  if (!d.configurado || !d.urlPainel) return false;
  const urlPainel = d.urlPainel;
  d.agendar(async () => {
    try {
      const servico = criarServicoNotificacoesContato(d.criarBanco(), d.enviador);
      const r: ResultadoProcessamento = await servico.processarNotificacoesPendentes({
        urlPainel,
        ...(d.ignorarLimiteTentativas ? { ignorarLimiteTentativas: true } : {}),
      });
      if (!r.ok) console.error("Falha ao processar as notificações de contato.");
    } catch {
      // Sem detalhe: a mensagem poderia citar configuração. O pedido segue pendente e será relido.
      console.error("Falha ao processar as notificações de contato.");
    }
  });
  return true;
}

/** Disparo real: `after` do Next, cliente de serviço do servidor e enviador sem provedor (por enquanto). */
export function dispararNotificacoesDoServidor(
  opcoes: { ignorarLimiteTentativas?: boolean } = {},
): boolean {
  const origem = origemPublica();
  return dispararNotificacoes({
    configurado: provedorEmailConfigurado(),
    criarBanco: () => criarBancoNotificacoes(criarClienteServico()),
    enviador: ENVIADOR_EMAIL_SEM_PROVEDOR,
    urlPainel: origem ? `${origem}${CAMINHO_PAINEL_PEDIDOS}` : null,
    ...(opcoes.ignorarLimiteTentativas ? { ignorarLimiteTentativas: true } : {}),
    agendar: (tarefa) => after(tarefa),
  });
}
