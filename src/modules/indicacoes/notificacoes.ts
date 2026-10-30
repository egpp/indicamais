import { INVISIVEIS_GLOBAL } from "./invisiveis";
import { LIMITES } from "@/shared/config/limites";
import type { ErroBanco, RespostaBanco } from "@/shared/conteudo/resultado";

/**
 * Notificação ao responsável sobre pedido de contato (IM-027, IM-028, IM-050).
 * O e-mail NUNCA leva nome, WhatsApp, e-mail ou mensagem do visitante, nem dado do indicador: só o nome público
 * do destino e o link do painel. O envio real é uma porta injetada (provedor ainda indefinido).
 */

export type EmailParaEnviar = { para: string; assunto: string; texto: string };
export type ResultadoEnvio = { ok: true } | { ok: false; erro: string };

/** Porta de e-mail. O adaptador real (SMTP/API) é escolhido depois; não implementar provedor no módulo. */
export interface EnviadorEmail {
  enviar(email: EmailParaEnviar): Promise<ResultadoEnvio>;
}

export const ERRO_PROVEDOR_NAO_CONFIGURADO = "provedor de e-mail não configurado";

/**
 * Enviador padrão enquanto não há provedor: sempre falha de forma controlada. O pedido continua visível no
 * painel do responsável e o alerta administrativo abre; nada se perde.
 */
export const ENVIADOR_EMAIL_SEM_PROVEDOR: EnviadorEmail = {
  enviar: async () => ({ ok: false, erro: ERRO_PROVEDOR_NAO_CONFIGURADO }),
};

export type LinhaNotificacaoPendente = {
  o_pedido_id: string;
  o_email_responsavel: string | null;
  o_destino_tipo: string;
  o_destino_nome: string | null;
  o_tentativas: number;
};

/** Banco do SERVIDOR (service_role). Só o adaptador em src/app/_lib com cliente servidor cria este objeto. */
export interface ClienteBancoNotificacoes {
  /** rpc indicacoes_notificacoes_pendentes(p_limite). */
  listarPendentes(limite: number): Promise<RespostaBanco<LinhaNotificacaoPendente[]>>;
  /** rpc indicacoes_notificacao_registrar(p_pedido_id, p_sucesso, p_erro). */
  registrar(a: {
    pedidoId: string;
    sucesso: boolean;
    erro: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
}

/** Nome público para o texto do e-mail: sem controles, em uma linha, limitado. */
function nomePublico(nome: string | null, tipo: string): string {
  const limpo = (nome ?? "").replace(INVISIVEIS_GLOBAL, " ").replace(/\s+/g, " ").trim();
  if (limpo) return Array.from(limpo).slice(0, LIMITES.link.nomeDestinoMax).join("");
  return tipo === "item" ? "seu anúncio" : "seu perfil";
}

/** IM-050: o único texto que o responsável recebe por e-mail. */
export function montarEmailNovoPedido(
  p: { emailResponsavel: string; destinoTipo: string; destinoNome: string | null },
  urlPainel: string,
): EmailParaEnviar {
  const destino = nomePublico(p.destinoNome, p.destinoTipo);
  return {
    para: p.emailResponsavel,
    assunto: "Novo pedido de contato no IndicaMais",
    texto: `Você recebeu um novo pedido de contato em ${destino}. Acesse o painel para ver.\n\n${urlPainel}`,
  };
}

/**
 * Erro do provedor -> texto curto e seguro para gravar no banco: sem e-mails, sem sequências longas de números
 * (telefones), sem URLs, só letras, números e pontuação simples, truncado em LIMITES.notificacaoContato.erroMax.
 */
export function sanitizarErroNotificacao(bruto: unknown): string {
  let t = typeof bruto === "string" ? bruto : bruto instanceof Error ? bruto.message : "";
  t = t
    .replace(/[^\s@]+@[^\s@]+/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/(?:[0-9][\s().+-]*){6,}/g, " ")
    .replace(/[^\p{L}\p{N} _.:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = Array.from(t).slice(0, LIMITES.notificacaoContato.erroMax).join("").trim();
  return t || "erro_desconhecido";
}

export type OpcoesProcessamento = {
  /** Endereço do painel do responsável (ex.: `${NEXT_PUBLIC_APP_URL}/minha-conta/pedidos`). */
  urlPainel: string;
  /** Tentativas por pedido; padrão LIMITES.notificacaoContato.tentativasMax. */
  tentativasMax?: number;
  /** Tamanho do lote; padrão LIMITES.notificacaoContato.lote. */
  lote?: number;
  /**
   * Ação do administrador após reenvio forçado (IM-028): ignora o limite de tentativas nesta execução.
   * Nunca ligar no processamento automático.
   */
  ignorarLimiteTentativas?: boolean;
};

export type ResumoProcessamento = {
  lidas: number;
  enviadas: number;
  falhas: number;
  /** Falhas por limite de tentativas, sem envio de e-mail (alerta aberto para o administrador). */
  limiteAtingido: number;
  /** Casos em que o resultado não pôde ser gravado (o pedido segue pendente e será relido). */
  semRegistro: number;
};

export const ERRO_LIMITE_TENTATIVAS = "limite de tentativas atingido";
export const ERRO_SEM_EMAIL = "responsável sem e-mail";

export type ResultadoProcessamento =
  | { ok: true; resumo: ResumoProcessamento }
  | { ok: false; erro: { codigo: "ERRO_INTERNO"; mensagem: string } };

export function criarServicoNotificacoesContato(
  banco: ClienteBancoNotificacoes,
  enviador: EnviadorEmail,
) {
  return {
    /**
     * IM-027/IM-028/IM-050: envia as notificações pendentes. Falha de e-mail NUNCA apaga nem altera o pedido:
     * registra a falha (abre o alerta administrativo) e segue para o próximo. Idempotente: o banco ignora
     * resultado repetido de pedido já enviado.
     */
    async processarNotificacoesPendentes(
      opcoes: OpcoesProcessamento,
    ): Promise<ResultadoProcessamento> {
      const max = opcoes.tentativasMax ?? LIMITES.notificacaoContato.tentativasMax;
      const lote = opcoes.lote ?? LIMITES.notificacaoContato.lote;
      const resumo: ResumoProcessamento = {
        lidas: 0,
        enviadas: 0,
        falhas: 0,
        limiteAtingido: 0,
        semRegistro: 0,
      };
      try {
        const r = await banco.listarPendentes(lote);
        if (r.erro) {
          return {
            ok: false,
            erro: { codigo: "ERRO_INTERNO", mensagem: "Falha ao ler as notificações pendentes." },
          };
        }
        for (const p of r.dados ?? []) {
          resumo.lidas++;
          let sucesso = false;
          let erro: string | null = null;
          if (!opcoes.ignorarLimiteTentativas && p.o_tentativas >= max) {
            erro = ERRO_LIMITE_TENTATIVAS;
            resumo.limiteAtingido++;
          } else if (!p.o_email_responsavel) {
            erro = ERRO_SEM_EMAIL;
          } else {
            try {
              const envio = await enviador.enviar(
                montarEmailNovoPedido(
                  {
                    emailResponsavel: p.o_email_responsavel,
                    destinoTipo: p.o_destino_tipo,
                    destinoNome: p.o_destino_nome,
                  },
                  opcoes.urlPainel,
                ),
              );
              if (envio.ok) sucesso = true;
              else erro = sanitizarErroNotificacao(envio.erro);
            } catch (e) {
              erro = sanitizarErroNotificacao(e);
            }
          }
          let gravou = false;
          try {
            const g = await banco.registrar({ pedidoId: p.o_pedido_id, sucesso, erro });
            gravou = !g.erro;
          } catch {
            gravou = false;
          }
          if (!gravou) resumo.semRegistro++;
          else if (sucesso) resumo.enviadas++;
          else resumo.falhas++;
        }
        return { ok: true, resumo };
      } catch {
        return {
          ok: false,
          erro: { codigo: "ERRO_INTERNO", mensagem: "Falha ao processar as notificações." },
        };
      }
    },
  };
}

export type ServicoNotificacoesContato = ReturnType<typeof criarServicoNotificacoesContato>;
