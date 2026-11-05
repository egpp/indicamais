import { LIMITES } from "../config/limites";

/**
 * Enviador de e-mail pela API do Resend (IM-027, IM-028, IM-023). Só `fetch` (compatível com Cloudflare Workers).
 * Nunca registra chave, e-mail nem conteúdo; o erro devolvido é um texto curto e fixo.
 * Referência: POST https://api.resend.com/emails, Authorization Bearer, Idempotency-Key (1 a 256 caracteres,
 * vale 24 h). Erros: 429 (rate_limit_exceeded, daily_quota_exceeded, monthly_quota_exceeded), 409
 * (concurrent_idempotent_requests), 5xx. Falha = o pedido segue "pendente" e é reprocessado pelo mecanismo existente.
 */

export const URL_API_RESEND = "https://api.resend.com/emails";

/** Mesmo formato da porta `EnviadorEmail` do módulo indicacoes (tipagem estrutural; shared não importa módulos). */
export type EmailEnvio = {
  para: string;
  assunto: string;
  texto: string;
  chaveIdempotencia?: string;
};
export type ResultadoEnvioEmail = { ok: true } | { ok: false; erro: string };
export type EnviadorEmailPorta = { enviar(email: EmailEnvio): Promise<ResultadoEnvioEmail> };

export const ERRO_EMAIL = {
  semConfiguracao: "provedor de e-mail não configurado",
  limite: "provedor de e-mail: limite de envio atingido",
  autenticacao: "provedor de e-mail: chave ou remetente recusado",
  rejeitado: "provedor de e-mail: envio recusado",
  indisponivel: "provedor de e-mail: indisponível",
  tempo: "provedor de e-mail: tempo esgotado",
  rede: "provedor de e-mail: falha de rede",
} as const;

export type ConfigResend = {
  chave: string;
  /** Ex.: `IndicaMais <avisos@dominio-verificado.com.br>`. */
  remetente: string;
  /** Injetável nos testes. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Lê só do ambiente. Sem chave ou sem remetente, devolve null (comportamento "pendente"). */
export function lerConfigResend(
  env: Record<string, string | undefined> = process.env,
): Pick<ConfigResend, "chave" | "remetente"> | null {
  const chave = (env.EMAIL_API_KEY ?? "").trim();
  const remetente = (env.EMAIL_FROM ?? "").trim();
  if (!chave || !remetente) return null;
  return { chave, remetente };
}

function classificarStatus(status: number): string {
  if (status === 429 || status === 409) return ERRO_EMAIL.limite;
  if (status === 401 || status === 403) return ERRO_EMAIL.autenticacao;
  if (status >= 500) return ERRO_EMAIL.indisponivel;
  return ERRO_EMAIL.rejeitado;
}

export function criarEnviadorResend(config: ConfigResend): EnviadorEmailPorta {
  return {
    async enviar(email) {
      const f = config.fetchImpl ?? fetch;
      const chaveIdem = email.chaveIdempotencia?.slice(0, 256);
      try {
        const resp = await f(URL_API_RESEND, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.chave}`,
            "Content-Type": "application/json",
            ...(chaveIdem ? { "Idempotency-Key": chaveIdem } : {}),
          },
          body: JSON.stringify({
            from: config.remetente,
            to: [email.para],
            subject: email.assunto,
            text: email.texto,
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? LIMITES.email.timeoutMs),
        });
        if (resp.ok) return { ok: true };
        return { ok: false, erro: classificarStatus(resp.status) };
      } catch (e) {
        const nome = e instanceof Error ? e.name : "";
        return {
          ok: false,
          erro:
            nome === "TimeoutError" || nome === "AbortError" ? ERRO_EMAIL.tempo : ERRO_EMAIL.rede,
        };
      }
    },
  };
}

/** Enviador do ambiente: Resend se houver chave e remetente; senão falha controlada (pendente). */
export function criarEnviadorDoAmbiente(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): EnviadorEmailPorta {
  const cfg = lerConfigResend(env);
  if (!cfg) return { enviar: async () => ({ ok: false, erro: ERRO_EMAIL.semConfiguracao }) };
  return criarEnviadorResend({ ...cfg, ...(fetchImpl ? { fetchImpl } : {}) });
}
