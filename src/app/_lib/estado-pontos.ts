import type { EstadoFormulario } from "./estado-formulario";

/** Estado das Server Actions da Fase 4. `pedirConfirmacao`: a reversão deixaria o saldo negativo (IM-078). */
export type EstadoPontos = EstadoFormulario & { pedirConfirmacao?: boolean };
