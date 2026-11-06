/**
 * Ambiente de execução (RSA-05, RSA-07, D-033). "Produção" aqui é tudo que roda como build de produção do Next
 * (inclui o Worker publicado de DESENVOLVIMENTO, `indicamais-dev`) ou com APP_ENV=production. Só `pnpm dev` e os
 * testes são "não produção". Controles de segurança que dependem de segredo (Turnstile, hash de origem) falham
 * FECHADO em produção quando o segredo falta e só são dispensados fora dela.
 */
export function emProducao(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" || env.APP_ENV?.trim().toLowerCase() === "production";
}
