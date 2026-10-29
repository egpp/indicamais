import { enviarContatoSchema } from "@/modules/indicacoes";
import { errosPorCampo } from "@/shared/conteudo/zod-util";

/**
 * Validação no navegador com o MESMO schema do servidor (módulo indicacoes). Devolve null se válido, ou
 * { campo: mensagem } só dos campos visíveis do formulário de contato.
 */
const UUID_DE_CONFERENCIA = "00000000-0000-4000-8000-000000000000";
const VISIVEIS = ["nome", "whatsapp", "email", "mensagem"];

export function validarContato(d: Record<string, string>): Record<string, string> | null {
  const r = enviarContatoSchema.safeParse({
    perfilId: UUID_DE_CONFERENCIA, // o destino é conferido no servidor
    nome: d.nome ?? "",
    whatsapp: d.whatsapp ?? "",
    email: d.email ?? "",
    mensagem: d.mensagem ?? "",
    chave: d.chave ?? "",
  });
  if (r.success) return null;
  const erros = Object.fromEntries(
    Object.entries(errosPorCampo(r.error)).filter(([k]) => VISIVEIS.includes(k)),
  );
  return Object.keys(erros).length > 0 ? erros : null;
}

const MOTIVO_OBRIGATORIO = "Informe o motivo.";

/** Motivo obrigatório (reenvio, tratar alerta). A regra completa é do módulo, no servidor. */
export function validarMotivo(d: Record<string, string>): Record<string, string> | null {
  return (d.motivo ?? "").trim() === "" ? { motivo: MOTIVO_OBRIGATORIO } : null;
}

export function validarParametro(d: Record<string, string>): Record<string, string> | null {
  const erros: Record<string, string> = {};
  if (!/^-?[0-9]+$/.test((d.valor ?? "").trim())) erros.valor = "Informe um número inteiro.";
  if ((d.motivo ?? "").trim() === "") erros.motivo = MOTIVO_OBRIGATORIO;
  return Object.keys(erros).length > 0 ? erros : null;
}
