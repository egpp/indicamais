/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { ReactNode } from "react";
import Link from "next/link";
import type { BeneficioPublico } from "@/modules/pontos";
import type { ItemExibicao } from "@/modules/catalogo";
import type { BannerPublico, DestinoSecaoBanner, MapaUrls, PerfilExibicao } from "@/modules/perfis";
import { AVISO_SEM_RESGATE, ListaBeneficiosPublicos } from "../pontos";
import { dadosDeItem, localTexto, type DadosCard } from "../publico";
import { nomeDaCategoria, type CategoriaOpcao } from "../../_lib/apresentacao";
import { detalhesDoItem, type DetalhesItem } from "../../_lib/detalhes-item";
import { AcaoCompra } from "./acao-compra";
import { resolverAcaoCompra } from "./acao-compra-regras";
import { PainelSacola } from "./painel-sacola";
import { CarrosselBanner, type ImagemBanner } from "./carrossel-banner";
import type { EstiloId } from "./estilos";
import { classeDeFontes } from "./fontes";
import { MapaLocalizacao } from "./mapa-localizacao";
import { Decoracao, FaixaDecorativa, Icone, type NomeIcone } from "./icones";
import { MenuSite, type ItemMenuSite } from "./menu-site";
import "./site.css";
import "./site-estilos.css";
import "./site-estilos-novos.css";

/**
 * Página do negócio como site de uma página (D-016; IM-091, IM-092, IM-093). Só apresentação: recebe modelos de
 * exibição já prontos (sem WhatsApp, responsável nem e-mail, IM-029) e peças já renderizadas (`contato`, `denunciar`).
 * O estilo muda a aparência E a composição (CSS por tema), nunca o conteúdo (IM-094).
 * `exemplo` marca partes de demonstração (prévia do painel): aparecem com a etiqueta "Exemplo" e sem links.
 */
type Urls = Record<string, string>;

export type PropsSiteNegocio = {
  estilo: EstiloId;
  perfil: PerfilExibicao;
  itens: readonly ItemExibicao[];
  categorias: readonly CategoriaOpcao[];
  urls: Urls;
  beneficios: readonly BeneficioPublico[];
  /** Banners no ar (IM-093), em ordem. Sem eles, a imagem principal do perfil; sem ela, fundo de marca. */
  banners?: readonly BannerPublico[];
  /** Ações de contato: pedido de contato, Indique e Curtir (IM-013). */
  contato: ReactNode;
  denunciar?: ReactNode;
  /** Mapa do OpenStreetMap (IM-018): URLs prontas do módulo perfis. Sem isso, só endereço e "Como chegar" por busca. */
  mapa?: MapaUrls | null;
  /**
   * Loja liberada para o perfil (IM-097, D-020): a seção "Produtos e serviços" vira "Loja". `filtros` é a peça
   * já renderizada (servidor); `filtroAtivo` mantém a seção visível mesmo sem resultado; `erro` é a mensagem do
   * filtro. Catálogo, não venda: sem carrinho nem pagamento (IM-090).
   */
  loja?: { filtros?: ReactNode; filtroAtivo?: boolean; erro?: string | null } | null;
  /**
   * Equipe do negócio: nome e cargo, sem foto de pessoa (D-023). Só aparece se vier
   * preenchida; ainda não há cadastro no perfil (pendente, ver docs/lacunas-modelos.md A7).
   */
  equipe?: readonly { nome: string; cargo: string }[];
  /** Partes que são demonstração (prévia): ganham a etiqueta "Exemplo" e não viram links. */
  exemplo?: { perfil?: boolean; itens?: boolean; beneficios?: boolean };
};

/** Link simples para o endereço no mapa do celular (sem incorporar nada; o mapa incorporado vem com IM-018). */
export function linkComoChegar(endereco: string, local: string): string {
  const consulta = [endereco, local].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

const ID_DA_SECAO: Record<DestinoSecaoBanner, string> = {
  inicio: "inicio",
  sobre: "sobre",
  produtos_servicos: "produtos",
  beneficios: "beneficios",
  localizacao: "localizacao",
  contato: "contato-site",
};

/**
 * Imagens do banner (IM-093): os banners no ar; sem banner, a imagem principal. O destino só vale se a seção
 * existir na página (senão a imagem não vira link).
 */
export function imagensDoBanner(
  banners: readonly BannerPublico[],
  perfil: PerfilExibicao,
  urls: Urls,
  secoes: ReadonlySet<string> = new Set(Object.values(ID_DA_SECAO)),
): ImagemBanner[] {
  const nome = perfil.nome ?? "Perfil";
  const dosBanners = banners.flatMap((b) => {
    const src = urls[b.imagemPath];
    if (!src) return [];
    const alvo = b.destinoSecao ? ID_DA_SECAO[b.destinoSecao] : null;
    return [
      {
        src,
        alt: b.textoAlternativo,
        ...(alvo && secoes.has(alvo) ? { href: `#${alvo}` } : {}),
      },
    ];
  });
  if (dosBanners.length > 0) return dosBanners;
  return perfil.imagemPath && urls[perfil.imagemPath]
    ? [{ src: urls[perfil.imagemPath], alt: `Imagem de ${nome}` }]
    : [];
}

function Selo() {
  return <span className="st-selo-exemplo">Exemplo</span>;
}

function Secao({
  id,
  tituloId,
  titulo,
  icone,
  numero,
  alt,
  exemplo,
  children,
}: {
  id: string;
  tituloId: string;
  titulo: string;
  icone: NomeIcone;
  numero: number;
  alt: boolean;
  exemplo?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`st-faixa st-secao-${id}${alt ? " st-faixa-alt" : ""}`}
      aria-labelledby={tituloId}
    >
      <div className="st-miolo">
        <header className="st-cab">
          <span className="st-icone" aria-hidden="true">
            <Icone nome={icone} />
          </span>
          <span className="st-numero" aria-hidden="true">
            {String(numero).padStart(2, "0")}
          </span>
          <h2 id={tituloId}>{titulo}</h2>
          {exemplo ? <Selo /> : null}
        </header>
        {children}
      </div>
    </section>
  );
}

function CartaoItem({
  dados,
  url,
  exemplo,
  variacoes = [],
  acao,
}: {
  dados: DadosCard;
  url?: string;
  exemplo: boolean;
  variacoes?: DetalhesItem["variacoes"];
  /** Botão da ação de compra (ver `AcaoCompra`); ausente na demonstração. */
  acao?: ReactNode;
}) {
  return (
    <article className="st-card">
      <div className="st-card-imagem">
        {url ? (
          <img src={url} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="st-card-sem-imagem" aria-hidden="true">
            <Icone nome="produtos" />
          </span>
        )}
        {dados.precoTexto ? <p className="st-card-preco">{dados.precoTexto}</p> : null}
      </div>
      <div className="st-card-corpo">
        <p className="st-card-tipo">{dados.rotuloTipo}</p>
        <h3>
          {exemplo ? (
            dados.nome
          ) : (
            <Link className="card-link" href={dados.link}>
              {dados.nome}
            </Link>
          )}
        </h3>
        {dados.descricao ? <p className="st-card-desc">{dados.descricao}</p> : null}
        {dados.chips && dados.chips.length > 0 ? (
          <ul className="st-chips st-chips-imovel" aria-label="Características do imóvel">
            {dados.chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {variacoes.map((g) => (
          <p className="st-card-meta st-variacoes" key={g.rotulo}>
            <strong>{rotuloPlural(g)}:</strong> {g.opcoes.join(", ")}
          </p>
        ))}
        {dados.categoria ? <p className="st-card-meta">{dados.categoria}</p> : null}
        {dados.local && dados.chips && dados.chips.length > 0 ? (
          <p className="st-card-meta">{dados.local}</p>
        ) : null}
        {acao}
      </div>
    </article>
  );
}

const rotuloPlural = (g: DetalhesItem["variacoes"][number]) =>
  g.opcoes.length < 2
    ? g.rotulo
    : g.rotulo === "Cor"
      ? "Cores"
      : g.rotulo === "Tamanho"
        ? "Tamanhos"
        : g.rotulo;

type Destaque = { icone: NomeIcone; rotulo: string; valor: string };

export function SiteNegocio({
  estilo,
  perfil,
  itens,
  categorias,
  urls,
  beneficios,
  banners = [],
  contato,
  denunciar,
  mapa = null,
  loja = null,
  equipe = [],
  exemplo = {},
}: PropsSiteNegocio) {
  const nome = perfil.nome ?? "Perfil sem nome";
  const local = localTexto(perfil.cidade, perfil.uf);
  const nomesCategorias = [perfil.categoriaPrincipalId, ...perfil.categoriasSecundariasIds]
    .filter((c): c is string => Boolean(c))
    .map((c) => nomeDaCategoria(c, [...categorias]));
  const temLocalizacao = Boolean(perfil.endereco || local);
  // Planos do negócio (D-023): vitrine de itens com "Periodicidade:", só com a Loja liberada
  // (D-022). Saem do catálogo comum para não aparecerem duas vezes.
  const detalhes = new Map(itens.map((i) => [i.id, detalhesDoItem(i.descricao)] as const));
  const planos = loja ? itens.filter((i) => detalhes.get(i.id)?.periodicidade) : [];
  const idsPlanos = new Set(planos.map((p) => p.id));
  const itensCatalogo = itens.filter((i) => !idsPlanos.has(i.id));
  const temPlanos = planos.length > 0;
  const temEquipe = equipe.length > 0;
  const temSacola = !exemplo.itens;
  const temItens = itensCatalogo.length > 0 || Boolean(loja?.filtroAtivo);
  const tituloItens = loja ? "Loja" : "Produtos e serviços";
  const temBeneficios = beneficios.length > 0;

  const idsDasSecoes = new Set<string>(["inicio", "sobre", "contato-site"]);
  if (temItens) idsDasSecoes.add("produtos");
  if (temPlanos) idsDasSecoes.add("planos");
  if (temEquipe) idsDasSecoes.add("equipe");
  if (temBeneficios) idsDasSecoes.add("beneficios");
  if (temLocalizacao) idsDasSecoes.add("localizacao");

  const imagens = imagensDoBanner(banners, perfil, urls, idsDasSecoes);
  const comImagem = imagens.length > 0;
  // O logo (imagem principal) aparece junto do título quando o fundo é outro banner.
  const logo =
    banners.length > 0 && comImagem && perfil.imagemPath ? urls[perfil.imagemPath] : undefined;
  const fotos = perfil.fotosPaths.flatMap((f, i) =>
    urls[f] ? [{ src: urls[f], alt: `Foto ${i + 1} de ${nome}` }] : [],
  );

  const destaques: Destaque[] = [
    ...(local ? [{ icone: "local" as const, rotulo: "Onde fica", valor: local }] : []),
    ...(nomesCategorias[0]
      ? [{ icone: "categoria" as const, rotulo: "Categoria", valor: nomesCategorias[0] }]
      : []),
    ...(temItens
      ? [{ icone: "produtos" as const, rotulo: tituloItens, valor: String(itensCatalogo.length) }]
      : []),
    ...(perfil.areasAtendidas.length > 0
      ? [
          {
            icone: "areas" as const,
            rotulo: "Áreas atendidas",
            valor: String(perfil.areasAtendidas.length),
          },
        ]
      : []),
    ...(temBeneficios
      ? [
          {
            icone: "beneficios" as const,
            rotulo: "Benefícios em pontos",
            valor: String(beneficios.length),
          },
        ]
      : []),
  ];

  const menu: ItemMenuSite[] = [
    { id: "inicio", rotulo: "Início" },
    { id: "sobre", rotulo: "Sobre" },
    ...(temItens ? [{ id: "produtos", rotulo: tituloItens }] : []),
    ...(temPlanos ? [{ id: "planos", rotulo: "Planos" }] : []),
    ...(temEquipe ? [{ id: "equipe", rotulo: "Equipe" }] : []),
    ...(temBeneficios ? [{ id: "beneficios", rotulo: "Benefícios" }] : []),
    ...(temLocalizacao ? [{ id: "localizacao", rotulo: "Localização" }] : []),
    { id: "contato-site", rotulo: "Contato" },
  ];

  // Ordem das seções para numerar e alternar o fundo (sem estado mutável).
  const ordem = [
    "sobre",
    ...(temItens ? ["produtos"] : []),
    ...(temPlanos ? ["planos"] : []),
    ...(temEquipe ? ["equipe"] : []),
    ...(temBeneficios ? ["beneficios"] : []),
    ...(temLocalizacao ? ["localizacao"] : []),
    "contato-site",
  ];
  const numeroDe = (id: string) => ordem.indexOf(id) + 1;
  const altDe = (id: string) => numeroDe(id) % 2 === 0;

  return (
    <div
      className={`site site-${estilo} ${classeDeFontes(estilo)}`}
      data-estilo={estilo}
      data-testid="site-negocio"
    >
      <MenuSite nome={nome} itens={menu} />
      <main id="conteudo-site">
        <section
          id="inicio"
          className={`st-hero ${comImagem ? "st-hero-imagem" : "st-hero-marca"}${imagens.length > 1 ? " st-hero-varios" : ""}`}
          aria-labelledby="titulo-perfil"
        >
          <div className="st-hero-fundo">
            {comImagem ? (
              <CarrosselBanner imagens={imagens} rotulo={`Banners de ${nome}`} />
            ) : (
              <Decoracao estilo={estilo} />
            )}
          </div>
          <div className="st-hero-miolo">
            <div className="st-hero-texto">
              {exemplo.perfil ? <Selo /> : null}
              {logo ? <img className="st-avatar" src={logo} alt={`Imagem de ${nome}`} /> : null}
              {nomesCategorias.length > 0 ? (
                <p className="st-sobretitulo">{nomesCategorias[0]}</p>
              ) : null}
              <h1 id="titulo-perfil">{nome}</h1>
              {local ? <p className="st-local">{local}</p> : null}
              <p className="st-acoes-inicio">
                <a className="botao" href="#contato-site">
                  Falar com a empresa
                </a>
                {temItens ? (
                  <a className="botao botao-secundario" href="#produtos">
                    {loja ? "Ver a Loja" : "Ver produtos e serviços"}
                  </a>
                ) : null}
              </p>
            </div>
          </div>
        </section>
        <FaixaDecorativa />

        {
          <Secao
            id="sobre"
            tituloId="titulo-sobre"
            titulo="Sobre"
            icone="sobre"
            numero={numeroDe("sobre")}
            alt={altDe("sobre")}
            exemplo={exemplo.perfil}
          >
            <div className="st-sobre">
              <div className="st-sobre-texto">
                {perfil.descricaoBreve ? (
                  <p className="st-texto st-texto-destaque">{perfil.descricaoBreve}</p>
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
              </div>
              {destaques.length > 0 ? (
                <ul className="st-destaques" aria-label={`Destaques de ${nome}`}>
                  {destaques.map((d) => (
                    <li key={d.rotulo}>
                      <span className="st-destaque-icone" aria-hidden="true">
                        <Icone nome={d.icone} />
                      </span>
                      <span className="st-destaque-valor">{d.valor}</span>
                      <span className="st-destaque-rotulo">{d.rotulo}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {fotos.length > 0 ? (
              <ul className="st-fotos" aria-label={`Fotos de ${nome}`}>
                {fotos.map((f) => (
                  <li key={f.src}>
                    <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
                  </li>
                ))}
              </ul>
            ) : null}
          </Secao>
        }

        {temItens ? (
          <Secao
            id="produtos"
            tituloId="titulo-itens"
            titulo={tituloItens}
            icone="produtos"
            numero={numeroDe("produtos")}
            alt={altDe("produtos")}
            exemplo={exemplo.itens}
          >
            {loja?.filtros}
            {loja?.erro ? (
              <p className="erro-campo" role="alert">
                {loja.erro}
              </p>
            ) : null}
            {temSacola ? <PainelSacola perfilId={perfil.id} /> : null}
            {itensCatalogo.length === 0 ? (
              <p className="ajuda" role="status">
                Nenhum imóvel encontrado com esses filtros.
              </p>
            ) : null}
            <ul className="st-grade-cards">
              {itensCatalogo.map((i) => {
                const d = detalhes.get(i.id) ?? detalhesDoItem(i.descricao);
                // A descrição do cartão não repete as linhas de variação nem de periodicidade.
                const dados = dadosDeItem({ ...i, descricao: d.descricao }, [...categorias], local);
                return (
                  <li key={dados.chave}>
                    <CartaoItem
                      dados={dados}
                      url={dados.imagemPath ? urls[dados.imagemPath] : undefined}
                      exemplo={Boolean(exemplo.itens)}
                      variacoes={d.variacoes}
                      acao={
                        exemplo.itens ? undefined : (
                          <AcaoCompra
                            acao={resolverAcaoCompra({ tipoItem: i.tipo })}
                            perfilId={perfil.id}
                            item={{ id: i.id, nome: dados.nome }}
                            variacoes={d.variacoes}
                          />
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </Secao>
        ) : null}

        {temPlanos ? (
          <Secao
            id="planos"
            tituloId="titulo-planos"
            titulo="Planos"
            icone="produtos"
            numero={numeroDe("planos")}
            alt={altDe("planos")}
          >
            <p className="ajuda">
              Valores de referência. A contratação é combinada direto com {nome}, pelo contato.
            </p>
            <ul className="st-planos">
              {planos.map((p) => {
                const d = detalhes.get(p.id)!;
                const nomePlano = p.nome ?? "Plano";
                return (
                  <li key={p.id} className="st-plano">
                    <h3>{nomePlano}</h3>
                    <p className="st-plano-preco">
                      {p.precoTexto ? <>{p.precoTexto} </> : null}
                      <span>{d.periodicidade}</span>
                    </p>
                    {d.linhas.length > 0 ? (
                      <ul className="st-plano-inclusos">
                        {d.linhas.map((l) => (
                          <li key={l}>
                            <span aria-hidden="true">
                              <Icone nome="check" />
                            </span>
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <AcaoCompra
                      acao={resolverAcaoCompra({ tipoItem: p.tipo, plano: true })}
                      perfilId={perfil.id}
                      item={{ id: p.id, nome: nomePlano }}
                    />
                  </li>
                );
              })}
            </ul>
          </Secao>
        ) : null}

        {temEquipe ? (
          <Secao
            id="equipe"
            tituloId="titulo-equipe"
            titulo="Equipe"
            icone="sobre"
            numero={numeroDe("equipe")}
            alt={altDe("equipe")}
          >
            <ul className="st-equipe">
              {equipe.map((m) => (
                <li key={`${m.nome}-${m.cargo}`}>
                  <span className="st-equipe-icone" aria-hidden="true">
                    <Icone nome="sobre" />
                  </span>
                  <strong>{m.nome}</strong>
                  <span>{m.cargo}</span>
                </li>
              ))}
            </ul>
          </Secao>
        ) : null}

        {temBeneficios ? (
          <Secao
            id="beneficios"
            tituloId="titulo-beneficios"
            titulo="Benefícios em pontos"
            icone="beneficios"
            numero={numeroDe("beneficios")}
            alt={altDe("beneficios")}
            exemplo={exemplo.beneficios}
          >
            <p className="ajuda">{AVISO_SEM_RESGATE}</p>
            <div className="st-beneficios">
              <ListaBeneficiosPublicos beneficios={[...beneficios]} />
            </div>
          </Secao>
        ) : null}

        {temLocalizacao ? (
          <Secao
            id="localizacao"
            tituloId="titulo-localizacao"
            titulo="Localização"
            icone="local"
            numero={numeroDe("localizacao")}
            alt={altDe("localizacao")}
            exemplo={exemplo.perfil}
          >
            <div className="st-local-cartao">
              <span className="st-local-pino" aria-hidden="true">
                <Icone nome="local" />
              </span>
              <div>
                {perfil.endereco ? <p className="st-texto">{perfil.endereco}</p> : null}
                {local ? <p className="st-local-cidade">{local}</p> : null}
                {perfil.endereco ? (
                  <p>
                    <a
                      className="botao botao-secundario st-botao-auto"
                      href={mapa ? mapa.comoChegar : linkComoChegar(perfil.endereco, local)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Como chegar
                      <span className="sr-only"> (abre o mapa em outra aba)</span>
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
            {mapa && perfil.endereco ? <MapaLocalizacao nome={nome} urls={mapa} /> : null}
          </Secao>
        ) : null}

        {
          <Secao
            id="contato-site"
            tituloId="titulo-contato-site"
            titulo="Contato"
            icone="contato"
            numero={numeroDe("contato-site")}
            alt={altDe("contato-site")}
          >
            <div className="st-contato">
              <div className="st-contato-info">
                <h3>Fale com {nome}</h3>
                <p>
                  Envie um pedido de contato e a empresa responde. Você também pode indicar esta
                  empresa a quem precisa.
                </p>
                {local ? (
                  <p className="st-contato-linha">
                    <span aria-hidden="true">
                      <Icone nome="local" />
                    </span>
                    {local}
                  </p>
                ) : null}
                {perfil.endereco ? (
                  <p className="st-contato-linha st-contato-endereco">{perfil.endereco}</p>
                ) : null}
              </div>
              <div className="st-contato-form">{contato}</div>
            </div>
          </Secao>
        }
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
