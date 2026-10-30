import {
  adminCadastrarBeneficioSchema,
  criarBeneficioSchema,
  decidirBeneficioSchema,
  definirParametroSchema,
  editarPropostaBeneficioSchema,
  reprocessarPedidoSchema,
  responderPropostaSchema,
  reverterCreditoSchema,
  salvarBeneficioSchema,
} from "@/modules/pontos";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type { z } from "zod";
import { lerDeRegistro } from "./entrada-conteudo";
import {
  CAMPOS_BENEFICIO,
  lerCamposBeneficio,
  lerDecisao,
  lerParametroPontos,
  lerReprocessar,
  lerResposta,
  lerReversao,
} from "./entrada-pontos";

/**
 * Validação no navegador com os MESMOS schemas do servidor (módulo pontos). Devolve null se válido, ou
 * { campo: mensagem } só dos campos visíveis do formulário; o resto o servidor trata.
 */
export const CAMPOS_VISIVEIS_PONTOS = [
  ...CAMPOS_BENEFICIO,
  "perfilId",
  "motivo",
  "observacao",
  "categoria",
  "valor",
] as const;

function validar(
  schema: z.ZodType,
  entrada: unknown,
  visiveis: readonly string[] = CAMPOS_VISIVEIS_PONTOS,
): Record<string, string> | null {
  const r = schema.safeParse(entrada);
  if (r.success) return null;
  const erros = Object.fromEntries(
    Object.entries(errosPorCampo(r.error)).filter(([k]) => visiveis.includes(k)),
  );
  return Object.keys(erros).length > 0 ? erros : null;
}

type Dados = Record<string, string>;

export const validarReversao = (d: Dados) =>
  validar(reverterCreditoSchema, lerReversao(lerDeRegistro(d)));
export const validarReprocessar = (d: Dados) =>
  validar(reprocessarPedidoSchema, lerReprocessar(lerDeRegistro(d)));
export const validarParametroPontos = (d: Dados) =>
  validar(definirParametroSchema, lerParametroPontos(lerDeRegistro(d)));
export const validarDecisao = (d: Dados) =>
  validar(decidirBeneficioSchema, lerDecisao(lerDeRegistro(d)));
export const validarResposta = (d: Dados) =>
  validar(responderPropostaSchema, lerResposta(lerDeRegistro(d)));

export type ModoBeneficio = "criar" | "salvar" | "admin-cadastrar" | "admin-editar";

export function validarBeneficio(modo: ModoBeneficio, d: Dados) {
  const ler = lerDeRegistro(d);
  const base = lerCamposBeneficio(ler);
  switch (modo) {
    case "criar":
      return validar(criarBeneficioSchema, { perfilId: ler("perfilId"), ...base });
    case "salvar":
      return validar(salvarBeneficioSchema, { beneficioId: ler("beneficioId"), ...base });
    case "admin-cadastrar":
      return validar(adminCadastrarBeneficioSchema, {
        perfilId: ler("perfilId"),
        motivo: ler("motivo"),
        ...base,
      });
    case "admin-editar":
      return validar(editarPropostaBeneficioSchema, {
        versaoId: ler("versaoId"),
        motivo: ler("motivo"),
        ...base,
      });
  }
}
