import { emProducao } from "@/shared/config/ambiente";

/**
 * Origem do pedido anônimo (IM-076, RSA-07, RSA-05, D-033): HMAC-SHA-256 (hex, 64) de IP + user-agent com o segredo
 * do servidor (DENUNCIA_HASH_SEGREDO), calculado SEMPRE no servidor. SHA-256 puro de IPv4 se inverte em segundos;
 * com o segredo (só no ambiente do Worker) o hash não se desfaz mesmo com vazamento do banco. O IP nunca é
 * guardado nem enviado cru: o banco só recebe o hash, usado nos limites por pessoa/origem. O contexto
 * ("denuncia" ou "contato") entra na mensagem: o mesmo visitante não é ligável entre as duas finalidades.
 *
 * Sem IP (cabeçalho ausente) devolve undefined: melhor sem origem do que juntar todo mundo na mesma origem.
 * Sem segredo: em produção LANÇA (a ação responde "indisponível": falha segura, nunca grava hash fraco); fora dela
 * (`pnpm dev` e testes) devolve undefined (sem origem), que o banco trata como o balde único e mais restritivo.
 * Compatível com a limpeza de >30 dias: o formato (64 hex) é o mesmo; hashes antigos (SHA-256 puro) só envelhecem.
 */
export const SEGREDO_ORIGEM_MIN = 32;

export class SegredoDeOrigemAusente extends Error {
  constructor() {
    super("DENUNCIA_HASH_SEGREDO ausente ou curto demais.");
    this.name = "SegredoDeOrigemAusente";
  }
}

export type ContextoOrigem = "denuncia" | "contato";

export function ipDoPedido(h: Pick<Headers, "get">): string | null {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const primeiro = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return primeiro ? primeiro : null;
}

export async function origemDoPedido(
  h: Pick<Headers, "get">,
  contexto: ContextoOrigem,
  env: Record<string, string | undefined> = process.env,
): Promise<string | undefined> {
  const segredo = env.DENUNCIA_HASH_SEGREDO?.trim();
  if (!segredo || segredo.length < SEGREDO_ORIGEM_MIN) {
    if (emProducao(env)) throw new SegredoDeOrigemAusente();
    return undefined;
  }
  const ip = ipDoPedido(h);
  if (!ip) return undefined;
  const ua = (h.get("user-agent") ?? "").slice(0, 300);
  const codificar = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    codificar.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    codificar.encode(`${contexto}|${ip}|${ua}`),
  );
  return Array.from(new Uint8Array(assinatura), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const origemDaDenuncia = (h: Pick<Headers, "get">) => origemDoPedido(h, "denuncia");
