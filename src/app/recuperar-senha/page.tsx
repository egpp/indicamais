import type { Metadata } from "next";
import Link from "next/link";
import { FormRecuperarSenha } from "../_componentes/formularios";
import { CartaoPagina } from "../_componentes/ui";

export const metadata: Metadata = { title: "Recuperar senha | IndicaMais" };

export default function PaginaRecuperarSenha() {
  return (
    <CartaoPagina
      titulo="Recuperar senha"
      subtitulo="Informe o e-mail da sua conta para receber as instruções."
    >
      <FormRecuperarSenha />
      <p className="rodape-links">
        <Link href="/entrar">Voltar para Entrar</Link>
      </p>
    </CartaoPagina>
  );
}
