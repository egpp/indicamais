import { enviarContatoSchema, MOTIVO_MINIMO_PARAMETRO_CONTATO } from "@/modules/indicacoes";
import { LIMITES } from "@/shared/config/limites";
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

/** Limites do contato (D-034 item 1): motivo de 10 a 500 caracteres. A regra final é do servidor. */
export function validarMotivoContato(motivo: string): string | null {
  const m = motivo.trim();
  if (m === "") return MOTIVO_OBRIGATORIO;
  if (m.length < MOTIVO_MINIMO_PARAMETRO_CONTATO)
    return `O motivo deve ter ao menos ${MOTIVO_MINIMO_PARAMETRO_CONTATO} caracteres.`;
  if (m.length > LIMITES.revisao.motivoMax)
    return `O motivo deve ter no máximo ${LIMITES.revisao.motivoMax} caracteres.`;
  return null;
}

/** Limite por hora: inteiro dentro da faixa (a faixa final é do banco) e motivo válido. */
export function validarLimiteContato(
  d: Record<string, string>,
  faixa: { minimo: number; maximo: number },
): Record<string, string> | null {
  const erros: Record<string, string> = {};
  const v = (d.valor ?? "").trim();
  if (!/^-?[0-9]+$/.test(v)) erros.valor = "Informe um número inteiro.";
  else if (Number(v) < faixa.minimo || Number(v) > faixa.maximo)
    erros.valor = `Informe um valor entre ${faixa.minimo} e ${faixa.maximo}.`;
  const m = validarMotivoContato(d.motivo ?? "");
  if (m) erros.motivo = m;
  return Object.keys(erros).length > 0 ? erros : null;
}

/** Interruptor da recusa de excesso: ao LIGAR, a caixa de confirmação é obrigatória. */
export function validarInterruptorContato(
  d: Record<string, string>,
): Record<string, string> | null {
  const erros: Record<string, string> = {};
  if (d.valor === "1" && d.confirmo !== "sim")
    erros.confirmo = "Confirme que o Turnstile está no ar antes de ligar.";
  const m = validarMotivoContato(d.motivo ?? "");
  if (m) erros.motivo = m;
  return Object.keys(erros).length > 0 ? erros : null;
}

export function validarParametro(d: Record<string, string>): Record<string, string> | null {
  const erros: Record<string, string> = {};
  if (!/^-?[0-9]+$/.test((d.valor ?? "").trim())) erros.valor = "Informe um número inteiro.";
  if ((d.motivo ?? "").trim() === "") erros.motivo = MOTIVO_OBRIGATORIO;
  return Object.keys(erros).length > 0 ? erros : null;
}

/** Descarte de notificações (IM-103): ao menos uma escolhida, motivo de 10 a 500 e confirmação. A regra final é do servidor. */
export function validarDescarteNotificacoes(
  d: Record<string, string>,
): Record<string, string> | null {
  const erros: Record<string, string> = {};
  if (!d.pedidoIds) erros.pedidoIds = "Selecione ao menos uma notificação.";
  const m = validarMotivoContato(d.motivo ?? "");
  if (m) erros.motivo = m;
  if (d.confirmo !== "sim") {
    erros.confirmo = "Marque a confirmação para descartar as notificações selecionadas.";
  }
  return Object.keys(erros).length > 0 ? erros : null;
}
