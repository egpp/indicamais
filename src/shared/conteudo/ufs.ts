import { z } from "zod";

/** Lista oficial de UFs (D-006) e schema de UF compartilhado por perfis, catálogo e busca. */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const; // prettier-ignore

/** UF aparada e em maiúsculas; vazio vira null; fora da lista é recusada. */
export const ufSchema = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toUpperCase()) : v),
  z.enum(UFS, { error: "Escolha uma UF válida." }).nullable(),
);
