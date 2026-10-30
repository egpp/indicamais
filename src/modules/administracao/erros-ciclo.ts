import { alvoDoErro } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import { erroAdm, type ErroAdministracao } from "./erros";

/** Mensagens ao usuário (pt-BR) das ações de D-014. Nunca incluem texto vindo do banco. */
export const MENSAGENS_CICLO = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  semPermissao: "Você não tem permissão para esta ação.",
  proprioConteudo: "Você não pode decidir sobre a sua própria conta ou o seu próprio conteúdo.",
  contaProtegida: "Esta conta não pode ser suspensa por esta ação.",
  dadosInvalidos: "Confira os dados informados.",
  motivoObrigatorio: "Informe o motivo.",
  contaNaoEncontrada: "Conta não encontrada.",
  permissaoNaoEncontrada: "Esta permissão não está concedida a essa conta.",
  denunciaNaoEncontrada: "Denúncia não encontrada.",
  indicacaoNaoEncontrada: "Indicação não encontrada.",
  denunciaJaDecidida: "Esta denúncia já foi decidida ou já está em análise.",
  contaNaoSuspensa: "Esta conta não está suspensa.",
  contaEncerrada: "Esta conta já foi encerrada.",
  contaInativa: "Não é possível conceder permissões a esta conta.",
  estadoInvalido: "Esta ação não é possível no estado atual.",
  saldoNegativo:
    "Invalidar esta indicação deixa o saldo de pontos da pessoa negativo. Analise e confirme para seguir.",
  /** Denúncia: a mesma resposta para aceita, repetida, alvo inexistente e robô (IM-076). */
  denunciaRecebida: "Recebemos sua denúncia. Obrigado por avisar.",
  denunciaIndisponivel: "Não foi possível enviar agora. Tente novamente em instantes.",
  denunciaLimite: "Muitas tentativas em pouco tempo. Tente novamente mais tarde.",
  denunciaInvalida: "Confira os dados da denúncia.",
} as const;

export type OperacaoCiclo =
  | "leitura"
  | "permissao"
  | "denunciar"
  | "decidir_denuncia"
  | "suspender"
  | "reativar"
  | "invalidar";

const M = MENSAGENS_CICLO;

/**
 * SQLSTATE -> erro tipado. 42501 sem permissão (ou decidir o próprio); 22023 parâmetro; P0002 inexistente;
 * P0001 estado; P0429 limite; P0410 saldo negativo (invalidação, exige confirmação). O texto do banco só serve
 * para distinguir causas dentro de um mesmo código; nunca sai.
 */
export function mapearErroBancoCiclo(e: ErroBanco, op: OperacaoCiclo): ErroAdministracao {
  const alvo = alvoDoErro(e);
  if (op === "denunciar") {
    // Mensagens neutras: nada que revele se o alvo existe, se já foi denunciado ou o estado da conta.
    if (e.code === "P0429") return erroAdm("LIMITE", M.denunciaLimite);
    if (e.code === "22023") return erroAdm("VALIDACAO", M.denunciaInvalida);
    return erroAdm("ERRO_INTERNO", M.denunciaIndisponivel);
  }
  switch (e.code) {
    case "42501":
      if (/pr[óo]pri|participa/i.test(alvo)) return erroAdm("AUTO_APROVACAO", M.proprioConteudo);
      if (/n[ãa]o pode ser suspensa/i.test(alvo)) return erroAdm("SEM_PERMISSAO", M.contaProtegida);
      return erroAdm("SEM_PERMISSAO", M.semPermissao);
    case "22023":
      return /motivo/i.test(alvo)
        ? erroAdm("MOTIVO_OBRIGATORIO", M.motivoObrigatorio)
        : erroAdm("VALIDACAO", M.dadosInvalidos);
    case "P0002":
      return erroAdm(
        "NAO_ENCONTRADO",
        op === "decidir_denuncia"
          ? M.denunciaNaoEncontrada
          : op === "invalidar"
            ? M.indicacaoNaoEncontrada
            : op === "permissao" && /permiss/i.test(alvo)
              ? M.permissaoNaoEncontrada
              : M.contaNaoEncontrada,
      );
    case "P0001":
      if (op === "decidir_denuncia") return erroAdm("JA_DECIDIDA", M.denunciaJaDecidida);
      if (op === "reativar") return erroAdm("ESTADO_INVALIDO", M.contaNaoSuspensa);
      if (op === "suspender" && /encerrada/i.test(alvo)) {
        return erroAdm("ESTADO_INVALIDO", M.contaEncerrada);
      }
      if (op === "permissao") return erroAdm("ESTADO_INVALIDO", M.contaInativa);
      return erroAdm("ESTADO_INVALIDO", M.estadoInvalido);
    case "P0410":
      return erroAdm("SALDO_NEGATIVO", M.saldoNegativo);
    case "P0429":
      return erroAdm("LIMITE", M.denunciaLimite);
  }
  return erroAdm("ERRO_INTERNO", M.generica);
}
