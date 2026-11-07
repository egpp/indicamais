/**
 * Caminho do painel do responsável (aparece no e-mail de aviso, IM-027, IM-028). Fica fora de
 * notificacoes-contato.ts de propósito: aquele arquivo importa `next/server`, e o Worker agendado
 * (worker/entrada.ts, via notificacoes-cron.ts) não pode carregar o Next no escopo global
 * (ua-parser-js usa `__dirname`; a Cloudflare recusa o script com o erro 10021).
 */
export const CAMINHO_PAINEL_PEDIDOS = "/pedidos-de-contato";
