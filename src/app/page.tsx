import Link from "next/link";
import { CartaoPagina } from "./_componentes/ui";

export default function Home() {
  return (
    <CartaoPagina titulo="IndicaMais" subtitulo="Ambiente em construção.">
      <p>
        <Link className="botao" href="/entrar">
          Entrar
        </Link>
      </p>
      <p>
        <Link className="botao botao-secundario" href="/cadastro">
          Criar conta
        </Link>
      </p>
    </CartaoPagina>
  );
}
