import { coordenadasSchema, foraDoBrasil, MENSAGENS_LOCALIZACAO } from "@/modules/perfis";
import { errosPorCampo } from "@/shared/conteudo/zod-util";

/**
 * Coordenadas digitadas (IM-018): mesmo schema do servidor (módulo perfis). Aceita vírgula decimal.
 * Texto vazio ou não numérico vira erro de campo, nunca exceção.
 */
export type CoordenadasLidas = { latitude: number; longitude: number };

function numeroDe(texto: string): number {
  const t = texto.trim().replace(",", ".");
  return t === "" || !/^[+-]?\d+(\.\d+)?$/.test(t) ? Number.NaN : Number(t);
}

export function lerCoordenadas(
  d: Record<string, string>,
):
  | { ok: true; valor: CoordenadasLidas; foraDoBrasil: boolean }
  | { ok: false; erros: Record<string, string> } {
  const r = coordenadasSchema.safeParse({
    latitude: numeroDe(d.latitude ?? ""),
    longitude: numeroDe(d.longitude ?? ""),
  });
  if (!r.success) {
    const erros = errosPorCampo(r.error);
    return {
      ok: false,
      erros: {
        ...(erros.latitude ? { latitude: "Informe a latitude, entre -90 e 90." } : {}),
        ...(erros.longitude ? { longitude: "Informe a longitude, entre -180 e 180." } : {}),
        ...(Object.keys(erros).length === 0
          ? { latitude: MENSAGENS_LOCALIZACAO.coordenadasInvalidas }
          : {}),
      },
    };
  }
  return { ok: true, valor: r.data, foraDoBrasil: foraDoBrasil(r.data) };
}

/** Validador do navegador (useFormulario): null se válido. */
export function validarCoordenadas(d: Record<string, string>): Record<string, string> | null {
  const r = lerCoordenadas(d);
  return r.ok ? null : r.erros;
}
