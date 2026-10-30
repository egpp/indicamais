/**
 * Origem da denúncia (IM-076, D-014): hash sha256 (hex, 64) de IP + user-agent, calculado SEMPRE no servidor.
 * O IP nunca é guardado nem enviado cru: o banco só recebe o hash, usado para o limite por pessoa. Sem IP
 * (cabeçalho ausente) devolve undefined: melhor sem origem do que juntar todo mundo na mesma origem.
 */
export function ipDoPedido(h: Pick<Headers, "get">): string | null {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const primeiro = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return primeiro ? primeiro : null;
}

export async function origemDaDenuncia(h: Pick<Headers, "get">): Promise<string | undefined> {
  const ip = ipDoPedido(h);
  if (!ip) return undefined;
  const ua = (h.get("user-agent") ?? "").slice(0, 300);
  const bytes = new TextEncoder().encode(`${ip}|${ua}`);
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, "0")).join("");
}
