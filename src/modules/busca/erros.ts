import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_BUSCA = {
  generica: "Não foi possível buscar agora. Tente novamente em instantes.",
  filtrosInvalidos: "Confira os filtros da busca.",
} as const;

export type CodigoErroBusca = "VALIDACAO" | "ERRO_INTERNO";

export type ErroBusca = {
  codigo: CodigoErroBusca;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroBusca = (
  codigo: CodigoErroBusca,
  mensagem: string,
  campos?: Record<string, string>,
): ErroBusca => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

/**
 * 22023 (tipo ou UF inválidos, vindos de busca_publica) vira "filtros inválidos"; qualquer outro erro do
 * banco vira a mensagem genérica. O texto do banco nunca sai.
 */
export function mapearErroBancoBusca(e: ErroBanco): ErroBusca {
  return classificarErroBanco(e) === "DADO_INVALIDO"
    ? erroBusca("VALIDACAO", MENSAGENS_BUSCA.filtrosInvalidos)
    : erroBusca("ERRO_INTERNO", MENSAGENS_BUSCA.generica);
}
