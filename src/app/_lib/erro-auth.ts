export type TipoErroAuth =
  | "CREDENCIAIS"
  | "NAO_CONFIRMADO"
  | "SENHA_IGUAL"
  | "SENHA_FRACA"
  | "LIMITE"
  | "SEM_SESSAO"
  | "BANIDO"
  | "OUTRO";

type ErroAuthLike = { code?: string; status?: number; message?: string } | null | undefined;

/** Classifica erro do Supabase Auth por `code`, nunca pelo texto (que não é estável). */
export function classificarErroAuth(erro: ErroAuthLike): TipoErroAuth {
  switch (erro?.code) {
    case "invalid_credentials":
      return "CREDENCIAIS";
    case "email_not_confirmed":
      return "NAO_CONFIRMADO";
    case "user_banned":
      return "BANIDO";
    case "same_password":
      return "SENHA_IGUAL";
    case "weak_password":
      return "SENHA_FRACA";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "LIMITE";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "SEM_SESSAO";
    default:
      return erro?.status === 429 ? "LIMITE" : "OUTRO";
  }
}
