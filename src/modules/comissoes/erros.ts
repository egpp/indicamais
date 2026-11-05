import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR), neutras. Nunca incluem texto vindo do banco. */
export const MENSAGENS_COMISSOES = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semPermissao: "Você não tem permissão para esta ação.",
  dadosInvalidos: "Confira os dados informados.",
  naoEncontrado: "Registro não encontrado.",
  regraNegocio: "Esta ação não é permitida na situação atual.",
  assinaturaCanceladaAntes:
    "Esta assinatura foi cancelada antes deste mês. Só é possível confirmar meses até o cancelamento.",
  jaRegistrado: "Este registro já existe ou já foi processado.",
  confirmacaoNecessaria:
    "A comissão já foi paga. Confirme que deseja prosseguir para registrar a reversão.",
} as const;

export type CodigoErroComissoes =
  | "VALIDACAO"
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADO"
  | "REGRA_NEGOCIO"
  | "CONFLITO"
  | "CONFIRMACAO_NECESSARIA"
  | "ERRO_INTERNO";

export type ErroComissoes = {
  codigo: CodigoErroComissoes;
  mensagem: string;
  campos?: Record<string, string>;
};

export const erroComissoes = (
  codigo: CodigoErroComissoes,
  mensagem: string,
  campos?: Record<string, string>,
): ErroComissoes => (campos ? { codigo, mensagem, campos } : { codigo, mensagem });

const M = MENSAGENS_COMISSOES;

/**
 * SQLSTATE -> erro de domínio. 42501 sem permissão (não admin / não responsável); 22023 parâmetro inválido;
 * P0002 não encontrado; P0001 regra de negócio (módulo desabilitado, conta inelegível, prazo não vencido);
 * P0409 conflito/duplicidade (idempotência de outra ação); P0410 comissão já paga exige confirmação (IM-073).
 * O texto do banco NUNCA sai daqui.
 */
export function mapearErroBancoComissoes(e: ErroBanco): ErroComissoes {
  switch (e.code) {
    case "42501":
      return erroComissoes("SEM_PERMISSAO", M.semPermissao);
    case "22023":
      return erroComissoes("VALIDACAO", M.dadosInvalidos);
    case "P0002":
      return erroComissoes("NAO_ENCONTRADO", M.naoEncontrado);
    case "P0001":
      if (/cancelada antes desta compet/i.test(e.message ?? ""))
        return erroComissoes("REGRA_NEGOCIO", M.assinaturaCanceladaAntes);
      return erroComissoes("REGRA_NEGOCIO", M.regraNegocio);
    case "P0409":
      return erroComissoes("CONFLITO", M.jaRegistrado);
    case "P0410":
      return erroComissoes("CONFIRMACAO_NECESSARIA", M.confirmacaoNecessaria);
  }
  return erroComissoes("ERRO_INTERNO", M.generica);
}
