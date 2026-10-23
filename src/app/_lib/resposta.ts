import type { EstadoFormulario } from "./estado-formulario";

/** Resposta dos tratadores: estado do formulário + destino opcional (a Server Action faz o redirect). */
export type Resposta = EstadoFormulario & { destino?: string };

type ErroDeModulo = { mensagem: string; campos?: Record<string, string>; pendencias?: string[] };

/** "categoriasSecundariasIds.0" -> "categoriasSecundariasIds"; "preco.centavos" -> "precoValor". */
export function chaveDoCampo(chave: string): string {
  if (chave === "preco.centavos") return "precoValor";
  if (chave === "preco") return "precoModo";
  return chave.split(".")[0] ?? chave;
}

export function normalizarErros(campos: Record<string, string>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    const c = chaveDoCampo(k);
    if (!(c in saida)) saida[c] = v;
  }
  return saida;
}

/**
 * Erro de módulo -> estado de formulário. A mensagem já vem do módulo (nunca texto de banco).
 * Com erros por campo, eles aparecem junto de cada campo; sem eles, vira aviso geral.
 */
export function deErro(
  erro: ErroDeModulo,
  valores?: Record<string, string>,
  geral?: string,
): Resposta {
  const erros = erro.campos ? normalizarErros(erro.campos) : {};
  if (Object.keys(erros).length > 0) {
    return { erros, valores, ...(geral ? { erro: geral } : {}) };
  }
  const pend = erro.pendencias?.length ? ` ${erro.pendencias.join(" ")}` : "";
  return { erro: `${erro.mensagem}${pend}`, valores };
}

export function valoresDe(f: FormData, nomes: readonly string[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const n of nomes) {
    const x = f.get(n);
    if (typeof x === "string") v[n] = x;
  }
  return v;
}
