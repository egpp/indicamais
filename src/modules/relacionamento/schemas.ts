import { z } from "zod";
import { uuidSchema } from "@/shared/conteudo/zod-util";

/** Entrada externa das ações da pessoa sobre a base de um perfil (IM-043, IM-045). */
export const perfilIdSchema = z.object({ perfilId: uuidSchema });
