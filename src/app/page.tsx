import type { Metadata } from "next";
import Link from "next/link";
import type { PaginaBusca } from "@/modules/busca";
import {
  CabecalhoPublico,
  CarrosselPatrocinados,
  FiltrosDaBusca,
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
 * Sem botão de contato, indicar ou curtir (Fase 3).
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

  const [filtros, patrocinadores, resultado, perfis, secao] = await Promise.all([
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
  ]);

  const listaPatrocinados = patrocinadores?.ok ? patrocinadores.valor : [];
  const paginaBusca: PaginaBusca | null = resultado?.ok ? resultado.valor : null;
  const cardsPerfis = perfis?.ok ? perfis.valor.cards : [];
  const produtos = secao?.ok ? secao.valor.produtos : [];
  const servicos = secao?.ok ? secao.valor.servicos : [];

  const todos = [...(paginaBusca?.cards ?? []), ...cardsPerfis, ...produtos, ...servicos];
  const urls = await ctx.assinarImagens([
    ...todos.flatMap((c) => (c.imagemPath ? [c.imagemPath] : [])),
    ...listaPatrocinados.map((p) => p.imagemPath),
  ]);

  const erro =
    (resultado && !resultado.ok ? resultado.erro.mensagem : null) ??
    (filtros.ok ? null : filtros.erro.mensagem);
  const erroSecoes = [perfis, secao].some((r) => r && !r.ok);

  return (
    <main className="pagina pagina-publica">
      <CabecalhoPublico />
      <h1>Encontre empresas, profissionais, produtos e serviços</h1>
      <p className="subtitulo">Busque pelo nome e filtre por categoria, UF e cidade.</p>

      <CarrosselPatrocinados patrocinadores={listaPatrocinados} urls={urls} />

      <FiltrosDaBusca filtros={filtros.ok ? filtros.valor : null} valores={valores} />
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
          <section aria-labelledby="titulo-perfis">
            <h2 id="titulo-perfis">Empresas e profissionais</h2>
            {cardsPerfis.length === 0 && !erroSecoes ? (
              <p className="ajuda">Ainda não há empresas ou profissionais publicados.</p>
            ) : (
              <GradeCards cards={cardsPerfis.map(dadosDeCardBusca)} urls={urls} />
            )}
            {cardsPerfis.length > 0 ? (
              <p>
                <Link href="/?tipo=perfil">Ver todas as empresas e profissionais</Link>
              </p>
            ) : null}
          </section>
          <section aria-label="Produtos e serviços">
            <h2>Produtos</h2>
            {produtos.length === 0 && !erroSecoes ? (
              <p className="ajuda">Ainda não há produtos publicados.</p>
            ) : (
              <GradeCards cards={produtos.map(dadosDeCardBusca)} urls={urls} />
            )}
            {produtos.length > 0 ? (
              <p>
                <Link href="/?tipo=produto">Ver todos os produtos</Link>
              </p>
            ) : null}
            <h2>Serviços</h2>
            {servicos.length === 0 && !erroSecoes ? (
              <p className="ajuda">Ainda não há serviços publicados.</p>
            ) : (
              <GradeCards cards={servicos.map(dadosDeCardBusca)} urls={urls} />
            )}
            {servicos.length > 0 ? (
              <p>
                <Link href="/?tipo=servico">Ver todos os serviços</Link>
              </p>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
