import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PainelPagina } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Aparência | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Entrada do menu Aparência (D-016; IM-091): escolhe o perfil. Com um só perfil, vai direto para ele. */
export default async function PaginaAparencia() {
  const ctx = await obterContexto("/aparencia");
  const r = await ctx.perfis.listarMeus();
  if (r.ok && r.valor.length === 1) redirect(`/meus-perfis/${r.valor[0].id}/aparencia`);
  return (
    <PainelPagina
      titulo="Aparência da página"
      subtitulo="Escolha de qual site você quer ver os estilos."
      atual="aparencia"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">
          Você ainda não tem sites. <Link href="/meus-perfis/novo">Crie o primeiro</Link> para
          escolher a aparência da página.
        </Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <li key={p.id} className="cartao">
              <h2>
                <Link href={`/meus-perfis/${p.id}/aparencia`}>
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
