import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_PONTOS = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semPermissao: "Você não tem permissão para esta ação.",
  dadosInvalidos: "Confira os dados informados.",
  motivoObrigatorio: "Informe o motivo.",
  valorForaDaFaixa: "O valor está fora da faixa permitida para este parâmetro.",
  parametroNaoEncontrado: "Parâmetro não encontrado.",
  lancamentoNaoEncontrado: "Lançamento de pontos não encontrado.",
  soCreditoPodeSerRevertido: "Só um crédito de pontos pode ser revertido.",
  jaRevertido: "Este crédito já foi revertido.",
  saldoNegativo:
    "Reverter este crédito deixaria o saldo do indicador negativo. Analise o caso e confirme para continuar.",
  pedidoNaoEncontrado: "Pedido de contato não encontrado.",
  beneficioNaoEncontrado: "Benefício não encontrado ou perfil indisponível.",
  beneficioForaDasRegras: "Os dados do benefício estão fora das regras. Confira os campos.",
  beneficioEstadoInvalido: "Esta ação não é possível no estado atual do benefício.",
  semVersaoAprovada: "Só um benefício aprovado pode ser ativado.",
} as const;

export type CodigoErroPontos =
  | "VALIDACAO"
  | "PERMISSAO"
  | "NAO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "JA_REVERTIDO"
  | "SALDO_NEGATIVO"
  | "ERRO_INTERNO";

export type ErroPontos = {
  codigo: CodigoErroPontos;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroPontos = (
  codigo: CodigoErroPontos,
  mensagem: string,
  campos?: Record<string, string>,
): ErroPontos => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

/** Operação em curso: muda a leitura de P0002, P0001, 22023 e 23514. */
export type OperacaoPontos =
  | "leitura"
  | "parametro"
  | "reversao"
  | "reprocessar"
  | "beneficio"
  | "beneficio_admin"
  | "beneficio_ativar";

const M = MENSAGENS_PONTOS;

/**
 * SQLSTATE do banco -> erro tipado. O texto do banco (message, details) NUNCA sai daqui.
 * P0409 crédito já revertido; P0410 reversão deixaria saldo negativo (exige confirmação);
 * 42501 não autenticado/sem permissão; 22023 motivo/valor inválido; 23514 campo fora das regras;
 * P0002 inexistente/indisponível; P0001 estado inválido.
 */
export function mapearErroBancoPontos(e: ErroBanco, op: OperacaoPontos): ErroPontos {
  if (e.code === "P0409") return erroPontos("JA_REVERTIDO", M.jaRevertido);
  if (e.code === "P0410") return erroPontos("SALDO_NEGATIVO", M.saldoNegativo);
  switch (classificarErroBanco(e)) {
    case "PERMISSAO":
      return erroPontos("PERMISSAO", M.semPermissao);
    case "DADO_INVALIDO":
      if (op === "parametro") return erroPontos("VALIDACAO", M.valorForaDaFaixa);
      if (op === "leitura") return erroPontos("VALIDACAO", M.dadosInvalidos);
      return erroPontos("VALIDACAO", M.motivoObrigatorio);
    case "CHECK":
      return op === "beneficio" || op === "beneficio_admin"
        ? erroPontos("VALIDACAO", M.beneficioForaDasRegras)
        : erroPontos("ERRO_INTERNO", M.generica);
    case "NAO_ENCONTRADO":
      if (op === "parametro") return erroPontos("NAO_ENCONTRADO", M.parametroNaoEncontrado);
      if (op === "reversao") return erroPontos("NAO_ENCONTRADO", M.lancamentoNaoEncontrado);
      if (op === "reprocessar") return erroPontos("NAO_ENCONTRADO", M.pedidoNaoEncontrado);
      if (op === "leitura") return erroPontos("NAO_ENCONTRADO", M.generica);
      return erroPontos("NAO_ENCONTRADO", M.beneficioNaoEncontrado);
    case "ESTADO_INVALIDO":
      if (op === "reversao") return erroPontos("ESTADO_INVALIDO", M.soCreditoPodeSerRevertido);
      if (op === "beneficio_ativar") return erroPontos("ESTADO_INVALIDO", M.semVersaoAprovada);
      if (op === "beneficio" || op === "beneficio_admin") {
        return erroPontos("ESTADO_INVALIDO", M.beneficioEstadoInvalido);
      }
      return erroPontos("ERRO_INTERNO", M.generica);
  }
  return erroPontos("ERRO_INTERNO", M.generica);
}
