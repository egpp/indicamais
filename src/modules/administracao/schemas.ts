import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { uuidSchema } from "@/shared/conteudo/zod-util";

export const ALVOS_REVISAO = ["perfil", "item"] as const;
export type AlvoRevisao = (typeof ALVOS_REVISAO)[number];

const alvo = z.enum(ALVOS_REVISAO, { error: "Tipo de conteúdo inválido." });

const motivoRejeicao = z
  .string({ error: "Informe o motivo da rejeição." })
  .trim()
  .min(1, { error: "Informe o motivo da rejeição." })
  .max(LIMITES.revisao.motivoMax, {
    error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
  });

/** Aprovar (nota opcional) ou rejeitar (motivo OBRIGATÓRIO, IM-023). */
export const decidirRevisaoSchema = z.discriminatedUnion(
  "aprovar",
  [
    z.object({
      aprovar: z.literal(true),
      alvo,
      versaoId: uuidSchema,
      motivo: z
        .string()
        .trim()
        .max(LIMITES.revisao.motivoMax, {
          error: `A observação deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
        })
        .optional(),
    }),
    z.object({
      aprovar: z.literal(false),
      alvo,
      versaoId: uuidSchema,
      motivo: motivoRejeicao,
    }),
  ],
  { error: "Informe se aprova ou rejeita." },
);
export type DecidirRevisao = z.infer<typeof decidirRevisaoSchema>;
