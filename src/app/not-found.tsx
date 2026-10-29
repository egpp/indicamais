import type { Metadata } from "next";
import Link from "next/link";
import { CartaoPagina } from "./_componentes/ui";
import { SEM_INDEXACAO } from "./_lib/pagina";

export const metadata: Metadata = { title: "Página não encontrada | IndicaMais", ...SEM_INDEXACAO };

/**
 * 404 genérico em português. É o MESMO texto para endereço que não existe, conteúdo não aprovado, despublicado
 * ou de perfil indisponível: a página não revela qual dos casos é (IM-079, IM-029).
 */
export default function NaoEncontrada() {
  return (
    <CartaoPagina
      titulo="Página não encontrada"
      subtitulo="O endereço não existe ou o conteúdo não está disponível."
    >
      <p>
        <Link className="botao" href="/">
          Ir para a página inicial
        </Link>
      </p>
    </CartaoPagina>
  );
}
