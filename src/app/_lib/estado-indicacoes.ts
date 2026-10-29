import type { EstadoFormulario } from "./estado-formulario";

/** Estados devolvidos pelas Server Actions da Fase 3 (além do padrão dos formulários). */

/** Pedido de contato do visitante: após o sucesso, o endereço do WhatsApp do responsável (wa.me). */
export type EstadoContato = EstadoFormulario & { urlWhatsapp?: string };

export type LinkParaCompartilhar = {
  codigo: string;
  url: string;
  texto: string;
  urlWhatsapp: string;
};

/** "Indique": link gerado ou o próximo passo do usuário (entrar, cadastrar WhatsApp, autoindicação). */
export type EstadoLink = EstadoFormulario & {
  link?: LinkParaCompartilhar;
  passo?: "entrar" | "whatsapp" | "autoindicacao";
};
