import type { Metadata } from "next";
import type { PaginaBusca, SecaoHome } from "@/modules/busca";
import { CabecalhoHome } from "./_componentes/cabecalho-home";
import { ChamadaIndicar, FaixaCategorias } from "./_componentes/faixas-home";
import { HeroHome } from "./_componentes/hero-home";
import { SecaoCatalogo, SecoesDaHome } from "./_componentes/secoes-home";
import { obterSecoesDaHomeEmCache } from "./_lib/cache-home";
import { obterLocalizacaoDaHome } from "./_lib/contexto-home";
import {
  CarrosselPatrocinados,
  GradeCards,
  Paginacao,
  dadosDeCardBusca,
  type ValoresFiltro,
} from "./_componentes/publico";
import { Aviso } from "./_componentes/ui";
import { obterContextoPublico } from "./_lib/contexto-publico";
import { DESCRICAO_PADRAO, metadadosPublicos } from "./_lib/metadados-publicos";
import { um } from "./_lib/pagina";

/**
 * Página inicial pública (IM-019, IM-020): busca por nome, filtros de categoria, UF, cidade e tipo, cards com
 * imagem e descrição, seção de produtos e serviços e carrossel de patrocinados. Renderizada no servidor a cada
 * visita (dinâmica): usa sessão anônima e URLs assinadas curtas, então nada vai para cache compartilhado.
 * Layout do modelo do Emerson (cabeçalho, destaque com busca, categorias, carrosséis, chamada para indicar). Sem botão de
 * contato, indicar ou curtir nos cards (Fase 3); a chamada "Quero indicar agora" só leva à explicação em /indique-e-ganhe.
 */
export const dynamic = "force-dynamic";

const POR_PAGINA = 12;
const NA_SECAO = 6;

type Busca = Record<string, string | string[] | undefined>;

function valoresDaBusca(sp: Busca): ValoresFiltro & { pagina?: string } {
  return {
    termo: um(sp.termo)?.trim(),
    tipo: um(sp.tipo)?.trim(),
    categoriaId: um(sp.categoriaId)?.trim(),
    uf: um(sp.uf)?.trim(),
    cidade: um(sp.cidade)?.trim(),
    pagina: um(sp.pagina)?.trim(),
  };
}

const haFiltro = (v: ReturnType<typeof valoresDaBusca>) =>
  Boolean(v.termo || v.tipo || v.categoriaId || v.uf || v.cidade || (v.pagina && v.pagina !== "1"));

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const filtrada = haFiltro(valoresDaBusca(await searchParams));
  return metadadosPublicos({
    titulo: filtrada ? "Busca | IndicaMais" : "IndicaMais",
    descricao: DESCRICAO_PADRAO,
    caminho: "/",
    semIndexar: filtrada,
  });
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const valores = valoresDaBusca(await searchParams);
  const filtrada = haFiltro(valores);
  const ctx = obterContextoPublico();

  const [filtros, patrocinadores, resultado, perfis, secao, localizacao] = await Promise.all([
    ctx.busca.listarFiltros(),
    filtrada ? Promise.resolve(null) : ctx.patrocinadores.listarPatrocinadoresPublicos(),
    filtrada
      ? ctx.busca.buscar({
          termo: valores.termo,
          tipo: valores.tipo,
          categoriaId: valores.categoriaId,
          uf: valores.uf,
          cidade: valores.cidade,
          pagina: valores.pagina,
          limite: POR_PAGINA,
        })
      : Promise.resolve(null),
    filtrada
      ? Promise.resolve(null)
      : ctx.busca.buscar({ tipo: "perfil", pagina: 1, limite: NA_SECAO }),
    filtrada ? Promise.resolve(null) : ctx.busca.secaoProdutosEServicos(NA_SECAO),
    // "Na sua cidade" (D-019): só na home sem filtro; com login usa a cidade do perfil da pessoa.
    filtrada ? Promise.resolve(null) : obterLocalizacaoDaHome(valores),
  ]);
  // Seções em carrossel (IM-095, D-018): só na home sem filtro; vêm do cache em intervalos. Falha = lista vazia.
  const secoesHome: SecaoHome[] = filtrada ? [] : await obterSecoesDaHomeEmCache(localizacao);

  const listaPatrocinados = patrocinadores?.ok ? patrocinadores.valor : [];
  const paginaBusca: PaginaBusca | null = resultado?.ok ? resultado.valor : null;
  const cardsPerfis = perfis?.ok ? perfis.valor.cards : [];
  const produtos = secao?.ok ? secao.valor.produtos : [];
  const servicos = secao?.ok ? secao.valor.servicos : [];

  const todos = [
    ...(paginaBusca?.cards ?? []),
    ...cardsPerfis,
    ...produtos,
    ...servicos,
    ...secoesHome.flatMap((s) => s.itens),
  ];
  const urls = await ctx.assinarImagens([
    ...todos.flatMap((c) => (c.imagemPath ? [c.imagemPath] : [])),
    ...listaPatrocinados.map((p) => p.imagemPath),
  ]);

  const erro =
    (resultado && !resultado.ok ? resultado.erro.mensagem : null) ??
    (filtros.ok ? null : filtros.erro.mensagem);
  const erroSecoes = [perfis, secao].some((r) => r && !r.ok);
  const categorias = filtros.ok
    ? filtros.valor.categorias.map((c) => ({ id: c.id, nome: c.nome, slug: c.slug }))
    : [];

  return (
    <>
      <CabecalhoHome categorias={categorias} atual="inicio" />
      <main id="conteudo-principal" className="home">
        <HeroHome
          filtros={filtros.ok ? filtros.valor : null}
          valores={valores}
          compacto={filtrada}
        />
        {filtrada ? null : <FaixaCategorias categorias={categorias} />}

        <div className="home-miolo">
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

          {filtrada ? (
            <section aria-labelledby="titulo-resultados">
              <h2 id="titulo-resultados">Resultados</h2>
              {paginaBusca ? (
                <>
                  <p className="ajuda" role="status">
                    {paginaBusca.total === 0
                      ? "Nenhum resultado."
                      : paginaBusca.total === 1
                        ? "1 resultado."
                        : `${paginaBusca.total} resultados.`}
                  </p>
                  {paginaBusca.total === 0 ? (
                    <Aviso tipo="info">
                      Não encontramos nada com esses filtros. Tente outro nome, categoria ou cidade.
                    </Aviso>
                  ) : (
                    <GradeCards cards={paginaBusca.cards.map(dadosDeCardBusca)} urls={urls} />
                  )}
                  <Paginacao
                    pagina={paginaBusca.pagina}
                    totalPaginas={paginaBusca.totalPaginas}
                    parametros={{
                      termo: valores.termo,
                      tipo: valores.tipo,
                      categoriaId: valores.categoriaId,
                      uf: valores.uf,
                      cidade: valores.cidade,
                    }}
                  />
                </>
              ) : null}
            </section>
          ) : (
            <>
              {erroSecoes ? (
                <Aviso tipo="erro">Não foi possível carregar a lista agora. Tente novamente.</Aviso>
              ) : null}
              <CarrosselPatrocinados patrocinadores={listaPatrocinados} urls={urls} />
              <SecoesDaHome secoes={secoesHome} urls={urls} localizacao={localizacao} />
              <div className="secoes-catalogo">
                <SecaoCatalogo
                  titulo="Empresas e profissionais"
                  icone="empresa"
                  verTodos="/?tipo=perfil"
                  cards={cardsPerfis.map(dadosDeCardBusca)}
                  urls={urls}
                  vazio={erroSecoes ? null : "Ainda não há empresas ou profissionais publicados."}
                />
                <SecaoCatalogo
                  titulo="Produtos"
                  icone="sacola"
                  verTodos="/?tipo=produto"
                  cards={produtos.map(dadosDeCardBusca)}
                  urls={urls}
                  vazio={erroSecoes ? null : "Ainda não há produtos publicados."}
                />
                <SecaoCatalogo
                  titulo="Serviços"
                  icone="ferramentas"
                  verTodos="/?tipo=servico"
                  cards={servicos.map(dadosDeCardBusca)}
                  urls={urls}
                  vazio={erroSecoes ? null : "Ainda não há serviços publicados."}
                />
              </div>
            </>
          )}
        </div>
        {filtrada ? null : <ChamadaIndicar />}
      </main>
    </>
  );
}
