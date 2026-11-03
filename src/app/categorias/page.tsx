import type { Metadata } from "next";
import Link from "next/link";
import { IconeHome, iconeDaCategoria } from "../_componentes/icones-home";
import { PaginaInstitucional } from "../_componentes/pagina-institucional";
import { Aviso } from "../_componentes/ui";
import { obterContextoPublico } from "../_lib/contexto-publico";
import { metadadosPublicos } from "../_lib/metadados-publicos";

/** Todas as categorias ativas, cada uma levando à busca já filtrada (IM-019). */
export const metadata: Metadata = metadadosPublicos({
  titulo: "Categorias | IndicaMais",
  descricao: "Explore empresas, profissionais, produtos e serviços por categoria.",
  caminho: "/categorias",
});

export default async function PaginaCategorias() {
  const filtros = await obterContextoPublico().busca.listarFiltros();
  const categorias = filtros.ok ? filtros.valor.categorias : [];
  return (
    <PaginaInstitucional
      atual="categorias"
      titulo="Categorias"
      subtitulo="Escolha uma categoria para ver o que há perto de você."
    >
      {filtros.ok ? null : <Aviso tipo="erro">{filtros.erro.mensagem}</Aviso>}
      {filtros.ok && categorias.length === 0 ? (
        <p className="ajuda">Ainda não há categorias disponíveis.</p>
      ) : (
        <ul className="grade-categorias">
          {categorias.map((c) => (
            <li key={c.id}>
              <Link href={`/?categoriaId=${encodeURIComponent(c.id)}`}>
                <IconeHome nome={iconeDaCategoria(c.slug, c.nome)} tamanho={32} />
                <span>{c.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PaginaInstitucional>
  );
}
