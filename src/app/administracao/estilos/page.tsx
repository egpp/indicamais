import type { Metadata } from "next";
import { ListaModelos } from "../../_componentes/modelos-lista";
import { lerBusca, lerFiltro, montarModelos } from "../../_componentes/estilos-admin";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { exigirGeral, obterContextoAparencia } from "../../_lib/contexto-aparencia";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Modelos de sites (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * Estilos de página (D-016; IM-091): o administrador geral habilita ou desabilita cada estilo, com motivo
 * (auditado no banco). Estilo desabilitado some da escolha; páginas que o usavam passam a aparecer no padrão.
 * Quem não é administrador geral recebe o 404 padrão.
 */
export default async function PaginaEstilosAdmin({
  searchParams,
}: PageProps<"/administracao/estilos">) {
  const ctx = await obterContextoAparencia("/administracao/estilos");
  await exigirGeral(ctx);
  const params = await searchParams;
  const r = await ctx.servico.listarEstilos();
  return (
    <PainelPagina
      titulo="Modelos de sites"
      subtitulo="Gerencie quais modelos ficam disponíveis para escolha."
      admin
      atual="administracao"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : (
        <ListaModelos
          modelos={montarModelos(r.valor)}
          filtro={lerFiltro(params.estado)}
          busca={lerBusca(params.busca)}
        />
      )}
    </PainelPagina>
  );
}
