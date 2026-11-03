import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormLiberacaoLoja } from "../../_componentes/form-loja-admin";
import { LinkPaginaPublica } from "../../_componentes/link-pagina-publica";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContextoLojaAdmin } from "../../_lib/contexto-loja";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Loja (administração) | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

function hrefPagina(f: { busca?: string; loja?: string }, pagina: number) {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.loja) q.set("loja", f.loja);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `/administracao/loja${s ? `?${s}` : ""}`;
}

/**
 * Liberação da Loja por perfil (IM-097, IM-099, D-020). Só o administrador geral: visitante vai a /entrar e quem
 * não é administrador recebe o 404 padrão. Sem plano, sem cobrança: liberação manual, com motivo e auditoria, só
 * para testes. A regra e a auditoria são do módulo e do banco.
 */
export default async function PaginaLojaAdmin({ searchParams }: PageProps<"/administracao/loja">) {
  const { loja } = await obterContextoLojaAdmin("/administracao/loja");
  const sp = await searchParams;
  const busca = um(sp.busca);
  const apenasLiberadas = um(sp.loja) === "liberadas";
  const r = await loja.listarPerfis({
    busca,
    loja: apenasLiberadas ? "liberadas" : undefined,
    pagina: um(sp.pagina),
  });
  if (!r.ok && r.erro.codigo === "SEM_PERMISSAO") notFound();
  const atual = {
    ...(busca ? { busca } : {}),
    ...(apenasLiberadas ? { loja: "liberadas" } : {}),
  };

  return (
    <PainelPagina
      titulo="Loja (administração)"
      subtitulo="Libere ou retire a Loja de um perfil, com motivo. Uso apenas para testes: sem plano e sem cobrança."
      admin
      atual="administracao"
    >
      <form
        className="filtros-busca"
        method="get"
        action="/administracao/loja"
        role="search"
        aria-label="Filtrar perfis"
      >
        <div className="campo campo-largo">
          <label htmlFor="l-busca">Buscar pelo nome do perfil</label>
          <input
            id="l-busca"
            name="busca"
            type="search"
            defaultValue={busca ?? ""}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div className="campo">
          <label htmlFor="l-loja">Situação da Loja</label>
          <select id="l-loja" name="loja" defaultValue={apenasLiberadas ? "liberadas" : ""}>
            <option value="">Todos os perfis</option>
            <option value="liberadas">Só com a Loja liberada</option>
          </select>
        </div>
        <div className="acoes">
          <button type="submit" className="botao">
            Filtrar
          </button>{" "}
          <Link className="botao botao-secundario" href="/administracao/loja">
            Limpar
          </Link>
        </div>
      </form>

      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.itens.length === 0 ? (
        <Aviso tipo="info">Nenhum perfil para esses filtros.</Aviso>
      ) : (
        <>
          <p className="ajuda">
            Página {r.valor.pagina}. Os alterados mais recentemente vêm primeiro.
          </p>
          <ul className="lista-cartoes">
            {r.valor.itens.map((p) => (
              <li key={p.perfilId} className="cartao" data-testid="perfil-loja">
                <h2>{p.nome}</h2>
                <p>
                  <SeloEstado rotulo={p.lojaLiberada ? "Loja liberada" : "Loja não liberada"} />{" "}
                  <SeloEstado rotulo={p.publicacaoRotulo} />
                </p>
                <p>
                  <LinkPaginaPublica nome={p.nome} href={p.hrefPublico} />
                </p>
                {p.local ? <p className="ajuda">{p.local}</p> : null}
                {p.lojaAtualizadaEm ? (
                  <p className="ajuda">
                    Última mudança da Loja em {formatarDataHora(p.lojaAtualizadaEm)}
                  </p>
                ) : null}
                <FormLiberacaoLoja perfilId={p.perfilId} nome={p.nome} liberada={p.lojaLiberada} />
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação">
            {r.valor.temAnterior ? (
              <Link
                className="botao botao-secundario"
                rel="prev"
                href={hrefPagina(atual, r.valor.pagina - 1)}
              >
                Página anterior
              </Link>
            ) : null}{" "}
            {r.valor.temProxima ? (
              <Link
                className="botao botao-secundario"
                rel="next"
                href={hrefPagina(atual, r.valor.pagina + 1)}
              >
                Próxima página
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </PainelPagina>
  );
}
