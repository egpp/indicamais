import type { Metadata } from "next";
import Link from "next/link";
import { CartaoPagina } from "../_componentes/ui";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Conta indisponível | IndicaMais", ...SEM_INDEXACAO };

/**
 * Destino de quem perde o acesso (conta suspensa ou encerrada). Texto único e neutro: não revela o motivo
 * nem a situação da conta (IM-080, IM-081). Não consulta o banco.
 */
export default function ContaIndisponivel() {
  return (
    <CartaoPagina
      titulo="Conta indisponível"
      subtitulo="Não foi possível acessar esta conta agora. Sua sessão foi encerrada."
    >
      <p>
        Se você acha que isso é um engano ou precisa de ajuda, fale com a equipe do IndicaMais pelos
        canais de atendimento oficiais.
      </p>
      <p>
        <Link className="botao" href="/">
          Ir para a página inicial
        </Link>
      </p>
    </CartaoPagina>
  );
}
