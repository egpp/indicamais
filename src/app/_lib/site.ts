/**
 * Endereço público do app para URLs absolutas (Open Graph, Twitter). Lê NEXT_PUBLIC_APP_URL. Valor ausente ou
 * inválido => null: as páginas simplesmente não declaram `og:url` nem canonical (fallback seguro: nunca se
 * monta URL com host vindo do pedido, que poderia ser forjado). Só http(s); caminho, query e hash são descartados.
 */
export function origemPublica(): string | null {
  const bruto = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!bruto) return null;
  try {
    const u = new URL(bruto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Caminho do app ("/perfil/x") -> URL absoluta, ou null se NEXT_PUBLIC_APP_URL não estiver configurada. */
export function urlAbsoluta(caminho: string): string | null {
  const origem = origemPublica();
  return origem && caminho.startsWith("/") ? `${origem}${caminho}` : null;
}

/** Variável que liga a indexação pública. Desligada por padrão: abrir ao público é decisão do Emerson (IM-089). */
export const VARIAVEL_INDEXACAO = "PUBLICO_INDEXAVEL";

/** Só o texto "sim" liga. Qualquer outro valor (ausente, "true", "1") mantém noindex. */
export function indexacaoLigada(): boolean {
  return process.env[VARIAVEL_INDEXACAO]?.trim().toLowerCase() === "sim";
}
