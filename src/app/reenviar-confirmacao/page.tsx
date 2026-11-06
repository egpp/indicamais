import type { Metadata } from "next";
import Link from "next/link";
import { FormReenviarConfirmacao } from "../_componentes/formularios";
import { CartaoPagina } from "../_componentes/ui";
import { SEM_INDEXACAO } from "../_lib/pagina";

/** O cabeçalho lê a sessão: renderiza por pedido, não no build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reenviar confirmação | IndicaMais", ...SEM_INDEXACAO };

export default function PaginaReenviarConfirmacao() {
  return (
    <CartaoPagina
      titulo="Reenviar confirmação"
      subtitulo="Informe o e-mail usado no cadastro para receber um novo link."
    >
      <FormReenviarConfirmacao />
      <p className="rodape-links">
        <Link href="/entrar">Voltar para Entrar</Link>
      </p>
    </CartaoPagina>
  );
}
