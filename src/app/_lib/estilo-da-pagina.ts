import type { EstiloPagina } from "@/modules/perfis";
import {
  ESTILO_PADRAO,
  TEMAS,
  estiloLiberadoOuNulo,
  resolverEstilo,
  type EstiloId,
  type TemaEstilo,
} from "../_componentes/site/estilos";
import { obterServicoAparenciaPublico } from "./contexto-aparencia";
import { obterContextoRelacionamentoAberto, lerEstadoCurtida } from "./contexto-relacionamento";

/**
 * Estilo a aplicar na página pública do negócio (D-016; IM-091, IM-094). O público vê o estilo que o responsável
 * salvou (`estiloPublico`: o banco já devolve o padrão se o estilo foi recolhido). O parâmetro ?estilo= só vale como
 * PRÉVIA para o responsável do perfil ou para o administrador geral; para qualquer outra pessoa é ignorado.
 */
export async function estiloDaPaginaPublica(
  perfilId: string,
  slug: string,
  solicitado: string | undefined,
): Promise<{ estilo: EstiloId; previa: boolean }> {
  let salvo: EstiloId = ESTILO_PADRAO;
  try {
    const r = await obterServicoAparenciaPublico().estiloPublico(slug);
    if (r.ok) salvo = resolverEstilo(r.valor.estilo);
  } catch {
    salvo = ESTILO_PADRAO;
  }
  const pedido = estiloLiberadoOuNulo(solicitado);
  if (!pedido) return { estilo: salvo, previa: false };
  try {
    const curtida = await lerEstadoCurtida(perfilId);
    let pode = curtida.proprio;
    if (!pode && curtida.logado) {
      const ctx = await obterContextoRelacionamentoAberto();
      pode = await ctx.ehAdministrador();
    }
    return pode ? { estilo: pedido, previa: true } : { estilo: salvo, previa: false };
  } catch {
    return { estilo: salvo, previa: false };
  }
}

/** Estilos que a pessoa pode escolher: têm desenho pronto no código E estão habilitados no banco. */
export function estilosSelecionaveis(doBanco: readonly EstiloPagina[]): TemaEstilo[] {
  return doBanco.flatMap((e) => {
    const tema = (TEMAS as Record<string, TemaEstilo | undefined>)[e.id];
    return tema?.liberado && e.habilitado ? [tema] : [];
  });
}
