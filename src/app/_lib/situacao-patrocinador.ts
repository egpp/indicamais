import type { SituacaoPatrocinador } from "@/modules/administracao";

/** Rótulos em português da situação do patrocinador (calculada pelo módulo a partir de ativo e período). */
export const ROTULO_SITUACAO: Record<SituacaoPatrocinador, string> = {
  inativo: "Inativo",
  agendado: "Agendado",
  no_ar: "No ar",
  encerrado: "Encerrado",
};
