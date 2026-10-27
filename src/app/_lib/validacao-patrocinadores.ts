import {
  alterarPatrocinadorSchema,
  criarPatrocinadorSchema,
  definirPatrocinadorAtivoSchema,
} from "@/modules/administracao";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import {
  lerAlterarPatrocinador,
  lerCriarPatrocinador,
  lerDefinirAtivo,
} from "./entrada-patrocinadores";
import { lerDeRegistro } from "./entrada-conteudo";
import { normalizarErros } from "./resposta";

/**
 * Validação no navegador com os MESMOS schemas do servidor (módulo administracao). Devolve null se válido, ou
 * { campo: mensagem }.
 */
type Dados = Record<string, string>;
type Erros = Record<string, string> | null;

function resultado(
  r: { success: true } | { success: false; error: Parameters<typeof errosPorCampo>[0] },
): Erros {
  return r.success ? null : normalizarErros(errosPorCampo(r.error));
}

export const validarCriarPatrocinador = (d: Dados): Erros =>
  resultado(criarPatrocinadorSchema.safeParse(lerCriarPatrocinador(lerDeRegistro(d))));

export const validarAlterarPatrocinador = (d: Dados): Erros =>
  resultado(alterarPatrocinadorSchema.safeParse(lerAlterarPatrocinador(lerDeRegistro(d))));

export const validarDefinirAtivo = (d: Dados): Erros =>
  resultado(definirPatrocinadorAtivoSchema.safeParse(lerDefinirAtivo(lerDeRegistro(d))));
