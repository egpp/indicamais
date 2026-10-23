import type { Metadata } from "next";
import Link from "next/link";
import { BotaoGoogle, FormEntrar } from "../_componentes/formularios";
import { Aviso, CartaoPagina } from "../_componentes/ui";
import { caminhoSeguro } from "../_lib/destino";
import { AVISOS_ENTRADA } from "../_lib/mensagens-auth";

export const metadata: Metadata = { title: "Entrar | IndicaMais" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const chave = um(params.aviso);
  const aviso = chave && Object.hasOwn(AVISOS_ENTRADA, chave) ? AVISOS_ENTRADA[chave] : undefined;
  const bruto = um(params.proximo);
  const proximo = bruto ? caminhoSeguro(bruto) : undefined;

  return (
    <CartaoPagina titulo="Entrar">
      {aviso ? <Aviso tipo="info">{aviso}</Aviso> : null}
      <FormEntrar proximo={proximo} />
      <p className="rodape-links">
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
      </p>
      <p className="separador">ou</p>
      <BotaoGoogle proximo={proximo} />
      <p className="rodape-links">
        Não tem conta? <Link href="/cadastro">Criar conta</Link>
      </p>
    </CartaoPagina>
  );
}
