import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import type { DestinoLink } from "./schemas";

/** Funções puras de URL e texto pronto. Nenhum dado privado entra aqui (IM-029, IM-050). */

/** NEXT_PUBLIC_APP_URL -> origem http(s) sem caminho; inválido => null. */
export function origemDe(urlBase: string | null | undefined): string | null {
  const bruto = urlBase?.trim();
  if (!bruto) return null;
  try {
    const u = new URL(bruto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Endereço público do destino (sem origem). */
export function caminhoDoDestino(d: DestinoLink): string {
  return d.tipo === "perfil" ? ROTAS_PUBLICAS.perfil(d.slug) : ROTAS_PUBLICAS.item(d.id);
}

/** IM-024: endereço público do destino com ?ind=<codigo>. */
export function montarUrlIndicacao(origem: string, d: DestinoLink, codigo: string): string {
  return `${origem}${caminhoDoDestino(d)}?ind=${encodeURIComponent(codigo)}`;
}

/** Texto pronto para o indicador enviar a quem ele conhece. */
export function textoCompartilhamento(nomeDestino: string | undefined, url: string): string {
  const abertura = nomeDestino
    ? `Conheça ${nomeDestino} no IndicaMais:`
    : "Olha essa indicação no IndicaMais:";
  return `${abertura} ${url}`;
}

/** https://wa.me/?text=... (o indicador escolhe o contato dentro do WhatsApp). */
export function urlWhatsappCompartilhar(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/** "+5551999999999" -> "5551999999999"; fora do padrão => null. */
export function digitosWhatsapp(e164: string): string | null {
  return /^\+55[0-9]{10,11}$/.test(e164) ? e164.slice(1) : null;
}

/**
 * IM-026: mensagem curta e educada para o WhatsApp do responsável. Leva só o nome do destino (público) e o
 * nome que o visitante digitou. Nada de e-mail, WhatsApp do visitante, mensagem livre nem dados do indicador.
 */
export function textoContatoVisitante(
  nomeVisitante: string,
  nomeDestino: string | undefined,
): string {
  const assunto = nomeDestino ? `falar sobre ${nomeDestino}` : "mais informações";
  return `Olá! Vim pelo IndicaMais e gostaria de ${assunto}. Meu nome é ${nomeVisitante}. Obrigado!`;
}

/** https://wa.me/<número sem +>?text=... */
export function urlWhatsappResponsavel(whatsappE164: string, texto: string): string | null {
  const numero = digitosWhatsapp(whatsappE164);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}
