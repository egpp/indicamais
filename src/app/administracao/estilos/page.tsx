import type { Metadata } from "next";
import { FormHabilitarEstilo } from "../../_componentes/form-aparencia";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { TEMAS, type TemaEstilo } from "../../_componentes/site/estilos";
import { Aviso } from "../../_componentes/ui";
import { exigirGeral, obterContextoAparencia } from "../../_lib/contexto-aparencia";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Estilos de página (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * Estilos de página (D-016; IM-091): o administrador geral habilita ou desabilita cada estilo, com motivo
 * (auditado no banco). Estilo desabilitado some da escolha; páginas que o usavam passam a aparecer no padrão.
 * Quem não é administrador geral recebe o 404 padrão.
 */
export default async function PaginaEstilosAdmin() {
  const ctx = await obterContextoAparencia("/administracao/estilos");
  await exigirGeral(ctx);
  const r = await ctx.servico.listarEstilos();
  return (
    <PainelPagina
      titulo="Estilos de página"
      subtitulo="Libere ou recolha estilos para os responsáveis. Toda mudança pede um motivo e fica registrada."
      admin
      atual="administracao"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((e) => {
            const tema = (TEMAS as Record<string, TemaEstilo | undefined>)[e.id];
            const pronto = tema?.liberado === true;
            return (
              <li key={e.id} className="cartao">
                <h2>{e.rotulo}</h2>
                <p>
                  <SeloEstado rotulo={e.habilitado ? "Disponível" : "Indisponível"} />
                </p>
                {e.id === "minimalista" ? (
                  <p className="ajuda">O estilo padrão não pode ser desabilitado.</p>
                ) : e.habilitado ? (
                  <FormHabilitarEstilo estilo={e.id} rotulo={e.rotulo} habilitar={false} />
                ) : pronto ? (
                  <FormHabilitarEstilo estilo={e.id} rotulo={e.rotulo} habilitar />
                ) : (
                  <p className="ajuda">O desenho deste estilo ainda não está pronto.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PainelPagina>
  );
}
