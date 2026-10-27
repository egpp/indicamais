import { z } from "zod";

/** Auxiliares de Zod para formulários de conteúdo. Semântica de patch: undefined = não mexe, null = limpa. */

const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const semControle = (s: string) => !CONTROLE.test(s);

/** Texto opcional: aparado; vazio vira null (limpar o campo). */
export function textoOpcional(max: number, mensagemMax: string) {
  return z
    .preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
      z
        .string({ error: "Texto inválido." })
        .max(max, { error: mensagemMax })
        .refine(semControle, { error: "O texto tem caracteres inválidos." })
        .nullable(),
    )
    .optional();
}

export const uuidSchema = z.uuid({ error: "Identificador inválido." });

/** Primeira mensagem por campo, para mostrar no formulário. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const i of erro.issues) {
    const chave = i.path.length > 0 ? i.path.join(".") : "_";
    if (!(chave in campos)) campos[chave] = i.message;
  }
  return campos;
}
