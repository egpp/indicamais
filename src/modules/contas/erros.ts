import {
  MENSAGEM_ERRO_GENERICO,
  MENSAGEM_NOME_INVALIDO,
  MENSAGEM_WHATSAPP_INDISPONIVEL,
} from "./mensagens";

export type CodigoErroConta =
  "VALIDACAO" | "WHATSAPP_INDISPONIVEL" | "NOME_INVALIDO" | "NAO_ENCONTRADA" | "ERRO_INTERNO";

export type ErroConta = { codigo: CodigoErroConta; mensagem: string };

export type ErroBanco = {
  code?: string;
  message?: string;
  details?: string;
  constraint?: string;
};

/**
 * Mapeia erros do Postgres para mensagens ao usuário. Nunca devolve texto
 * do banco. Unicidade de WhatsApp e formato inválido usam o mesmo código e a
 * mesma mensagem genérica, para não revelar que o número é de outra conta.
 */
export function mapearErroBanco(e: ErroBanco): ErroConta {
  const alvo = `${e.constraint ?? ""} ${e.message ?? ""} ${e.details ?? ""}`;
  if (e.code === "23505" && /whatsapp/i.test(alvo)) {
    return { codigo: "WHATSAPP_INDISPONIVEL", mensagem: MENSAGEM_WHATSAPP_INDISPONIVEL };
  }
  if (e.code === "23514") {
    if (/whatsapp_formato/i.test(alvo)) {
      return { codigo: "WHATSAPP_INDISPONIVEL", mensagem: MENSAGEM_WHATSAPP_INDISPONIVEL };
    }
    if (/nome_tamanho/i.test(alvo)) {
      return { codigo: "NOME_INVALIDO", mensagem: MENSAGEM_NOME_INVALIDO };
    }
  }
  return { codigo: "ERRO_INTERNO", mensagem: MENSAGEM_ERRO_GENERICO };
}
