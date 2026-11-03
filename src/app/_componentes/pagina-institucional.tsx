import type { ReactNode } from "react";
import { obterContextoPublico } from "../_lib/contexto-publico";
import { CabecalhoHome } from "./cabecalho-home";

/**
 * Moldura das páginas curtas e informativas (Como funciona, Indique e Ganhe, Ajuda, Categorias): mesmo cabeçalho
 * da página inicial, conteúdo em coluna de leitura. O rodapé vem do layout. Lê só as categorias ativas.
 */
export async function PaginaInstitucional({
  atual,
  titulo,
  subtitulo,
  children,
}: {
  atual: "como-funciona" | "indique" | "ajuda" | "categorias";
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  const filtros = await obterContextoPublico().busca.listarFiltros();
  const categorias = filtros.ok
    ? filtros.valor.categorias.map((c) => ({ id: c.id, nome: c.nome, slug: c.slug }))
    : [];
  return (
    <>
      <CabecalhoHome categorias={categorias} atual={atual} />
      <main id="conteudo-principal" className="institucional">
        <div className="institucional-faixa">
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </div>
        <div className="institucional-corpo">{children}</div>
      </main>
    </>
  );
}
