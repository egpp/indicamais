import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR), neutras. Nunca incluem texto vindo do banco. */
export const MENSAGENS_RELACIONAMENTO = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semLogin: "Entre na sua conta para continuar.",
  dadosInvalidos: "Confira os dados informados.",
  perfilIndisponivel: "Este perfil não está disponível no momento.",
  proprioPerfil: "Você não pode curtir o seu próprio perfil.",
  limite: "Muitas alterações em pouco tempo. Tente novamente mais tarde.",
} as const;

export type CodigoErroRelacionamento =
  "VALIDACAO" | "NAO_AUTENTICADO" | "INDISPONIVEL" | "PROPRIO_PERFIL" | "LIMITE" | "ERRO_INTERNO";

export type ErroRelacionamento = {
  codigo: CodigoErroRelacionamento;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroRelacionamento = (
  codigo: CodigoErroRelacionamento,
  mensagem: string,
  campos?: Record<string, string>,
): ErroRelacionamento => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

const M = MENSAGENS_RELACIONAMENTO;

/**
 * SQLSTATE -> erro tipado. 42501 sem login; P0002 perfil inexistente/indisponível; P0403 próprio perfil;
 * P0429 limite de alternância (D-013); 22023 parâmetro inválido. O texto do banco NUNCA sai daqui.
 */
export function mapearErroBancoRelacionamento(e: ErroBanco): ErroRelacionamento {
  switch (e.code) {
    case "42501":
      return erroRelacionamento("NAO_AUTENTICADO", M.semLogin);
    case "P0002":
      return erroRelacionamento("INDISPONIVEL", M.perfilIndisponivel);
    case "P0403":
      return erroRelacionamento("PROPRIO_PERFIL", M.proprioPerfil);
    case "P0429":
      return erroRelacionamento("LIMITE", M.limite);
    case "22023":
      return erroRelacionamento("VALIDACAO", M.dadosInvalidos);
  }
  return erroRelacionamento("ERRO_INTERNO", M.generica);
}
