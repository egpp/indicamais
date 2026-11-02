import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoEnviarPerfil } from "../../../acoes-conteudo";
import { PerfilVisao } from "../../../_componentes/exibicao";
import { FormAcao } from "../../../_componentes/form-acao";
import { PainelPagina } from "../../../_componentes/painel";
import { TEMAS, estiloLiberadoOuNulo } from "../../../_componentes/site/estilos";
import {
  FormularioExemplo,
  demonstracaoDoEstilo,
  perfilSemConteudo,
} from "../../../_componentes/site/demonstracao";
import { SiteNegocio } from "../../../_componentes/site/site-negocio";
import { Aviso } from "../../../_componentes/ui";
import { bannersDaPrevia, separarBanners } from "../../../_lib/banners-do-perfil";
import { obterContextoAparencia } from "../../../_lib/contexto-aparencia";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO, caminhosDoPerfil, categoriasParaTela, um } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Prévia do perfil | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** IM-017: o responsável confere o perfil como ele aparecerá, sem torná-lo público. */
export default async function PaginaPreviaPerfil({
  params,
  searchParams,
}: PageProps<"/meus-perfis/[id]/previa">) {
  const { id } = await params;
  const estilo = estiloLiberadoOuNulo(um((await searchParams).estilo));
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

  // D-016: prévia da página como site, num estilo escolhido na Aparência. Nada é gravado.
  if (estilo) {
    // Sem conteúdo próprio, a prévia usa um negócio de EXEMPLO (marcado na tela); produtos e benefícios reais só
    // existem na página publicada, então aqui eles são sempre de exemplo.
    const semConteudo = perfilSemConteudo(previa.perfil);
    const demo = demonstracaoDoEstilo(estilo, semConteudo ? undefined : previa.perfil);
    const perfilDaPagina = semConteudo ? demo.perfil : previa.perfil;
    const [meu, aparencia] = await Promise.all([
      ctx.perfis.obter(id),
      obterContextoAparencia(`/meus-perfis/${id}/previa`),
    ]);
    const listaBanners = meu.ok ? await aparencia.servico.bannersDoMeuPerfil(id) : null;
    const banners =
      meu.ok && listaBanners && listaBanners.ok
        ? bannersDaPrevia(
            separarBanners(
              listaBanners.valor,
              meu.valor.versaoAbertaId,
              meu.valor.versaoAprovadaId,
            ),
          )
        : [];
    const urlsBanners = await ctx.assinarImagens(banners.map((b) => b.imagemPath));
    return (
      <>
        <div className="cabecalho-site">
          <Aviso tipo="info">
            Prévia do estilo {TEMAS[estilo].rotulo}: só você vê.{" "}
            {semConteudo
              ? "Seu perfil ainda não tem nome e descrição, então a página mostra um negócio de exemplo."
              : "Os produtos e os benefícios aparecem aqui como exemplo; os de verdade aparecem na página publicada."}{" "}
            Os botões de contato funcionam só na página publicada.
          </Aviso>
          <p className="acoes-linha">
            <Link className="botao botao-secundario" href={`/meus-perfis/${id}/aparencia`}>
              Voltar para Aparência
            </Link>
          </p>
        </div>
        <SiteNegocio
          estilo={estilo}
          perfil={perfilDaPagina}
          itens={demo.itens}
          categorias={semConteudo ? demo.categorias : categorias}
          urls={{ ...urls, ...demo.urls, ...urlsBanners }}
          banners={banners}
          beneficios={demo.beneficios}
          exemplo={{ perfil: semConteudo, itens: true, beneficios: true }}
          contato={<FormularioExemplo />}
        />
      </>
    );
  }

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
