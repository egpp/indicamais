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

/** Chaves dos tetos de criação por conta (D-035). Fixas: o texto do banco nunca vira mensagem. */
export const CHAVES_TETO_CRIACAO = [
  "tetos_perfis_por_conta",
  "tetos_itens_por_perfil",
  "tetos_anuncios_particulares",
  "tetos_rascunhos_abertos",
] as const;
export type ChaveTetoCriacao = (typeof CHAVES_TETO_CRIACAO)[number];

export type TetoAtingido = { chave: ChaveTetoCriacao; limite: number | null };

/**
 * Teto de criação por conta atingido (D-035): SQLSTATE P0430, message `teto_atingido:<chave>`, detail
 * `limite=<valor>`. Só chave conhecida vale; chave desconhecida devolve null (cai no erro genérico). O limite só é
 * aceito se for inteiro positivo; senão vem null e a mensagem sai sem número.
 */
export function lerTetoAtingido(e: ErroBanco): TetoAtingido | null {
  if (e.code !== "P0430") return null;
  const chave = /^\s*teto_atingido:([a-z_]+)\s*$/.exec(e.message ?? "")?.[1];
  const conhecida = CHAVES_TETO_CRIACAO.find((c) => c === chave);
  if (!conhecida) return null;
  const n = /^\s*limite=(\d{1,6})\s*$/.exec(e.details ?? "")?.[1];
  const limite = n ? Number(n) : null;
  return { chave: conhecida, limite: limite !== null && limite > 0 ? limite : null };
}
