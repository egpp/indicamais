import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_INDICACOES = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  naoAutenticado: "Entre na sua conta para continuar.",
  semWhatsapp: "Cadastre seu WhatsApp na sua conta antes de indicar.",
  contaSuspensa: "Sua conta está suspensa e não pode gerar links de indicação no momento.",
  autoindicacao: "Você não pode gerar link de indicação para o seu próprio perfil ou anúncio.",
  destinoIndisponivel: "Este perfil ou anúncio não está disponível no momento.",
  linkNaoEncontrado: "Link de indicação não encontrado.",
  pedidoNaoEncontrado: "Pedido de contato não encontrado.",
  parametroNaoEncontrado: "Parâmetro não encontrado.",
  limiteContato: "Muitos pedidos em pouco tempo. Tente novamente mais tarde.",
  limiteCompartilhamento: "Muitos compartilhamentos em pouco tempo. Tente novamente mais tarde.",
  chaveEmOutroDestino:
    "Este envio já foi usado em outro contato. Recarregue a página e tente de novo.",
  dadosInvalidos: "Confira os dados informados.",
  canalInvalido: "Canal de compartilhamento inválido.",
  semPermissao: "Você não tem permissão para esta ação.",
  reenvioIndisponivel: "O reenvio não é possível neste momento.",
  semAlertaAberto: "Não há alerta aberto para este pedido.",
  valorForaDaFaixa: "O valor está fora da faixa permitida para este parâmetro.",
  motivoObrigatorio: "Informe o motivo.",
  linkIndisponivel: "Não foi possível montar o link agora. Tente novamente em instantes.",
} as const;

export type CodigoErroIndicacoes =
  | "VALIDACAO"
  | "NAO_AUTENTICADO"
  | "SEM_WHATSAPP"
  | "CONTA_SUSPENSA"
  | "AUTOINDICACAO"
  | "INDISPONIVEL"
  | "NAO_ENCONTRADO"
  | "LIMITE"
  | "CONFLITO_CHAVE"
  | "PERMISSAO"
  | "ESTADO_INVALIDO"
  | "ERRO_INTERNO";

export type ErroIndicacoes = {
  codigo: CodigoErroIndicacoes;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroIndicacoes = (
  codigo: CodigoErroIndicacoes,
  mensagem: string,
  campos?: Record<string, string>,
): ErroIndicacoes => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

/** Operação em curso: muda a leitura de P0002, 22023, 42501 e P0001. */
export type OperacaoIndicacoes =
  "gerar_link" | "compartilhar" | "contato" | "leitura" | "reenvio" | "alerta" | "parametro";

const M = MENSAGENS_INDICACOES;
const ehAdmin = (op: OperacaoIndicacoes) => op === "alerta" || op === "parametro";

/**
 * SQLSTATE do banco -> erro tipado. O texto do banco (message, details) NUNCA sai daqui.
 * P0412 sem WhatsApp, P0403 autoindicação, P0002 indisponível/não encontrado, P0429 limite,
 * 42501 não autenticado/sem permissão, 22023 inválido, 23505 chave em outro destino.
 */
export function mapearErroBancoIndicacoes(e: ErroBanco, op: OperacaoIndicacoes): ErroIndicacoes {
  switch (e.code) {
    case "P0412":
      return erroIndicacoes("SEM_WHATSAPP", M.semWhatsapp);
    case "P0403":
      return erroIndicacoes("AUTOINDICACAO", M.autoindicacao);
    case "P0429":
      return erroIndicacoes(
        "LIMITE",
        op === "compartilhar" ? M.limiteCompartilhamento : M.limiteContato,
      );
  }
  switch (classificarErroBanco(e)) {
    case "NAO_ENCONTRADO":
      if (op === "gerar_link" || op === "contato") {
        return erroIndicacoes("INDISPONIVEL", M.destinoIndisponivel);
      }
      if (op === "compartilhar") return erroIndicacoes("NAO_ENCONTRADO", M.linkNaoEncontrado);
      if (op === "parametro") return erroIndicacoes("NAO_ENCONTRADO", M.parametroNaoEncontrado);
      return erroIndicacoes("NAO_ENCONTRADO", M.pedidoNaoEncontrado);
    case "PERMISSAO":
      return ehAdmin(op) || op === "reenvio" || op === "leitura"
        ? erroIndicacoes("PERMISSAO", M.semPermissao)
        : erroIndicacoes("NAO_AUTENTICADO", M.naoAutenticado);
    case "DADO_INVALIDO":
      if (op === "compartilhar") return erroIndicacoes("VALIDACAO", M.canalInvalido);
      if (ehAdmin(op) || op === "reenvio") {
        return erroIndicacoes("VALIDACAO", M.motivoObrigatorio);
      }
      return erroIndicacoes("VALIDACAO", M.dadosInvalidos);
    case "DUPLICADO":
      return op === "contato"
        ? erroIndicacoes("CONFLITO_CHAVE", M.chaveEmOutroDestino)
        : erroIndicacoes("ERRO_INTERNO", M.generica);
    case "CHECK":
      return op === "parametro"
        ? erroIndicacoes("VALIDACAO", M.valorForaDaFaixa)
        : erroIndicacoes("ERRO_INTERNO", M.generica);
    case "ESTADO_INVALIDO":
      if (op === "reenvio") return erroIndicacoes("ESTADO_INVALIDO", M.reenvioIndisponivel);
      if (op === "alerta") return erroIndicacoes("ESTADO_INVALIDO", M.semAlertaAberto);
      return erroIndicacoes("ERRO_INTERNO", M.generica);
  }
  return erroIndicacoes("ERRO_INTERNO", M.generica);
}

/**
 * IM-080, D-014: o banco responde P0412 tanto para "sem WhatsApp" quanto para conta suspensa (contas_pode_indicar).
 * Quem tem o estado da conta (contas_meu_estado, módulo contas, lido na camada de interface) passa
 * `acessoPermitido`; com `false`, o erro SEM_WHATSAPP vira CONTA_SUSPENSA, com mensagem própria. Qualquer outro erro,
 * ou estado desconhecido, segue intacto (nunca troca a mensagem sem certeza).
 */
export function refinarErroPorEstadoDaConta(
  erro: ErroIndicacoes,
  estado: { acessoPermitido: boolean | null | undefined },
): ErroIndicacoes {
  if (erro.codigo === "SEM_WHATSAPP" && estado.acessoPermitido === false) {
    return erroIndicacoes("CONTA_SUSPENSA", M.contaSuspensa);
  }
  return erro;
}
