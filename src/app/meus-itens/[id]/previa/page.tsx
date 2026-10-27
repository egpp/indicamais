import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoEnviarItem } from "../../../acoes-conteudo";
import { ItemVisao } from "../../../_componentes/exibicao";
import { FormAcao } from "../../../_componentes/form-acao";
import { PainelPagina } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO, categoriasParaTela } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Prévia do item | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** IM-017: o responsável confere o item como ele aparecerá, sem torná-lo público. */
export default async function PaginaPreviaItem({ params }: PageProps<"/meus-itens/[id]/previa">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-itens/${id}/previa`);
  const r = await ctx.itens.previa(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Prévia" atual="itens">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const previa = r.valor;
  const [{ categorias }, urls] = await Promise.all([
    categoriasParaTela(ctx),
    ctx.assinarImagens(previa.item.fotoPath ? [previa.item.fotoPath] : []),
  ]);
  return (
    <PainelPagina titulo="Prévia" atual={previa.item.anuncioParticular ? "anuncios" : "itens"}>
      <Aviso tipo="info">
        Esta é uma prévia: só você a vê. O item só aparece para o público depois de aprovado e
        publicado.
      </Aviso>
      <ItemVisao item={previa.item} categorias={categorias} urls={urls} />
      {previa.pendencias.length > 0 ? (
        <Aviso tipo="info">
          Para enviar para aprovação, falta:
          <ul>
            {previa.pendencias.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}
      {previa.podeEnviar ? (
        <FormAcao acao={acaoEnviarItem} campos={{ id }} rotulo="Enviar para aprovação" />
      ) : null}
      {previa.situacaoVersao === "pendente" ? (
        <Aviso tipo="info">Esta versão já foi enviada e está em análise.</Aviso>
      ) : null}
      <p>
        <Link className="botao botao-secundario" href={`/meus-itens/${id}`}>
          Voltar para editar
        </Link>
      </p>
    </PainelPagina>
  );
}
