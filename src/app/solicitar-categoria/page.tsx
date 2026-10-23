import type { Metadata } from "next";
import { FormSolicitarCategoria } from "../_componentes/form-administracao";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { formatarDataHora } from "../_lib/apresentacao";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Pedir nova categoria | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTULO = { pendente: "Em análise", atendida: "Atendido", recusada: "Recusado" } as const;

/** IM-016: o responsável pede uma categoria que não existe e acompanha a resposta. */
export default async function PaginaSolicitarCategoria() {
  const ctx = await obterContexto("/solicitar-categoria");
  const minhas = await ctx.categorias.listarMinhasSolicitacoes();
  return (
    <PainelPagina
      titulo="Pedir nova categoria"
      subtitulo="Se nenhuma categoria serve, peça uma nova. A equipe responde aqui."
    >
      <FormSolicitarCategoria />
      <section aria-labelledby="titulo-pedidos">
        <h2 id="titulo-pedidos">Meus pedidos</h2>
        {!minhas.ok ? (
          <Aviso tipo="erro">{minhas.erro.mensagem}</Aviso>
        ) : minhas.valor.length === 0 ? (
          <p className="ajuda">Nenhum pedido até agora.</p>
        ) : (
          <ul className="lista-cartoes">
            {minhas.valor.map((s) => (
              <li key={s.id} className="cartao">
                <h3>{s.nomeSugerido}</h3>
                <p>
                  <SeloEstado rotulo={ROTULO[s.situacao]} />
                </p>
                {s.motivoResposta ? <p>{s.motivoResposta}</p> : null}
                <p className="ajuda">
                  Pedido em {formatarDataHora(s.criadoEm)}
                  {s.decididaEm ? ` · Respondido em ${formatarDataHora(s.decididaEm)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
