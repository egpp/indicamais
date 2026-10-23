/** Regras puras da conta. IM-009; IM-010 (verificação) é futuro e não é implementado. */

export type ContaParaRegras = { whatsappE164: string | null };

/** IM-009: pode indicar se tem WhatsApp. Nunca depende de "verificado". */
export function podeIndicar(conta: ContaParaRegras): boolean {
  return typeof conta.whatsappE164 === "string" && conta.whatsappE164 !== "";
}

/**
 * IM-009/IM-010: nenhum número é apresentado como verificado nesta fase,
 * independentemente do que o banco devolva.
 */
export function whatsappApresentavelComoVerificado(_conta?: unknown): false {
  void _conta;
  return false;
}
