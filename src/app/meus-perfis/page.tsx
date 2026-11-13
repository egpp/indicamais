import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "../_componentes/ui";
import { EtiquetaRascunhoNaoEnviado } from "../_componentes/aviso-rascunho";
import { LinkPaginaPublica, hrefPerfilPublico } from "../_componentes/link-pagina-publica";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Meus sites | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

export default async function PaginaMeusPerfis() {
  const ctx = await obterContexto("/meus-perfis");
  const [admin, r] = await Promise.all([
    ctx.administracao.ehAdministrador(),
    ctx.perfis.listarMeus(),
  ]);
  return (
    <PainelPagina
      titulo="Meus sites"
      subtitulo="Páginas comerciais de empresas ou profissionais."
      admin={admin}
      atual="perfis"
    >
      <p>
        <Link className="botao" href="/meus-perfis/novo">
          Criar site
        </Link>
      </p>
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">
          Você ainda não tem sites. Crie o primeiro para divulgar seu trabalho.
        </Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <li key={p.id} className="cartao">
              <h2>
                <Link href={`/meus-perfis/${p.id}`}>
                  {p.conteudoEdicao.nome ?? "Site sem nome"}
                </Link>
              </h2>
              <p>
                <SeloEstado rotulo={p.estado.rotulo} />
                {p.estado.aberta === "rascunho" ? (
                  <>
                    {" "}
                    <EtiquetaRascunhoNaoEnviado />
                  </>
                ) : null}
              </p>
              {p.conteudoEdicao.cidade ? (
                <p className="ajuda">
                  {[p.conteudoEdicao.cidade, p.conteudoEdicao.uf].filter(Boolean).join(" - ")}
                </p>
              ) : null}
              <p>
                <LinkPaginaPublica
                  nome={p.conteudoEdicao.nome ?? "Site sem nome"}
                  href={p.estado.noAr ? hrefPerfilPublico(p.slug) : null}
                />
              </p>
            </li>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
