import type { ErroBanco } from "./resultado";

/**
 * Classe genérica do erro do Postgres, para cada módulo mapear para a sua mensagem.
 * O texto do banco NUNCA sai daqui: serve só para classificar.
 */
export type ClasseErroBanco =
  | "DUPLICADO" // 23505
  | "CHECK" // 23514
  | "REFERENCIA" // 23503
  | "PERMISSAO" // 42501 / RLS
  | "NAO_ENCONTRADO" // P0002
  | "ESTADO_INVALIDO" // P0001
  | "DADO_INVALIDO" // 22023 e família 22xxx
  | "DESCONHECIDO";

export function classificarErroBanco(e: ErroBanco): ClasseErroBanco {
  switch (e.code) {
    case "23505":
      return "DUPLICADO";
    case "23514":
      return "CHECK";
    case "23503":
      return "REFERENCIA";
    case "42501":
      return "PERMISSAO";
    case "P0002":
      return "NAO_ENCONTRADO";
    case "P0001":
      return "ESTADO_INVALIDO";
    case "22023":
      return "DADO_INVALIDO";
  }
  return "DESCONHECIDO";
}

/** Texto em que procurar nomes de constraint/mensagens de função. Uso interno de classificação. */
export function alvoDoErro(e: ErroBanco): string {
  return `${e.constraint ?? ""} ${e.message ?? ""} ${e.details ?? ""}`;
}
