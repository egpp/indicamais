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
  patrocinadorNaoEncontrado: "Patrocinador não encontrado.",
  patrocinadorInvalido: "Confira os dados do patrocinador.",
  perfilDestinoInvalido: "Perfil de destino não encontrado. Escolha um perfil existente.",
} as const;

export type CodigoErroAdministracao =
  | "VALIDACAO"
  | "MOTIVO_OBRIGATORIO"
  | "AUTO_APROVACAO"
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADO"
  | "JA_DECIDIDA"
  | "ESTADO_INVALIDO"
  | "LIMITE"
  | "SALDO_NEGATIVO"
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

/**
 * Erros das funções de patrocinador (IM-020). Reaproveita o mapa geral e acrescenta: perfil de destino
 * inexistente (23503), patrocinador inexistente (P0002) e CHECK de dados (23514). Texto do banco nunca sai.
 */
export function mapearErroBancoPatrocinador(e: ErroBanco): ErroAdministracao {
  const classe = classificarErroBanco(e);
  const M = MENSAGENS_ADMINISTRACAO;
  switch (classe) {
    case "REFERENCIA":
      return erroAdm("VALIDACAO", M.perfilDestinoInvalido, {
        perfilDestinoId: M.perfilDestinoInvalido,
      });
    case "NAO_ENCONTRADO":
      return erroAdm("NAO_ENCONTRADO", M.patrocinadorNaoEncontrado);
    case "CHECK":
      return /motivo/i.test(alvoDoErro(e))
        ? erroAdm("MOTIVO_OBRIGATORIO", M.motivoObrigatorio)
        : erroAdm("VALIDACAO", M.patrocinadorInvalido);
    case "DADO_INVALIDO":
      return erroAdm("MOTIVO_OBRIGATORIO", "Informe o motivo da alteração.");
    case "DUPLICADO":
      return erroAdm("VALIDACAO", M.patrocinadorInvalido);
    default:
      return mapearErroBancoAdministracao(e);
  }
}
