import type { Metadata } from "next";
import Link from "next/link";
import { FormRedefinirSenha } from "../_componentes/formularios";
import { Aviso, CartaoPagina } from "../_componentes/ui";
import { MENSAGEM_LINK_INVALIDO } from "../_lib/mensagens-auth";
import { criarClienteServidor } from "@/shared/supabase/servidor";

export const metadata: Metadata = { title: "Redefinir senha | IndicaMais" };
export const dynamic = "force-dynamic";

export default async function PaginaRedefinirSenha() {
  // A sessão de recuperação vem do link do e-mail (rota /auth/callback).
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <CartaoPagina titulo="Redefinir senha">
        <Aviso tipo="erro">{MENSAGEM_LINK_INVALIDO}</Aviso>
        <p className="rodape-links">
          <Link href="/recuperar-senha">Pedir novo link</Link>
        </p>
      </CartaoPagina>
    );
  }
  return (
    <CartaoPagina titulo="Redefinir senha" subtitulo="Escolha uma nova senha para a sua conta.">
      <FormRedefinirSenha />
    </CartaoPagina>
  );
}
