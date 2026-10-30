import { z } from "zod";

export const ORIGENS_AVISO = ["contato_valido", "indicacao_valida", "curtida", "revisao"] as const;
export type OrigemAviso = (typeof ORIGENS_AVISO)[number];

/**
 * Chave de um aviso (IM-052). `origemId` usa guid (qualquer UUID em hexadecimal): o aviso de curtida tem id
 * determinístico gerado por md5, que não respeita os bits de versão do RFC 4122.
 */
export const marcarLidaSchema = z.object({
  origem: z.enum(ORIGENS_AVISO, { error: "Aviso inválido." }),
  origemId: z.guid({ error: "Aviso inválido." }),
});
