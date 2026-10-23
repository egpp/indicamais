import { LIMITES } from "../config/limites";

/** IM-016: principal + até 2 secundárias, sem repetir e sem pular a principal. */

export type CategoriasEscolhidas = {
  principalId: string | null;
  secundariasIds: string[];
};

export function validarCategorias(c: CategoriasEscolhidas): string | null {
  if (c.secundariasIds.length > LIMITES.categorias.secundariasMax) {
    return `Escolha no máximo ${LIMITES.categorias.secundariasMax} categorias secundárias.`;
  }
  if (c.secundariasIds.length > 0 && !c.principalId) {
    return "Escolha a categoria principal antes das secundárias.";
  }
  const todas = [c.principalId, ...c.secundariasIds].filter((x): x is string => !!x);
  if (new Set(todas).size !== todas.length) {
    return "Não repita a mesma categoria.";
  }
  return null;
}

/** Colunas do banco (principal, secundária 1, secundária 2). */
export function categoriasParaColunas(c: CategoriasEscolhidas) {
  return {
    categoria_principal_id: c.principalId,
    categoria_secundaria_1_id: c.secundariasIds[0] ?? null,
    categoria_secundaria_2_id: c.secundariasIds[1] ?? null,
  };
}

export function colunasParaCategorias(l: {
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
}): CategoriasEscolhidas {
  return {
    principalId: l.categoria_principal_id,
    secundariasIds: [l.categoria_secundaria_1_id, l.categoria_secundaria_2_id].filter(
      (x): x is string => !!x,
    ),
  };
}
