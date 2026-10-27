import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";

/** Preço de item (IM-014): fixo, a partir de ou sob consulta; centavos de BRL; opcional. */

export const MODOS_PRECO = ["fixo", "a_partir_de", "sob_consulta"] as const;
export type ModoPreco = (typeof MODOS_PRECO)[number];

export type Preco =
  { modo: "fixo" | "a_partir_de"; centavos: number } | { modo: "sob_consulta"; centavos: null };

const MSG_VALOR = `Informe um valor entre R$ 0,01 e ${formatarCentavos(LIMITES.preco.maxCentavos)}.`;

const centavosSchema = z
  .number({ error: MSG_VALOR })
  .int({ error: MSG_VALOR })
  .min(LIMITES.preco.minCentavos, { error: MSG_VALOR })
  .max(LIMITES.preco.maxCentavos, { error: MSG_VALOR });

/**
 * Entrada do preço. Sem preço = `undefined`/`null` no campo (opcional).
 * "fixo" e "a_partir_de" exigem valor; "sob_consulta" não aceita valor.
 */
export const precoSchema = z.discriminatedUnion(
  "modo",
  [
    z.object({ modo: z.literal("fixo"), centavos: centavosSchema }),
    z.object({ modo: z.literal("a_partir_de"), centavos: centavosSchema }),
    z.object({
      modo: z.literal("sob_consulta"),
      centavos: z
        .null({ error: "Preço sob consulta não leva valor." })
        .optional()
        .transform(() => null),
    }),
  ],
  { error: "Escolha como o preço será exibido." },
);

/** Formata centavos como "R$ 1.234,50" (separador de milhar ponto, decimal vírgula, NBSP após R$). */
export function formatarCentavos(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0)
    throw new Error("valor em centavos inválido");
  const reais = Math.floor(centavos / 100);
  const cents = String(centavos % 100).padStart(2, "0");
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$\u00a0${milhar},${cents}`;
}

/** Texto de exibição; `null` quando o item não tem preço. */
export function formatarPreco(preco: Preco | null | undefined): string | null {
  if (!preco) return null;
  if (preco.modo === "sob_consulta") return "Sob consulta";
  if (preco.centavos === null) return null;
  const v = formatarCentavos(preco.centavos);
  return preco.modo === "a_partir_de" ? `A partir de ${v}` : v;
}

/**
 * Converte o texto digitado pelo usuário ("12,50", "R$ 1.234,5", "10") em centavos.
 * Recusa zero, negativo, mais de 2 casas, letras e valores acima do teto. Sem arredondar em silêncio.
 */
export function parsearReaisParaCentavos(texto: string): number | null {
  const t = (texto ?? "").replace(/^\s*R\$\s*/i, "").trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const [inteiro, frac = ""] = t.replace(/\./g, "").split(",");
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) return null;
  if (centavos < LIMITES.preco.minCentavos || centavos > LIMITES.preco.maxCentavos) return null;
  return centavos;
}

/** Preço a partir das colunas do banco. Combinação incoerente vira "sem preço". */
export function precoDeColunas(
  modo: string | null,
  centavos: number | string | null,
): Preco | null {
  if (modo === "sob_consulta") return { modo, centavos: null };
  if (modo === "fixo" || modo === "a_partir_de") {
    const n = typeof centavos === "string" ? Number(centavos) : centavos;
    if (n !== null && Number.isSafeInteger(n) && n >= LIMITES.preco.minCentavos) {
      return { modo, centavos: n };
    }
  }
  return null;
}

export function precoParaColunas(preco: Preco | null): {
  preco_modo: ModoPreco | null;
  preco_centavos: number | null;
} {
  if (!preco) return { preco_modo: null, preco_centavos: null };
  return { preco_modo: preco.modo, preco_centavos: preco.centavos };
}
