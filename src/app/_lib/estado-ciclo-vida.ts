import type { EstadoFormulario } from "./estado-formulario";

/** Estado das Server Actions da Fase 6. `pedirConfirmacao`: invalidar deixaria o saldo negativo (IM-077). */
export type EstadoCicloVida = EstadoFormulario & { pedirConfirmacao?: boolean };
