/** Estado devolvido pelas Server Actions aos formulários. */
export type EstadoFormulario = {
  /** Sucesso: mensagem a exibir. */
  sucesso?: string;
  /** Erro geral do formulário. */
  erro?: string;
  /** Erros por campo. */
  erros?: Record<string, string>;
  /** Valores a repopular (nunca senhas). */
  valores?: Record<string, string>;
};

export const ESTADO_INICIAL: EstadoFormulario = {};

/** Converte issues do Zod em { campo: mensagem } (primeira mensagem de cada campo). */
export function errosPorCampo(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const i of issues) {
    const campo = String(i.path[0] ?? "_");
    if (!(campo in saida)) saida[campo] = i.message;
  }
  return saida;
}
