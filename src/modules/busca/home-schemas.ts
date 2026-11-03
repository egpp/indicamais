import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { UFS } from "@/shared/conteudo/ufs";
import { semControle } from "@/shared/conteudo/zod-util";

/** Seções em carrossel da página inicial (IM-095, D-018). A lista de critérios é fixa; título e ordem são editáveis (IM-096). */
export const CHAVES_SECAO_HOME = [
  "novidades",
  "mais_curtidos",
  "mais_indicados",
  "na_sua_cidade",
  "em_alta_semana",
] as const;
export type ChaveSecaoHome = (typeof CHAVES_SECAO_HOME)[number];

/** Localização de uma seção: cidade e UF, sempre juntas. */
export type LocalizacaoHome = { cidade: string; uf: string };

const cidadeSchema = z
  .string()
  .trim()
  .min(1)
  .max(LIMITES.busca.cidadeMax)
  .refine(semControle);
const ufSchema = z.enum(UFS);

/**
 * Valida cidade e UF ANTES de qualquer chamada ao banco: UF mal formada faz as funções do banco falharem com 22023 para
 * todas as seções. Devolve a localização normalizada (cidade aparada, UF em maiúsculas) ou null quando faltar uma das
 * duas, ou qualquer uma for inválida. Localização inválida nunca derruba a página: as seções que não dependem dela seguem.
 */
export function validarLocalizacaoHome(entrada: unknown): LocalizacaoHome | null {
  if (typeof entrada !== "object" || entrada === null) return null;
  const e = entrada as { cidade?: unknown; uf?: unknown };
  if (typeof e.cidade !== "string" || typeof e.uf !== "string") return null;
  const cidade = cidadeSchema.safeParse(e.cidade.replace(/\s+/g, " "));
  const uf = ufSchema.safeParse(e.uf.trim().toUpperCase());
  if (!cidade.success || !uf.success) return null;
  return { cidade: cidade.data, uf: uf.data };
}

/** Chave de cache por localização: sem acento nem caixa, para "São Paulo" e "sao paulo" dividirem a mesma entrada. */
export function chaveCacheHome(loc: LocalizacaoHome | null): string {
  if (!loc) return "sem-cidade";
  const cidade = loc.cidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${loc.uf}|${cidade}`;
}
