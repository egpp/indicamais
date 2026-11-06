import { headers } from "next/headers";

/**
 * Endereço público do app, para links de e-mail e OAuth. Prefere NEXT_PUBLIC_APP_URL.
 * Em produção (NODE_ENV=production) a variável é obrigatória: sem ela a função falha e NUNCA usa cabeçalhos do
 * pedido (x-forwarded-host/host podem ser forjados e envenenariam o link de recuperação; RSA-08).
 * Fora de produção (next dev), sem a variável, usa o host do pedido para facilitar o trabalho local.
 */
export async function origemDoApp(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL não configurada: obrigatória em produção.");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
