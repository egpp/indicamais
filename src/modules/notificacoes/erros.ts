import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR), neutras. Nunca incluem texto vindo do banco. */
export const MENSAGENS_NOTIFICACOES = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semLogin: "Entre na sua conta para continuar.",
  dadosInvalidos: "Confira os dados informados.",
  avisoNaoEncontrado: "Aviso não encontrado.",
} as const;

export type CodigoErroNotificacoes =
  "VALIDACAO" | "NAO_AUTENTICADO" | "NAO_ENCONTRADO" | "ERRO_INTERNO";

export type ErroNotificacoes = {
  codigo: CodigoErroNotificacoes;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroNotificacoes = (
  codigo: CodigoErroNotificacoes,
  mensagem: string,
  campos?: Record<string, string>,
): ErroNotificacoes => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

const M = MENSAGENS_NOTIFICACOES;

/**
 * SQLSTATE -> erro tipado. 42501 sem login; P0002 aviso inexistente OU de outra conta (a mesma mensagem nos dois
 * casos, para não revelar existência); 22023 parâmetro inválido. O texto do banco NUNCA sai daqui.
 */
export function mapearErroBancoNotificacoes(e: ErroBanco): ErroNotificacoes {
  switch (e.code) {
    case "42501":
      return erroNotificacoes("NAO_AUTENTICADO", M.semLogin);
    case "P0002":
      return erroNotificacoes("NAO_ENCONTRADO", M.avisoNaoEncontrado);
    case "22023":
      return erroNotificacoes("VALIDACAO", M.dadosInvalidos);
  }
  return erroNotificacoes("ERRO_INTERNO", M.generica);
}
