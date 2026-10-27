import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoDespublicarItem, acaoEnviarItem, acaoPublicarItem } from "../../acoes-conteudo";
import { FormAcao } from "../../_componentes/form-acao";
import { FormEditarItem, FormFotoItem } from "../../_componentes/form-item";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { ROTULO_TIPO_ITEM, formatarDataHora, motivoParaExibir } from "../../_lib/apresentacao";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO, categoriasParaTela, imagensDoCampo, um } from "../../_lib/pagina";
import { valoresIniciaisItem } from "../../_lib/valores-iniciais";

export const metadata: Metadata = { title: "Item | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

export default async function PaginaItem({ params, searchParams }: PageProps<"/meus-itens/[id]">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-itens/${id}`);
  const r = await ctx.itens.obter(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Item" atual="itens">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const it = r.valor;
  const c = it.conteudoEdicao;
  const aviso = um((await searchParams).aviso);
  const [{ categorias, erro: erroCategorias }, resultados, urls] = await Promise.all([
    categoriasParaTela(ctx),
    ctx.administracao.listarMeusResultados(),
    ctx.assinarImagens(c.fotoPath ? [c.fotoPath] : []),
  ]);
  const rejeicao =
    it.estado.ultimaRejeitada && resultados.ok
      ? resultados.valor.find(
          (x) => x.alvo === "item" && x.alvoId === it.id && x.situacao === "rejeitado",
        )
      : undefined;
  const emAnalise = it.estado.aberta === "pendente";
  const rascunho = it.estado.aberta === "rascunho";
  const secao = it.anuncioParticular ? "anuncios" : "itens";

  return (
    <PainelPagina titulo={c.nome ?? "Item sem nome"} atual={secao}>
      <p>
        <SeloEstado rotulo={it.estado.rotulo} />{" "}
        <span className="ajuda">
          {it.anuncioParticular ? "Anúncio particular" : ROTULO_TIPO_ITEM[it.tipo]}
        </span>
      </p>

      {aviso === "criado" ? (
        <Aviso tipo="sucesso">
          Rascunho criado. Envie a foto abaixo, confira a prévia e envie para aprovação.
        </Aviso>
      ) : null}
      {erroCategorias ? <Aviso tipo="erro">{erroCategorias}</Aviso> : null}
      {it.versaoAprovadaId && it.estado.aberta ? (
        <Aviso tipo="info">
          {it.estado.noAr
            ? "A versão aprovada continua no ar enquanto esta edição não for aprovada."
            : "A versão aprovada continua valendo, mas está despublicada. Aprovar a edição não a publica de novo."}
        </Aviso>
      ) : null}
      {emAnalise ? (
        <Aviso tipo="info">Em análise. Você poderá editar depois da decisão.</Aviso>
      ) : null}
      {rejeicao ? (
        <Aviso tipo="erro">
          <p>Rejeitado em {formatarDataHora(rejeicao.decididaEm)}.</p>
          {motivoParaExibir(rejeicao.motivo) ? (
            <p className="motivo-rejeicao">
              <strong>Motivo:</strong> {motivoParaExibir(rejeicao.motivo)}
            </p>
          ) : null}
          <p>Ajuste e envie novamente.</p>
        </Aviso>
      ) : null}

      <section aria-labelledby="titulo-acoes">
        <h2 id="titulo-acoes">Ações</h2>
        <p>
          <Link className="botao botao-secundario" href={`/meus-itens/${it.id}/previa`}>
            Ver prévia
          </Link>
        </p>
        {rascunho && it.pendencias.length === 0 ? (
          <FormAcao acao={acaoEnviarItem} campos={{ id: it.id }} rotulo="Enviar para aprovação" />
        ) : null}
        {rascunho && it.pendencias.length > 0 ? (
          <Aviso tipo="info">
            Para enviar para aprovação, falta:
            <ul>
              {it.pendencias.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {it.versaoAprovadaId && !it.publicado ? (
          <FormAcao
            acao={acaoPublicarItem}
            campos={{ id: it.id }}
            rotulo="Publicar"
            rotuloEnviando="Publicando..."
          />
        ) : null}
        {it.publicado ? (
          <FormAcao
            acao={acaoDespublicarItem}
            campos={{ id: it.id }}
            rotulo="Despublicar"
            rotuloEnviando="Despublicando..."
            secundario
          />
        ) : null}
      </section>

      {emAnalise ? null : (
        <>
          <section aria-labelledby="titulo-dados">
            <h2 id="titulo-dados">Dados</h2>
            {it.versaoAprovadaId && !rascunho ? (
              <p className="ajuda">
                Ao salvar, criamos uma nova versão para aprovação. A versão aprovada continua no ar.
              </p>
            ) : null}
            <FormEditarItem
              itemId={it.id}
              inicial={valoresIniciaisItem(c)}
              categorias={categorias}
            />
            <p className="rodape-links">
              Não encontrou a categoria? <Link href="/solicitar-categoria">Peça uma nova</Link>.
            </p>
          </section>
          <section aria-labelledby="titulo-foto">
            <h2 id="titulo-foto">Foto</h2>
            <FormFotoItem
              itemId={it.id}
              foto={imagensDoCampo(c.fotoPath ? [c.fotoPath] : [], urls)}
            />
          </section>
        </>
      )}
      <p className="rodape-links">
        <Link href={it.anuncioParticular ? "/meus-anuncios" : "/meus-itens"}>
          Voltar para a lista
        </Link>
      </p>
    </PainelPagina>
  );
}
