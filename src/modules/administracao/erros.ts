import { alvoDoErro, classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_ADMINISTRACAO = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semPermissao: "Esta ação é restrita a administradores.",
  autoAprovacao:
    "Você não pode decidir sobre o seu próprio conteúdo. Peça para outro administrador revisar.",
  motivoObrigatorio: "Informe o motivo da rejeição.",
  naoEncontrado: "Este item não está mais na fila de revisão.",
  jaDecidida: "Este conteúdo já foi decidido ou não está mais aguardando revisão.",
  dadosInvalidos: "Confira os dados informados.",
} as const;

export type CodigoErroAdministracao =
  | "VALIDACAO"
  | "MOTIVO_OBRIGATORIO"
  | "AUTO_APROVACAO"
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADO"
  | "JA_DECIDIDA"
  | "ERRO_INTERNO";

export type ErroAdministracao = {
  codigo: CodigoErroAdministracao;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroAdm = (
  codigo: CodigoErroAdministracao,
  mensagem: string,
  campos?: Record<string, string>,
): ErroAdministracao => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

/**
 * 42501 vem de duas situações: "não é administrador" e "o responsável não decide o próprio conteúdo".
 * A mensagem do banco só serve para distinguir; o texto devolvido é sempre o nosso.
 */
export function mapearErroBancoAdministracao(e: ErroBanco): ErroAdministracao {
  const classe = classificarErroBanco(e);
  const M = MENSAGENS_ADMINISTRACAO;
  switch (classe) {
    case "PERMISSAO":
      return /pr[óo]prio/i.test(alvoDoErro(e))
        ? erroAdm("AUTO_APROVACAO", M.autoAprovacao)
        : erroAdm("SEM_PERMISSAO", M.semPermissao);
    case "DADO_INVALIDO":
      return erroAdm("MOTIVO_OBRIGATORIO", M.motivoObrigatorio);
    case "NAO_ENCONTRADO":
      return erroAdm("NAO_ENCONTRADO", M.naoEncontrado);
    case "ESTADO_INVALIDO":
      return erroAdm("JA_DECIDIDA", M.jaDecidida);
    case "CHECK":
      // perfis_revisao_motivo / catalogo_item_revisao_motivo: rejeição sem motivo.
      return /motivo/i.test(alvoDoErro(e))
        ? erroAdm("MOTIVO_OBRIGATORIO", M.motivoObrigatorio)
        : erroAdm("VALIDACAO", M.dadosInvalidos);
    case "DUPLICADO":
      // perfis_revisao_versao_unica: já existe decisão para esta versão.
      return erroAdm("JA_DECIDIDA", M.jaDecidida);
    default:
      return erroAdm("ERRO_INTERNO", M.generica);
  }
}
