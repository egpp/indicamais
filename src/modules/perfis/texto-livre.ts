/**
 * IM-012 (D-006): informações sociais SÓ como texto. Nada que seja ou pareça link:
 * esquema (http:, https:), "www.", "//", domínio com extensão comum, e @usuario.
 * Mais estrito que o CHECK do banco (perfis_versao_sociais): o que o app aceita o banco aceita.
 */
const PADROES_LINK: readonly RegExp[] = [
  /https?:/i,
  /\bwww\./i,
  /\/\//,
  /@\s*[\p{L}\p{N}_.]/u,
  /[a-z0-9]\.(com|net|org|br|me|io|link|app|gg|ly|co|info|biz|tv|xyz|dev|page|ws|bio|ink|store|shop|online|site|gl|fm)(?![a-z])/i,
];

export function pareceLinkOuRede(texto: string): boolean {
  return PADROES_LINK.some((p) => p.test(texto));
}

/** Redes e encurtadores: o campo "site" não pode apontar para eles (contornaria o IM-012). */
const HOSTS_PROIBIDOS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
  "kwai.com",
  "threads.net",
  "pinterest.com",
  "snapchat.com",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.me",
  "discord.gg",
  "linktr.ee",
  "bit.ly",
  "tinyurl.com",
];

export type ResultadoSite = { ok: true; site: string } | { ok: false; mensagem: string };

/** Normaliza o site: aceita "meusite.com.br" (assume https). Só http/https, com domínio, sem rede social. */
export function normalizarSite(entrada: string, max: number): ResultadoSite {
  const msg = "Informe um endereço de site válido (exemplo: https://meusite.com.br).";
  let texto = entrada.trim();
  if (texto === "" || /\s/.test(texto)) return { ok: false, mensagem: msg };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(texto)) texto = `https://${texto}`;
  if (!/^https?:\/\//i.test(texto)) return { ok: false, mensagem: msg };
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return { ok: false, mensagem: msg };
  }
  const host = u.hostname.toLowerCase();
  if (u.username || u.password || !host.includes(".") || host.endsWith(".")) {
    return { ok: false, mensagem: msg };
  }
  if (HOSTS_PROIBIDOS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return {
      ok: false,
      mensagem: "O site não pode ser um link de rede social. Use o endereço do seu próprio site.",
    };
  }
  if (texto.length > max)
    return { ok: false, mensagem: `O endereço deve ter até ${max} caracteres.` };
  return { ok: true, site: texto };
}
