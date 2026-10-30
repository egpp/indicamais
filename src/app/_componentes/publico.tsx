/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import Link from "next/link";
import { LogoMarca } from "./marca";
import type { CardBusca, FiltrosDisponiveis, TipoBusca } from "@/modules/busca";
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
        <ul>
          <li>
            <Link href="/entrar">Entrar</Link>
          </li>
          <li>
            <Link href="/cadastro">Criar conta</Link>
          </li>
        </ul>
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

export function CartaoPublico({ dados, urls }: { dados: DadosCard; urls: Urls }) {
  const url = dados.imagemPath ? urls[dados.imagemPath] : undefined;
  return (
    <article className="card-publico">
      <div className="card-imagem">
        {url ? (
          <img src={url} alt="" loading="lazy" />
        ) : (
          <span className="imagem-indisponivel">Sem imagem</span>
        )}
      </div>
      <div className="card-corpo">
        <p className="card-tipo">{dados.rotuloTipo}</p>
        <h3>
          <Link className="card-link" href={dados.link}>
            {dados.nome}
          </Link>
        </h3>
        {dados.precoTexto ? <p className="preco-card">{dados.precoTexto}</p> : null}
        {dados.descricao ? <p className="card-descricao">{dados.descricao}</p> : null}
        {dados.categoria ? <p className="card-meta">{dados.categoria}</p> : null}
        {dados.local ? <p className="card-meta">{dados.local}</p> : null}
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
    <section aria-labelledby="titulo-patrocinados">
      <h2 id="titulo-patrocinados">Em destaque</h2>
      <div className="carrossel-regiao" role="region" aria-label="Patrocinados" tabIndex={0}>
        <ul className="carrossel">
          {patrocinadores.map((p) => {
            const url = urls[p.imagemPath];
            return (
              <li key={p.id}>
                <article className="card-patrocinado">
                  <div className="card-imagem">
                    {url ? (
                      <img src={url} alt="" loading="lazy" />
                    ) : (
                      <span className="imagem-indisponivel">Sem imagem</span>
                    )}
                  </div>
                  <div className="card-corpo">
                    <p>
                      <span className="selo-patrocinado">{p.identificacao}</span>
                    </p>
                    <h3>{p.titulo}</h3>
                    {p.destino.tipo === "perfil" ? (
                      <p>
                        <Link className="botao botao-secundario" href={p.destino.link}>
                          Ver perfil
                        </Link>
                      </p>
                    ) : (
                      <p className="card-descricao">{p.destino.texto}</p>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export type ValoresFiltro = {
  termo?: string;
  tipo?: string;
  categoriaId?: string;
  uf?: string;
  cidade?: string;
};

/** Filtros por GET: funcionam sem JavaScript e geram links que dá para compartilhar. */
export function FiltrosDaBusca({
  filtros,
  valores,
}: {
  filtros: FiltrosDisponiveis | null;
  valores: ValoresFiltro;
}) {
  return (
    <form className="filtros-busca" method="get" action="/" role="search" aria-label="Buscar">
      <div className="campo campo-largo">
        <label htmlFor="f-termo">Buscar pelo nome</label>
        <input
          id="f-termo"
          name="termo"
          type="search"
          defaultValue={valores.termo ?? ""}
          maxLength={80}
          autoComplete="off"
          placeholder="Ex.: padaria, bicicleta, eletricista"
        />
      </div>
      <div className="campo">
        <label htmlFor="f-tipo">Tipo</label>
        <select id="f-tipo" name="tipo" defaultValue={valores.tipo ?? ""}>
          <option value="">Todos</option>
          <option value="perfil">Empresas e profissionais</option>
          <option value="produto">Produtos</option>
          <option value="servico">Serviços</option>
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-categoria">Categoria</label>
        <select id="f-categoria" name="categoriaId" defaultValue={valores.categoriaId ?? ""}>
          <option value="">Todas</option>
          {(filtros?.categorias ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-uf">UF</label>
        <select id="f-uf" name="uf" defaultValue={valores.uf ?? ""}>
          <option value="">Todas</option>
          {(filtros?.ufs ?? []).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-cidade">Cidade</label>
        <input
          id="f-cidade"
          name="cidade"
          type="text"
          defaultValue={valores.cidade ?? ""}
          maxLength={80}
          autoComplete="address-level2"
        />
      </div>
      <div className="acoes">
        <button type="submit" className="botao">
          Buscar
        </button>
        <Link href="/">Limpar filtros</Link>
      </div>
    </form>
  );
}

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
