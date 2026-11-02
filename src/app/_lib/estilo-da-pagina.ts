import { obterContextoRelacionamentoAberto, lerEstadoCurtida } from "./contexto-relacionamento";
import { ESTILO_PADRAO, estiloLiberadoOuNulo, type EstiloId } from "../_componentes/site/estilos";

/**
 * Estilo a aplicar na página pública do negócio (D-016; IM-091). Enquanto a escolha do responsável não é gravada
 * (virá com o banco), o público sempre vê o padrão. O parâmetro ?estilo= só vale como PRÉVIA para o responsável
 * do perfil ou para o administrador geral; para qualquer outra pessoa é ignorado.
 */
export async function estiloDaPaginaPublica(
  perfilId: string,
  solicitado: string | undefined,
): Promise<{ estilo: EstiloId; previa: boolean }> {
  const pedido = estiloLiberadoOuNulo(solicitado);
  if (!pedido) return { estilo: ESTILO_PADRAO, previa: false };
  try {
    const curtida = await lerEstadoCurtida(perfilId);
    let pode = curtida.proprio;
    if (!pode && curtida.logado) {
      const ctx = await obterContextoRelacionamentoAberto();
      pode = await ctx.ehAdministrador();
    }
    return pode ? { estilo: pedido, previa: true } : { estilo: ESTILO_PADRAO, previa: false };
  } catch {
    return { estilo: ESTILO_PADRAO, previa: false };
  }
}
