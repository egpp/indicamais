import { definirLiberacaoLojaSchema } from "@/modules/administracao";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import { normalizarErros } from "./resposta";

/**
 * Liberação da Loja (IM-097, IM-099): valida no navegador com o MESMO schema do servidor. Devolve null se válido,
 * ou { campo: mensagem }.
 */
export function validarLiberacaoLoja(d: Record<string, string>): Record<string, string> | null {
  const r = definirLiberacaoLojaSchema.safeParse({
    perfilId: d.perfilId ?? "",
    liberada: d.liberada ?? "",
    motivo: d.motivo ?? "",
  });
  return r.success ? null : normalizarErros(errosPorCampo(r.error));
}
