import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Banners da página | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Entrada do menu Aparência > Banners (D-016; IM-093): escolhe o perfil. Com um só perfil, vai direto. */
export default async function PaginaBanners() {
  const ctx = await obterContexto("/aparencia/banners");
  const r = await ctx.perfis.listarMeus();
  if (r.ok && r.valor.length === 1) redirect(`/meus-perfis/${r.valor[0].id}/banners`);
  return (
    <PainelPagina
      titulo="Banners da página"
      subtitulo="Escolha de qual site você quer cuidar dos banners."
      atual="aparencia"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">
          Você ainda não tem sites. <Link href="/meus-perfis/novo">Crie o primeiro</Link> para
          montar o banner da página.
        </Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <li key={p.id} className="cartao">
              <h2>
                <Link href={`/meus-perfis/${p.id}/banners`}>
                  {p.conteudoEdicao.nome ?? "Site sem nome"}
                </Link>
              </h2>
            </li>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
