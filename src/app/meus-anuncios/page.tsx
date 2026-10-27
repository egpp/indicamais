import type { Metadata } from "next";
import Link from "next/link";
import { ListaItens } from "../_componentes/lista-itens";
import { PainelPagina } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Meus anúncios | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Anúncios particulares: produtos sem perfil comercial (IM-015). */
export default async function PaginaMeusAnuncios() {
  const ctx = await obterContexto("/meus-anuncios");
  const [admin, itens] = await Promise.all([
    ctx.administracao.ehAdministrador(),
    ctx.itens.listarMeus(),
  ]);
  const anuncios = itens.ok ? itens.valor.filter((i) => i.anuncioParticular) : [];
  return (
    <PainelPagina
      titulo="Meus anúncios"
      subtitulo="Venda ou ofereça um produto sem precisar de perfil comercial."
      admin={admin}
      atual="anuncios"
    >
      <p>
        <Link className="botao" href="/meus-anuncios/novo">
          Criar anúncio
        </Link>
      </p>
      {!itens.ok ? (
        <Aviso tipo="erro">{itens.erro.mensagem}</Aviso>
      ) : anuncios.length === 0 ? (
        <Aviso tipo="info">Você ainda não tem anúncios.</Aviso>
      ) : (
        <ListaItens itens={anuncios} />
      )}
    </PainelPagina>
  );
}
