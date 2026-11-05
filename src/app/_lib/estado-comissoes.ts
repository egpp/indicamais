import type { EstadoFormulario } from "./estado-formulario";

/**
 * Estado das Server Actions da Fase 7. `pedirConfirmacaoPaga`: a comissão já foi paga e o banco exige confirmação
 * explícita antes de registrar a reversão (IM-073).
 */
export type EstadoComissoes = EstadoFormulario & { pedirConfirmacaoPaga?: boolean };
