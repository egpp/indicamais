/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LIMITE_BANNERS } from "@/modules/perfis";
import { rotuloDestinoBanner } from "../../../_componentes/banners-comum";
import {
  AlternarBanner,
  EditorBanners,
  RespostaBanner,
  type BannerNaTela,
} from "../../../_componentes/form-aparencia";
import { PainelPagina } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { separarBanners } from "../../../_lib/banners-do-perfil";
import { obterContextoAparencia } from "../../../_lib/contexto-aparencia";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Banners da página | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * Banners da página do negócio (D-016; IM-093). O responsável monta a lista (até 6), grava no rascunho e envia o
 * perfil para aprovação pelo fluxo normal; aceita ou recusa propostas do administrador e pode ocultar as aceitas.
 * Perfil de outra pessoa responde 404.
 */
export default async function PaginaBannersDoPerfil({
  params,
}: PageProps<"/meus-perfis/[id]/banners">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-perfis/${id}/banners`);
  const r = await ctx.perfis.obter(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Banners da página" atual="aparencia">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const p = r.valor;
  const nome = p.conteudoEdicao.nome ?? "Site sem nome";
  const { servico } = await obterContextoAparencia(`/meus-perfis/${id}/banners`);
  const lista = await servico.bannersDoMeuPerfil(id);
  if (!lista.ok) {
    return (
      <PainelPagina titulo="Banners da página" atual="aparencia">
        <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const sep = separarBanners(lista.valor, p.versaoAbertaId, p.versaoAprovadaId);
  const urls = await ctx.assinarImagens(
    [...sep.proprios, ...sep.aguardando, ...sep.aceitos].map((b) => b.imagemPath),
  );
  const emAnalise = p.estado.aberta === "pendente";
  const inicial: BannerNaTela[] = sep.proprios.map((b) => ({
    caminho: b.imagemPath,
    url: urls[b.imagemPath] ?? null,
    alt: b.textoAlternativo,
    destino: b.destinoSecao,
    ativo: b.ativo,
  }));

  return (
    <PainelPagina
      titulo="Banners da página"
      subtitulo={`Imagens que giram no topo da página de ${nome}.`}
      atual="aparencia"
    >
      {sep.aguardando.length > 0 ? (
        <section aria-labelledby="titulo-propostas">
          <h2 id="titulo-propostas">Propostas do administrador aguardando seu aceite</h2>
          <p className="ajuda">
            O administrador sugeriu estas imagens. Elas só aparecem na sua página se você aceitar.
          </p>
          <ul className="lista-cartoes">
            {sep.aguardando.map((b) => (
              <li key={b.id} className="cartao banner-proposta">
                {urls[b.imagemPath] ? (
                  <img
                    className="banner-previa-admin"
                    src={urls[b.imagemPath]}
                    alt={b.textoAlternativo}
                  />
                ) : (
                  <span className="imagem-indisponivel">Imagem sem prévia</span>
                )}
                <p>{b.textoAlternativo}</p>
                <p className="ajuda">Leva para: {rotuloDestinoBanner(b.destinoSecao)}</p>
                <RespostaBanner bannerId={b.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titulo-meus-banners">
        <h2 id="titulo-meus-banners">Seus banners</h2>
        <p className="ajuda">
          Você pode ter até {LIMITE_BANNERS} banners no total, contando os do administrador que você
          aceitou. As imagens giram devagar e a pessoa pode pausar. Sem banner, a página mostra a
          imagem principal do site.
        </p>
        {emAnalise ? (
          <Aviso tipo="info">
            A versão atual do site está em análise. Você poderá mudar os banners quando o resultado
            sair.
          </Aviso>
        ) : (
          <Aviso tipo="info">
            Salvar grava no rascunho do site. A mudança só vai ao ar depois que você enviar o site
            para aprovação.
          </Aviso>
        )}
        <EditorBanners
          perfilId={id}
          inicial={inicial}
          limite={sep.limiteProprio}
          somenteLeitura={emAnalise}
        />
        {!emAnalise ? (
          <p>
            <Link className="botao botao-secundario" href={`/meus-perfis/${id}/previa`}>
              Enviar para aprovação (na prévia)
            </Link>
          </p>
        ) : null}
      </section>

      {sep.aceitos.length > 0 ? (
        <section aria-labelledby="titulo-aceitos">
          <h2 id="titulo-aceitos">Banners do administrador que você aceitou</h2>
          <ul className="lista-cartoes">
            {sep.aceitos.map((b) => (
              <li key={b.id} className="cartao banner-proposta">
                {urls[b.imagemPath] ? (
                  <img className="banner-previa-admin" src={urls[b.imagemPath]} alt="" />
                ) : null}
                <p>{b.textoAlternativo}</p>
                <p className="ajuda">{b.ativo ? "Aparece na página." : "Oculto da página."}</p>
                <AlternarBanner bannerId={b.id} ativo={b.ativo} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="acoes-linha">
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}/aparencia`}>
          Estilo da página
        </Link>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para o site
        </Link>
      </p>
    </PainelPagina>
  );
}
