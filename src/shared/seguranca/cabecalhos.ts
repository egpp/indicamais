/**
 * Cabeçalhos de segurança HTTP (IM-086, RSA-01). Fonte única usada por `next.config.ts` (páginas e rotas, que
 * passam pelo Worker) e espelhada em `public/_headers` (arquivos estáticos, que o Cloudflare serve sem passar
 * pelo Worker). Não define Cache-Control: o cache continua com o Next e com `public/_headers`.
 *
 * CSP em duas partes:
 * - ENFORCED (`Content-Security-Policy`): só diretivas que não dependem de testar cada tela
 *   (frame-ancestors, base-uri, object-src). Já bloqueia clickjacking.
 * - REPORT-ONLY (`Content-Security-Policy-Report-Only`): a política completa. Não bloqueia nada; viola-se
 *   apenas no console do navegador. Depois de percorrer as telas no ambiente de desenvolvimento sem violação,
 *   promover a política completa para `Content-Security-Policy`.
 *
 * `script-src 'unsafe-inline'`: o Next injeta scripts inline de hidratação; nonce exigiria renderização
 * dinâmica de todas as páginas e `'strict-dynamic'` só vale com nonce/hash. Fica documentado como limite.
 */

export type Cabecalho = { key: string; value: string };

const SUPABASE = "https://*.supabase.co";

/** Turnstile (RSA-05, IM-076): script, iframe do desafio e verificação. */
const TURNSTILE = "https://challenges.cloudflare.com";

/** Parte aplicada de verdade desde já. */
export const CSP_BASICA = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"].join(
  "; ",
);

/** Política completa, em modo só-relatório até ser testada no dev. */
export const CSP_COMPLETA = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' ${SUPABASE} data: blob:`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://*.supabase.co ${TURNSTILE}`,
  // Mapa incorporado do OpenStreetMap (IM-018) e desafio do Turnstile (RSA-05).
  `frame-src https://www.openstreetmap.org ${TURNSTILE}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

/** Permissions-Policy mínima: nada de sensores; geolocalização só do próprio site. */
export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "geolocation=(self)",
].join(", ");

/** Cabeçalhos válidos também para arquivos estáticos (espelhados em public/_headers). */
export const CABECALHOS_BASE: Cabecalho[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];

/** HSTS: só em produção (HTTPS). Sem includeSubDomains/preload: isso é decisão de domínio do Emerson. */
export const HSTS: Cabecalho = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000",
};

export function cabecalhosDeSeguranca(producao: boolean): Cabecalho[] {
  return [
    ...CABECALHOS_BASE,
    { key: "Content-Security-Policy", value: CSP_BASICA },
    { key: "Content-Security-Policy-Report-Only", value: CSP_COMPLETA },
    ...(producao ? [HSTS] : []),
  ];
}
