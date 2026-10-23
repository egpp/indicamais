import type { Metadata } from "next";
import Link from "next/link";
import { FormCadastro } from "../_componentes/formularios";
import { Aviso, CartaoPagina } from "../_componentes/ui";

export const metadata: Metadata = { title: "Criar conta | IndicaMais" };

export default function PaginaCadastro() {
  return (
    <CartaoPagina titulo="Criar conta" subtitulo="Leva menos de um minuto.">
      <FormCadastro />
      <Aviso tipo="info">
        O WhatsApp não é pedido agora. Você informa depois, em Minha conta, antes de fazer a sua
        primeira indicação.
      </Aviso>
      <p className="rodape-links">
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </CartaoPagina>
  );
}
