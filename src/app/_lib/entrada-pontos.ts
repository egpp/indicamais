import type { Ler } from "./entrada-conteudo";

/**
 * Leitura dos formulários de pontos e benefícios para o formato dos schemas do módulo. Só transforma texto
 * digitado em entrada; quem valida e decide é o módulo (no servidor e, com o mesmo schema, no navegador).
 */

/** Texto ilegível vira NaN: o schema do módulo responde com a mensagem do campo. */
const inteiro = (s: string): number => (s.trim() === "" ? Number.NaN : Number(s.trim()));
/** Vazio = sem limite (null). */
const inteiroOuNulo = (s: string): number | null => (s.trim() === "" ? null : Number(s.trim()));

export const CAMPOS_BENEFICIO = [
  "nome",
  "descricao",
  "pontosNecessarios",
  "condicoes",
  "limiteTotal",
  "limitePorPessoa",
  "prazoResgateAte",
  "prazoUsoDias",
] as const;

export function lerCamposBeneficio(ler: Ler) {
  return {
    nome: ler("nome"),
    descricao: ler("descricao"),
    pontosNecessarios: inteiro(ler("pontosNecessarios")),
    condicoes: ler("condicoes"),
    limiteTotal: inteiroOuNulo(ler("limiteTotal")),
    limitePorPessoa: inteiroOuNulo(ler("limitePorPessoa")),
    prazoResgateAte: ler("prazoResgateAte"),
    prazoUsoDias: inteiroOuNulo(ler("prazoUsoDias")),
  };
}

export const lerReversao = (ler: Ler) => ({
  lancamentoId: ler("lancamentoId"),
  categoria: ler("categoria"),
  observacao: ler("observacao"),
  confirmarSaldoNegativo: ler("confirmarSaldoNegativo") === "sim",
});

export const lerReprocessar = (ler: Ler) => ({ pedidoId: ler("pedidoId"), motivo: ler("motivo") });

export const lerParametroPontos = (ler: Ler) => ({
  chave: ler("chave"),
  valor: inteiro(ler("valor")),
  motivo: ler("motivo"),
});

export const lerDecisao = (ler: Ler) => ({
  versaoId: ler("versaoId"),
  aprovar: ler("decisao") === "aprovar",
  motivo: ler("motivo"),
});

export const lerResposta = (ler: Ler) => ({
  versaoId: ler("versaoId"),
  aceitar: ler("resposta") === "aceitar",
  motivo: ler("motivo"),
});
