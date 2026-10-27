/** Geração de slug: minúsculas, sem acentos, a-z0-9 e hífen. Função pura. */

export function slugificar(texto: string, max = 60): string {
  const base = (texto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, max).replace(/-+$/g, "");
}

export const SLUG_FORMATO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Acrescenta sufixo numérico respeitando o tamanho máximo ("loja", 2 -> "loja-2"). */
export function slugComSufixo(slug: string, n: number, max = 60): string {
  const sufixo = `-${n}`;
  return `${slug.slice(0, max - sufixo.length).replace(/-+$/g, "")}${sufixo}`;
}
