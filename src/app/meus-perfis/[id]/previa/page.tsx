import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoEnviarPerfil } from "../../../acoes-conteudo";
import { PerfilVisao } from "../../../_componentes/exibicao";
import { FormAcao } from "../../../_componentes/form-acao";
import { PainelPagina } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO, caminhosDoPerfil, categoriasParaTela } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Prévia do perfil | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** IM-017: o responsável confere o perfil como ele aparecerá, sem torná-lo público. */
export default async function PaginaPreviaPerfil({
  params,
}: PageProps<"/meus-perfis/[id]/previa">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-perfis/${id}/previa`);
  const r = await ctx.perfis.previa(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Prévia" atual="perfis">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const previa = r.valor;
  const [{ categorias }, urls] = await Promise.all([
    categoriasParaTela(ctx),
    ctx.assinarImagens(caminhosDoPerfil(previa.perfil)),
  ]);

  return (
    <PainelPagina titulo="Prévia do perfil" atual="perfis">
      <Aviso tipo="info">
        Esta é uma prévia: só você a vê. O perfil só aparece para o público depois de aprovado e
        publicado.
      </Aviso>
      <PerfilVisao perfil={previa.perfil} categorias={categorias} urls={urls} />

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
        <FormAcao acao={acaoEnviarPerfil} campos={{ id }} rotulo="Enviar para aprovação" />
      ) : null}
      {previa.situacaoVersao === "pendente" ? (
        <Aviso tipo="info">Esta versão já foi enviada e está em análise.</Aviso>
      ) : null}
      <p>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para editar
        </Link>
      </p>
    </PainelPagina>
  );
}
