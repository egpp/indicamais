import type { ContextoPatrocinadores } from "./contexto-patrocinadores";

/**
 * Perfis PUBLICADOS para escolher como destino do patrocinador (primeiros 50 da busca pública). O banco confere
 * de novo que o perfil de destino existe e está disponível.
 */
export async function perfisParaDestino(
  ctx: ContextoPatrocinadores,
): Promise<{ id: string; nome: string }[]> {
  const r = await ctx.busca.buscar({ tipo: "perfil", pagina: 1, limite: 50 });
  return r.ok ? r.valor.cards.map((c) => ({ id: c.id, nome: c.nome })) : [];
}
