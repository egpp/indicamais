type ErroAuthLog = { code?: string; status?: number } | null | undefined;

/**
 * Registra falha do Auth só no log do servidor, para diagnóstico (IM-008, IM-086).
 * Grava apenas ação, código e status. Nunca e-mail, senha, token, mensagem ou dados do usuário (IM-029).
 */
export function registrarFalhaAuth(acao: string, erro: ErroAuthLog): void {
  if (!erro) return;
  const registro = {
    acao,
    codigo: typeof erro.code === "string" ? erro.code : null,
    status: typeof erro.status === "number" ? erro.status : null,
  };
  console.warn("[auth] falha", registro);
}
