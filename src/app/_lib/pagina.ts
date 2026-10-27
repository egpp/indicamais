import { indexacaoLigada } from "./site";
import type { Contexto } from "./contexto";
import type { CategoriaOpcao } from "./apresentacao";
import type { ImagemDoCampo } from "../_componentes/gerenciador-imagens";

/** Auxiliares das páginas (servidor). Só montagem de dados para exibir. */

export const um = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** Categorias ativas para os seletores. Falha vira lista vazia + aviso na tela. */
export async function categoriasParaTela(
  ctx: Contexto,
): Promise<{ categorias: CategoriaOpcao[]; erro: string | null }> {
  const r = await ctx.categorias.listarAtivas();
  return r.ok
    ? { categorias: r.valor.map((c) => ({ id: c.id, nome: c.nome })), erro: null }
    : { categorias: [], erro: r.erro.mensagem };
}

export function caminhosDoPerfil(c: {
  imagemPath: string | null;
  bannersPaths: readonly string[];
  fotosPaths: readonly string[];
}): string[] {
  return [...(c.imagemPath ? [c.imagemPath] : []), ...c.bannersPaths, ...c.fotosPaths];
}

export function imagensDoCampo(
  caminhos: readonly string[],
  urls: Record<string, string>,
): ImagemDoCampo[] {
  return caminhos.map((caminho) => ({ caminho, url: urls[caminho] ?? null }));
}

export const SEM_INDEXACAO = { robots: { index: false, follow: false } } as const;

/**
 * `robots` das páginas públicas. noindex/nofollow até o Emerson decidir abrir ao público (IM-089): só a
 * variável de ambiente PUBLICO_INDEXAVEL=sim libera.
 */
export function robotsPublico() {
  return indexacaoLigada() ? { robots: { index: true, follow: true } } : SEM_INDEXACAO;
}
