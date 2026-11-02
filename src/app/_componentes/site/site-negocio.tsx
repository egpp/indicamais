/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { ReactNode } from "react";
import Link from "next/link";
import type { BeneficioPublico } from "@/modules/pontos";
import type { ItemExibicao } from "@/modules/catalogo";
import type { PerfilExibicao } from "@/modules/perfis";
import { AVISO_SEM_RESGATE, ListaBeneficiosPublicos } from "../pontos";
import { GradeCards, dadosDeItem, localTexto } from "../publico";
import { nomeDaCategoria, type CategoriaOpcao } from "../../_lib/apresentacao";
import { CarrosselBanner, type ImagemBanner } from "./carrossel-banner";
import type { EstiloId } from "./estilos";
import { classeDeFontes } from "./fontes";
import { MenuSite, type ItemMenuSite } from "./menu-site";
import "./site.css";

/**
 * Página do negócio como site de uma página (D-016; IM-091, IM-092, IM-093). Só apresentação: recebe modelos de
 * exibição já prontos (sem WhatsApp, responsável nem e-mail, IM-029) e peças já renderizadas (`contato`, `denunciar`).
 * O estilo é só uma classe de tema: o conteúdo não muda (IM-094 pendente).
 */
type Urls = Record<string, string>;

export type PropsSiteNegocio = {
  estilo: EstiloId;
  perfil: PerfilExibicao;
  itens: readonly ItemExibicao[];
  categorias: readonly CategoriaOpcao[];
  urls: Urls;
  beneficios: readonly BeneficioPublico[];
  /** Ações de contato: pedido de contato, Indique e Curtir (IM-013). */
  contato: ReactNode;
  denunciar?: ReactNode;
  /** PONTO DE ENCAIXE do mapa incorporado (IM-018, pendente). Hoje fica vazio. */
  mapa?: ReactNode;
};

/** Link simples para o endereço no mapa do celular (sem incorporar nada). */
export function linkComoChegar(endereco: string, local: string): string {
  const consulta = [endereco, local].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

/** Imagens do banner (IM-093): os banners do perfil; sem banner, a imagem principal. */
export function imagensDoBanner(perfil: PerfilExibicao, urls: Urls): ImagemBanner[] {
  const nome = perfil.nome ?? "Perfil";
  const banners = perfil.bannersPaths.flatMap((p, i) =>
    urls[p] ? [{ src: urls[p], alt: `Banner ${i + 1} de ${nome}` }] : [],
  );
  if (banners.length > 0) return banners;
  return perfil.imagemPath && urls[perfil.imagemPath]
    ? [{ src: urls[perfil.imagemPath], alt: `Imagem de ${nome}` }]
    : [];
}

export function SiteNegocio({
  estilo,
  perfil,
  itens,
  categorias,
  urls,
  beneficios,
  contato,
  denunciar,
  mapa,
}: PropsSiteNegocio) {
  const nome = perfil.nome ?? "Perfil sem nome";
  const local = localTexto(perfil.cidade, perfil.uf);
  const nomesCategorias = [perfil.categoriaPrincipalId, ...perfil.categoriasSecundariasIds]
    .filter((c): c is string => Boolean(c))
    .map((c) => nomeDaCategoria(c, [...categorias]));
  const banners = imagensDoBanner(perfil, urls);
  const avatar =
    perfil.bannersPaths.length > 0 && perfil.imagemPath ? urls[perfil.imagemPath] : undefined;
  const fotos = perfil.fotosPaths.flatMap((f, i) =>
    urls[f] ? [{ src: urls[f], alt: `Foto ${i + 1} de ${nome}` }] : [],
  );
  const temLocalizacao = Boolean(perfil.endereco || local);

  const menu: ItemMenuSite[] = [
    { id: "inicio", rotulo: "Início" },
    { id: "sobre", rotulo: "Sobre" },
    ...(itens.length > 0 ? [{ id: "produtos", rotulo: "Produtos e serviços" }] : []),
    ...(beneficios.length > 0 ? [{ id: "beneficios", rotulo: "Benefícios" }] : []),
    ...(temLocalizacao ? [{ id: "localizacao", rotulo: "Localização" }] : []),
    { id: "contato-site", rotulo: "Contato" },
  ];

  return (
    <div
      className={`site site-${estilo} ${classeDeFontes(estilo)}`}
      data-estilo={estilo}
      data-testid="site-negocio"
    >
      <MenuSite nome={nome} itens={menu} />
      <main id="conteudo-site">
        <section id="inicio" className="st-secao st-inicio" aria-labelledby="titulo-perfil">
          {banners.length > 0 ? (
            <CarrosselBanner imagens={banners} rotulo={`Banners de ${nome}`} />
          ) : (
            <div className="st-banner-vazio" aria-hidden="true" />
          )}
          <div className="st-identidade">
            {avatar ? <img className="st-avatar" src={avatar} alt={`Imagem de ${nome}`} /> : null}
            <div className="st-identidade-texto">
              {nomesCategorias.length > 0 ? (
                <p className="st-sobretitulo">{nomesCategorias[0]}</p>
              ) : null}
              <h1 id="titulo-perfil">{nome}</h1>
              {local ? <p className="st-local">{local}</p> : null}
              <p className="st-acoes-inicio">
                <a className="botao" href="#contato-site">
                  Falar com a empresa
                </a>
                {itens.length > 0 ? (
                  <a className="botao botao-secundario" href="#produtos">
                    Ver produtos e serviços
                  </a>
                ) : null}
              </p>
            </div>
          </div>
        </section>

        <section id="sobre" className="st-secao" aria-labelledby="titulo-sobre">
          <h2 id="titulo-sobre">Sobre</h2>
          {perfil.descricaoBreve ? (
            <p className="st-texto">{perfil.descricaoBreve}</p>
          ) : (
            <p className="ajuda">Este negócio ainda não escreveu uma descrição.</p>
          )}
          {nomesCategorias.length > 0 ? (
            <>
              <h3 className="st-rotulo">Categorias</h3>
              <ul className="st-chips">
                {nomesCategorias.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
          {perfil.areasAtendidas.length > 0 ? (
            <>
              <h3 className="st-rotulo">Áreas atendidas</h3>
              <ul className="st-chips">
                {perfil.areasAtendidas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          ) : null}
          {perfil.site ? (
            <p className="st-linha">
              <strong>Site:</strong> {perfil.site}
            </p>
          ) : null}
          {perfil.informacoesSociais ? (
            <p className="st-linha">{perfil.informacoesSociais}</p>
          ) : null}
          {fotos.length > 0 ? (
            <ul className="st-fotos" aria-label={`Fotos de ${nome}`}>
              {fotos.map((f) => (
                <li key={f.src}>
                  <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {itens.length > 0 ? (
          <section id="produtos" className="st-secao" aria-labelledby="titulo-itens">
            <h2 id="titulo-itens">Produtos e serviços</h2>
            <GradeCards
              cards={itens.map((i) => dadosDeItem(i, [...categorias], local))}
              urls={urls}
            />
          </section>
        ) : null}

        {beneficios.length > 0 ? (
          <section id="beneficios" className="st-secao" aria-labelledby="titulo-beneficios">
            <h2 id="titulo-beneficios">Benefícios em pontos</h2>
            <p className="ajuda">{AVISO_SEM_RESGATE}</p>
            <ListaBeneficiosPublicos beneficios={[...beneficios]} />
          </section>
        ) : null}

        {temLocalizacao ? (
          <section id="localizacao" className="st-secao" aria-labelledby="titulo-localizacao">
            <h2 id="titulo-localizacao">Localização</h2>
            {perfil.endereco ? <p className="st-texto">{perfil.endereco}</p> : null}
            {local ? <p className="st-local">{local}</p> : null}
            {perfil.endereco ? (
              <p>
                <a
                  className="botao botao-secundario st-botao-auto"
                  href={linkComoChegar(perfil.endereco, local)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Como chegar<span className="sr-only"> (abre o mapa em outra aba)</span>
                </a>
              </p>
            ) : null}
            {/* Ponto de encaixe do mapa incorporado: IM-018 segue pendente (fornecedor não escolhido). */}
            {mapa ?? null}
          </section>
        ) : null}

        <section id="contato-site" className="st-secao" aria-labelledby="titulo-contato-site">
          <h2 id="titulo-contato-site">Contato</h2>
          {contato}
        </section>
      </main>

      <footer className="st-rodape">
        <p className="st-rodape-nome">{nome}</p>
        {local ? <p>{local}</p> : null}
        {denunciar}
        <p className="rodape-links">
          Página feita no <Link href="/">IndicaMais</Link>
        </p>
      </footer>
    </div>
  );
}
