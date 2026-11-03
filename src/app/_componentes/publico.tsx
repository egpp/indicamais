/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import Link from "next/link";
import { LogoMarca } from "./marca";
import { CarrosselHome } from "./carrossel-home";
import { LinksConta } from "./sino-avisos";
import type { CardBusca, TipoBusca } from "@/modules/busca";
import type { PatrocinadorPublico } from "@/modules/administracao";
import type { ItemExibicao } from "@/modules/catalogo";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import { nomeDaCategoria, type CategoriaOpcao } from "../_lib/apresentacao";

/**
 * Peças das páginas públicas (servidor, sem JavaScript no navegador). Recebem só modelos de exibição dos
 * módulos: não existe WhatsApp, responsável, e-mail nem id de conta neles (IM-029). Sem botão de contato,
 * indicar ou curtir (Fase 3; IM-043 pendente).
 */

type Urls = Record<string, string>;

export const ROTULO_TIPO_BUSCA: Record<TipoBusca, string> = {
  perfil: "Empresa ou profissional",
  produto: "Produto",
  servico: "Serviço",
};

export function CabecalhoPublico() {
  return (
    <header className="cabecalho-publico">
      <LogoMarca />
      <nav aria-label="Conta">
        <LinksConta />
      </nav>
    </header>
  );
}

export const localTexto = (cidade: string | null, uf: string | null): string =>
  [cidade, uf].filter(Boolean).join(" - ");

/** Dados de um card (busca, seção da home e itens do perfil). */
export type DadosCard = {
  chave: string;
  rotuloTipo: string;
  link: string;
  nome: string;
  descricao: string | null;
  imagemPath: string | null;
  categoria: string | null;
  local: string;
  precoTexto: string | null;
};

const CURTA = 200;
const curta = (t: string | null): string | null => {
  if (!t) return null;
  const limpo = t.replace(/\s+/g, " ").trim();
  if (limpo === "") return null;
  return limpo.length > CURTA ? `${limpo.slice(0, CURTA - 1).trimEnd()}…` : limpo;
};

export function dadosDeCardBusca(c: CardBusca): DadosCard {
  return {
    chave: `${c.tipo}-${c.id}`,
    rotuloTipo: c.anuncioParticular ? "Anúncio particular" : ROTULO_TIPO_BUSCA[c.tipo],
    link: c.link,
    nome: c.nome,
    descricao: curta(c.descricaoCurta),
    imagemPath: c.imagemPath,
    categoria: c.categoria?.nome ?? null,
    local: localTexto(c.cidade, c.uf),
    precoTexto: c.precoTexto,
  };
}

/** Item de um perfil: a localização é a do perfil (o item de perfil não tem a própria). */
export function dadosDeItem(
  i: ItemExibicao,
  categorias: readonly CategoriaOpcao[],
  localDoPerfil: string,
): DadosCard {
  const rotuloTipo = i.anuncioParticular
    ? "Anúncio particular"
    : i.tipo === "produto"
      ? "Produto"
      : "Serviço";
  return {
    chave: `item-${i.id}`,
    rotuloTipo,
    link: ROTAS_PUBLICAS.item(i.id),
    nome: i.nome ?? "Item sem nome",
    descricao: curta(i.descricao),
    imagemPath: i.fotoPath,
    categoria: i.categoriaPrincipalId ? nomeDaCategoria(i.categoriaPrincipalId, categorias) : null,
    local: localTexto(i.cidade, i.uf) || localDoPerfil,
    precoTexto: i.precoTexto,
  };
}

/** Imagem do card: proporção fixa e `object-fit: cover`; sem imagem, o mesmo espaço com um texto (nunca uma caixa vazia). */
function ImagemDoCard({ url }: { url: string | undefined }) {
  return (
    <div className="card-imagem">
      {url ? (
        <img src={url} alt="" loading="lazy" />
      ) : (
        <span className="imagem-indisponivel">Sem imagem</span>
      )}
    </div>
  );
}

const PIN_LOCAL = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

/**
 * Card público: TODOS têm o mesmo tamanho. Cinco linhas fixas (tipo, nome em até 2 linhas, preço ou categoria,
 * descrição em até 2 linhas, local), cada uma com altura reservada e reticências; o local fica sempre na base.
 * Sem botão de curtir: a curtida (IM-013) vive na página do perfil e do item, não nos cards.
 */
export function CartaoPublico({ dados, urls }: { dados: DadosCard; urls: Urls }) {
  const url = dados.imagemPath ? urls[dados.imagemPath] : undefined;
  return (
    <article className="card-publico">
      <ImagemDoCard url={url} />
      <div className="card-corpo">
        <p className="card-tipo">{dados.rotuloTipo}</p>
        <h3 className="card-nome">
          <Link className="card-link" href={dados.link}>
            {dados.nome}
          </Link>
        </h3>
        <p className={dados.precoTexto ? "card-linha preco-card" : "card-linha card-meta"}>
          {dados.precoTexto ?? dados.categoria ?? " "}
        </p>
        <p className="card-descricao">{dados.descricao ?? " "}</p>
        <p className="card-linha card-meta card-local">
          {dados.local ? PIN_LOCAL : null}
          <span>{dados.local || " "}</span>
        </p>
      </div>
    </article>
  );
}

export function GradeCards({ cards, urls }: { cards: DadosCard[]; urls: Urls }) {
  return (
    <ul className="grade-cards">
      {cards.map((d) => (
        <li key={d.chave}>
          <CartaoPublico dados={d} urls={urls} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Carrossel de patrocinadores (IM-020). Cada card traz o rótulo "Patrocinado" SEMPRE visível, sem preço e sem
 * link externo: o destino é um perfil publicado do IndicaMais ou um texto.
 */
export function CarrosselPatrocinados({
  patrocinadores,
  urls,
}: {
  patrocinadores: PatrocinadorPublico[];
  urls: Urls;
}) {
  if (patrocinadores.length === 0) return null;
  return (
    <div className="secoes-catalogo">
      <CarrosselHome titulo="Em destaque" icone="destaque" rotuloRegiao="Patrocinados">
        {patrocinadores.map((p) => (
          <li key={p.id}>
            <article className="card-publico card-patrocinado">
              <ImagemDoCard url={urls[p.imagemPath]} />
              <div className="card-corpo">
                <p className="card-tipo">
                  <span className="selo-patrocinado">{p.identificacao}</span>
                </p>
                <h3 className="card-nome">{p.titulo}</h3>
                <p className="card-linha">
                  {p.destino.tipo === "perfil" ? (
                    <Link className="card-link card-link-acao" href={p.destino.link}>
                      Ver perfil
                    </Link>
                  ) : (
                    " "
                  )}
                </p>
                <p className="card-descricao">
                  {p.destino.tipo === "texto" ? p.destino.texto : " "}
                </p>
                <p className="card-linha card-meta card-local">
                  <span>{" "}</span>
                </p>
              </div>
            </article>
          </li>
        ))}
      </CarrosselHome>
    </div>
  );
}

export type ValoresFiltro = {
  termo?: string;
  tipo?: string;
  categoriaId?: string;
  uf?: string;
  cidade?: string;
};

/** Paginação por links (sem JavaScript), preservando os filtros. */
export function Paginacao({
  pagina,
  totalPaginas,
  parametros,
}: {
  pagina: number;
  totalPaginas: number;
  parametros: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros)) if (v) q.set(k, v);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };
  return (
    <nav className="paginacao" aria-label="Paginação">
      {pagina > 1 ? <Link href={href(pagina - 1)}>Anterior</Link> : <span />}
      <span className="pagina-atual" aria-current="page">
        Página {pagina} de {totalPaginas}
      </span>
      {pagina < totalPaginas ? <Link href={href(pagina + 1)}>Próxima</Link> : <span />}
    </nav>
  );
}
