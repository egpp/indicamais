import Link from "next/link";
import { IconeHome, iconeDaCategoria } from "./icones-home";

/** Faixa "Explore por categoria": usa as categorias reais ativas; o ícone de cada uma é sempre o mesmo. */
export type CategoriaFaixa = { id: string; nome: string; slug: string };

const NA_FAIXA = 7;

export function FaixaCategorias({ categorias }: { categorias: readonly CategoriaFaixa[] }) {
  if (categorias.length === 0) return null;
  const visiveis = categorias.slice(0, NA_FAIXA);
  return (
    <nav className="faixa-categorias" aria-labelledby="titulo-categorias">
      <h2 id="titulo-categorias">
        Explore <span>por categoria</span>
      </h2>
      <ul>
        {visiveis.map((c) => (
          <li key={c.id}>
            <Link href={`/?categoriaId=${encodeURIComponent(c.id)}`}>
              <IconeHome nome={iconeDaCategoria(c.slug, c.nome)} tamanho={30} />
              <span>{c.nome}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/categorias">
            <IconeHome nome="grade" tamanho={30} />
            <span>Ver todas</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Chamada para indicar. Texto fiel ao produto: pontos acumulam a cada indicação válida (IM-030); resgate de
 * benefícios está desativado (IM-037), então a chamada não promete troca.
 */
export function ChamadaIndicar() {
  return (
    <section className="chamada-indicar" aria-labelledby="titulo-chamada">
      <div className="chamada-indicar-conteudo">
        <h2 id="titulo-chamada">Indique empresas, produtos e serviços e ganhe pontos</h2>
        <p>Compartilhe seu link e acumule pontos a cada indicação válida.</p>
      </div>
      <Link className="chamada-botao" href="/indique-e-ganhe">
        <IconeHome nome="enviar" tamanho={20} />
        Quero indicar agora
      </Link>
    </section>
  );
}
