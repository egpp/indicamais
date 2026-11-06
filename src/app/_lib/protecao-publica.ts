import { headers } from "next/headers";
import {
  CAMPO_TURNSTILE,
  MENSAGENS_TURNSTILE,
  verificarTurnstile,
} from "@/shared/turnstile/verificar";
import { ipDoPedido, origemDoPedido, type ContextoOrigem } from "./origem-denuncia";

/**
 * Proteção dos formulários públicos sem login (RSA-05, RSA-07, IM-076, D-033), sempre no SERVIDOR:
 * 1) Turnstile (verificação da resposta com a chave secreta);
 * 2) origem (HMAC de IP + navegador) para os limites por origem no banco.
 * Devolve a mensagem amigável quando o pedido deve ser recusado. Falha de configuração (sem segredo em produção)
 * recusa com mensagem neutra: nunca segue sem a proteção. Nada de token, IP ou segredo em log ou mensagem.
 */
export type ProtecaoPublica =
  { ok: true; origem: string | undefined } | { ok: false; erro: string };

export async function protegerFormularioPublico(
  f: FormData,
  contexto: ContextoOrigem,
  recusaGenerica: string,
): Promise<ProtecaoPublica> {
  const h = await headers();
  const turnstile = await verificarTurnstile({ token: f.get(CAMPO_TURNSTILE), ip: ipDoPedido(h) });
  if (!turnstile.ok) return { ok: false, erro: MENSAGENS_TURNSTILE[turnstile.motivo] };
  try {
    return { ok: true, origem: await origemDoPedido(h, contexto) };
  } catch {
    return { ok: false, erro: recusaGenerica };
  }
}
