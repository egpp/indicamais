/** Aceita só caminho interno (evita redirecionamento aberto). */
export function caminhoSeguro(valor: unknown, padrao = "/minha-conta"): string {
  if (typeof valor !== "string") return padrao;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return padrao;
  if (/[\u0000-\u001f]/.test(valor)) return padrao;
  return valor;
}
