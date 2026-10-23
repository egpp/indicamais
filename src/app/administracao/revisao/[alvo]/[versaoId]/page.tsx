import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALVOS_REVISAO, type AlvoRevisao } from "@/modules/administracao";
import { ItemVisao, PerfilVisao } from "../../../../_componentes/exibicao";
import { FormDecidirRevisao } from "../../../../_componentes/form-administracao";
import { PainelPagina } from "../../../../_componentes/painel";
import { Aviso } from "../../../../_componentes/ui";
import { formatarDataHora } from "../../../../_lib/apresentacao";
import { obterContexto } from "../../../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../../../_lib/pagina";
import { carregarConteudoRevisao } from "../../../../_lib/revisao-conteudo";

export const metadata: Metadata = { title: "Revisar conteúdo | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ehAlvo = (v: string): v is AlvoRevisao => (ALVOS_REVISAO as readonly string[]).includes(v);

export default async function PaginaRevisar({
  params,
}: PageProps<"/administracao/revisao/[alvo]/[versaoId]">) {
  const { alvo, versaoId } = await params;
  const ctx = await obterContexto(`/administracao/revisao/${alvo}/${versaoId}`);
  if (!ehAlvo(alvo) || !(await ctx.ehAdministrador())) notFound();

  const fila = await ctx.administracao.listarFila();
  const naFila = fila.ok
    ? fila.valor.find((i) => i.versaoId === versaoId && i.alvo === alvo)
    : null;
  const voltar = (
    <p>
      <Link className="botao botao-secundario" href="/administracao/revisao">
        Voltar para a fila
      </Link>
    </p>
  );
  if (!fila.ok) {
    return (
      <PainelPagina titulo="Revisar conteúdo" admin atual="administracao">
        <Aviso tipo="erro">{fila.erro.mensagem}</Aviso>
        {voltar}
      </PainelPagina>
    );
  }
  if (!naFila) {
    return (
      <PainelPagina titulo="Revisar conteúdo" admin atual="administracao">
        <Aviso tipo="info">Este conteúdo não está mais aguardando revisão.</Aviso>
        {voltar}
      </PainelPagina>
    );
  }

  const [conteudo, todas] = await Promise.all([
    carregarConteudoRevisao(ctx, alvo, versaoId),
    ctx.revisao.listarTodasCategorias(),
  ]);
  const categorias = (todas.dados ?? []).map((c) => ({ id: c.id, nome: c.nome }));
  const urls = conteudo ? await ctx.assinarImagens(conteudo.caminhos) : {};

  return (
    <PainelPagina titulo="Revisar conteúdo" admin atual="administracao">
      <p className="ajuda">
        Enviado em {formatarDataHora(naFila.enviadaEm)}
        {naFila.ehEdicao ? " · Edição de conteúdo já aprovado (a versão aprovada segue no ar)" : ""}
      </p>
      {conteudo === null ? (
        <Aviso tipo="erro">
          Não foi possível carregar o conteúdo. Tente novamente em instantes.
        </Aviso>
      ) : conteudo.tipo === "perfil" ? (
        <PerfilVisao perfil={conteudo.perfil} categorias={categorias} urls={urls} />
      ) : (
        <ItemVisao item={conteudo.item} categorias={categorias} urls={urls} />
      )}

      {naFila.proprio ? (
        <Aviso tipo="info">Este conteúdo é seu. Outro administrador precisa revisá-lo.</Aviso>
      ) : (
        <>
          <section aria-labelledby="titulo-aprovar">
            <h2 id="titulo-aprovar">Aprovar</h2>
            <FormDecidirRevisao modo="aprovar" alvo={alvo} versaoId={versaoId} />
          </section>
          <section aria-labelledby="titulo-rejeitar">
            <h2 id="titulo-rejeitar">Rejeitar</h2>
            <FormDecidirRevisao modo="rejeitar" alvo={alvo} versaoId={versaoId} />
          </section>
        </>
      )}
      {voltar}
    </PainelPagina>
  );
}
