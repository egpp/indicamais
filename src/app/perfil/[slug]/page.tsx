/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPublico, GradeCards, dadosDeItem, localTexto } from "../../_componentes/publico";
import { nomeDaCategoria } from "../../_lib/apresentacao";
import { SEM_INDEXACAO } from "../../_lib/pagina";
import { carregarPerfilPublico } from "../../_lib/paginas-publicas";
import { DESCRICAO_PADRAO, metadadosPublicos, resumir } from "../../_lib/metadados-publicos";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";

/**
 * Perfil comercial público (IM-011, IM-012, IM-014, IM-079). Renderizado no servidor, com Open Graph e Twitter
 * para a prévia no WhatsApp. Só aparece o que está aprovado, publicado e disponível; o resto é 404 genérico.
 * Sem WhatsApp, responsável nem e-mail, e sem botão de contato, indicar ou curtir (Fase 3).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/perfil/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = await carregarPerfilPublico(slug);
  if (!d) return { title: "Página não encontrada | IndicaMais", ...SEM_INDEXACAO };
  const p = d.perfil;
  const nome = p.nome ?? "Perfil";
  const local = localTexto(p.cidade, p.uf);
  const imagemUrl = p.imagemPath ? d.urls[p.imagemPath] : null;
  return metadadosPublicos({
    titulo: `${nome} | IndicaMais`,
    descricao:
      resumir(p.descricaoBreve) ??
      resumir(local ? `${nome} em ${local}. Veja no IndicaMais.` : DESCRICAO_PADRAO) ??
      DESCRICAO_PADRAO,
    caminho: ROTAS_PUBLICAS.perfil(p.slug),
    imagemUrl,
    imagemAlt: `Imagem de ${nome}`,
  });
}

export default async function PaginaPerfilPublico({ params }: PageProps<"/perfil/[slug]">) {
  const { slug } = await params;
  const d = await carregarPerfilPublico(slug);
  if (!d) notFound();
  const { perfil, itens, categorias, urls } = d;
  const nome = perfil.nome ?? "Perfil sem nome";
  const local = localTexto(perfil.cidade, perfil.uf);
  const imagem = perfil.imagemPath ? urls[perfil.imagemPath] : undefined;
  const nomesCategorias = [perfil.categoriaPrincipalId, ...perfil.categoriasSecundariasIds]
    .filter((c): c is string => Boolean(c))
    .map((c) => nomeDaCategoria(c, categorias));

  return (
    <main className="pagina pagina-publica">
      <CabecalhoPublico />
      <article className="visao-publica" aria-labelledby="titulo-perfil">
        {perfil.bannersPaths.map((b, i) =>
          urls[b] ? <img key={b} src={urls[b]} alt={`Banner ${i + 1} de ${nome}`} /> : null,
        )}
        {imagem ? (
          <div className="imagem-principal">
            <img src={imagem} alt={`Imagem de ${nome}`} />
          </div>
        ) : null}
        <h1 id="titulo-perfil">{nome}</h1>
        {nomesCategorias.length > 0 ? (
          <p className="categorias">
            <strong>{nomesCategorias[0]}</strong>
            {nomesCategorias.slice(1).map((c) => (
              <span key={c}> · {c}</span>
            ))}
          </p>
        ) : null}
        {local ? <p>{local}</p> : null}
        {perfil.descricaoBreve ? <p className="texto-corrido">{perfil.descricaoBreve}</p> : null}
        <dl className="lista-dados">
          {perfil.endereco ? (
            <>
              <dt>Endereço</dt>
              <dd>{perfil.endereco}</dd>
            </>
          ) : null}
          {perfil.areasAtendidas.length > 0 ? (
            <>
              <dt>Áreas atendidas</dt>
              <dd>{perfil.areasAtendidas.join(", ")}</dd>
            </>
          ) : null}
          {perfil.site ? (
            <>
              <dt>Site</dt>
              <dd>{perfil.site}</dd>
            </>
          ) : null}
          {perfil.informacoesSociais ? (
            <>
              <dt>Redes sociais</dt>
              <dd>{perfil.informacoesSociais}</dd>
            </>
          ) : null}
        </dl>
        {perfil.fotosPaths.length > 0 ? (
          <div className="visao-fotos">
            {perfil.fotosPaths.map((f, i) =>
              urls[f] ? (
                <img key={f} src={urls[f]} alt={`Foto ${i + 1} de ${nome}`} loading="lazy" />
              ) : null,
            )}
          </div>
        ) : null}
      </article>

      <section aria-labelledby="titulo-itens">
        <h2 id="titulo-itens">Produtos e serviços</h2>
        {itens.length === 0 ? (
          <p className="ajuda">Este perfil ainda não publicou produtos ou serviços.</p>
        ) : (
          <GradeCards cards={itens.map((i) => dadosDeItem(i, categorias, local))} urls={urls} />
        )}
      </section>
      <p className="rodape-links">
        <Link href="/">Voltar para a página inicial</Link>
      </p>
    </main>
  );
}
