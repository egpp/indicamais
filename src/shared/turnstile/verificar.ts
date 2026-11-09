import { z } from "zod";
import { emProducao } from "../config/ambiente";
import { LIMITES } from "../config/limites";
import { CAMPO_TURNSTILE } from "./campo";

/**
 * Verificação do Cloudflare Turnstile no SERVIDOR (RSA-05, IM-076, D-033). O token do navegador nunca vale por si:
 * só a resposta do siteverify, com a chave secreta (TURNSTILE_SECRET_KEY, só no ambiente), conta.
 *
 * Sem a chave secreta:
 *   - em produção (inclui o Worker `indicamais-dev`): FALHA FECHADO (motivo "nao_configurado"), nunca aprova;
 *   - fora dela (`pnpm dev` e testes): a verificação é dispensada (`verificado: false`), para não travar o
 *     desenvolvimento local. Para testar o fluxo completo localmente use as chaves de teste OFICIAIS da
 *     Cloudflare no .env.local (https://developers.cloudflare.com/turnstile/troubleshooting/testing/);
 *     elas não ficam no código do app.
 * Nada do token, da chave nem do IP vai para log ou mensagem.
 */
export { CAMPO_TURNSTILE };

export type MotivoFalhaTurnstile = "ausente" | "invalido" | "indisponivel" | "nao_configurado";
export type ResultadoTurnstile =
  { ok: true; verificado: boolean } | { ok: false; motivo: MotivoFalhaTurnstile };

export const MENSAGENS_TURNSTILE: Record<MotivoFalhaTurnstile, string> = {
  ausente: "Confirme a verificação de segurança antes de enviar.",
  invalido: "Não foi possível confirmar a verificação de segurança. Tente de novo.",
  indisponivel: "A verificação de segurança está indisponível agora. Tente novamente em instantes.",
  nao_configurado:
    "A verificação de segurança está indisponível agora. Tente novamente em instantes.",
};

const tokenSchema = z.string().min(1).max(LIMITES.turnstile.tokenMax);
const respostaSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

const ERROS_NOSSOS = ["internal-error", "missing-input-secret", "invalid-input-secret"];

/**
 * Diagnóstico seguro: só o motivo, o status HTTP do siteverify e os `error-codes` (códigos fixos da Cloudflare,
 * filtrados por formato). Nunca segredo, token, IP nem dado pessoal.
 */
function registrarFalha(motivo: MotivoFalhaTurnstile, status?: number, codigos?: string[]): void {
  const seguros = (codigos ?? []).filter((c) => /^[a-z0-9-]{1,64}$/.test(c)).slice(0, 10);
  const registro: Record<string, unknown> = { evento: "turnstile_falha", motivo };
  if (status !== undefined) registro.status = status;
  if (seguros.length > 0) registro.errorCodes = seguros;
  console.warn(JSON.stringify(registro));
}

function falha(
  motivo: MotivoFalhaTurnstile,
  status?: number,
  codigos?: string[],
): { ok: false; motivo: MotivoFalhaTurnstile } {
  registrarFalha(motivo, status, codigos);
  return { ok: false, motivo };
}

export type OpcoesTurnstile = {
  env?: Record<string, string | undefined>;
  /** Injetável nos testes. */
  buscar?: typeof fetch;
};

export async function verificarTurnstile(
  entrada: { token?: unknown; ip?: string | null },
  opcoes: OpcoesTurnstile = {},
): Promise<ResultadoTurnstile> {
  const env = opcoes.env ?? process.env;
  const segredo = env.TURNSTILE_SECRET_KEY?.trim();
  if (!segredo) {
    return emProducao(env) ? falha("nao_configurado") : { ok: true, verificado: false };
  }
  const bruto = typeof entrada.token === "string" ? entrada.token.trim() : "";
  if (bruto === "") return falha("ausente");
  const token = tokenSchema.safeParse(bruto);
  if (!token.success) return falha("invalido");

  const corpo = new URLSearchParams({ secret: segredo, response: token.data });
  if (entrada.ip) corpo.set("remoteip", entrada.ip);
  try {
    const resposta = await (opcoes.buscar ?? fetch)(LIMITES.turnstile.urlVerificacao, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(LIMITES.turnstile.timeoutMs),
    });
    if (!resposta.ok) return falha("indisponivel", resposta.status);
    const dados = respostaSchema.safeParse(await resposta.json());
    if (!dados.success) return falha("indisponivel", resposta.status);
    if (dados.data.success) return { ok: true, verificado: true };
    // Erro da Cloudflare ou da nossa chave: indisponível. Token ruim, repetido ou vencido: inválido.
    const codigos = dados.data["error-codes"] ?? [];
    const nosso = codigos.some((c) => ERROS_NOSSOS.includes(c));
    return falha(nosso ? "indisponivel" : "invalido", resposta.status, codigos);
  } catch {
    return falha("indisponivel");
  }
}

/** Chave pública do widget (NEXT_PUBLIC_TURNSTILE_SITE_KEY). Vazia ou ausente: undefined. */
export function chaveDoSiteTurnstile(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
}
