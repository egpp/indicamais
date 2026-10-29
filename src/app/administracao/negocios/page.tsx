import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterServicoConsultaNegocios } from "../../_lib/contexto-negocios";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Perfis e itens | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

function hrefPagina(f: { busca?: string; situacao?: string; tipo?: string }, pagina: number) {
  const q = new URLSearchParams();
  if (f.busca) q.set("busca", f.busca);
  if (f.situacao) q.set("situacao", f.situacao);
  if (f.tipo) q.set("tipo", f.tipo);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `/administracao/negocios${s ? `?${s}` : ""}`;
}

/**
 * Consulta somente leitura de todos os perfis e itens (D-009, IM-021, IM-077 parte). Sem ações.
 * Quem não é administrador recebe o 404 padrão (a rota não se revela).
 */
export default async function PaginaNegociosAdmin({
  searchParams,
}: PageProps<"/administracao/negocios">) {
  const servico = await obterServicoConsultaNegocios("/administracao/negocios");
  if (!(await servico.ehAdministrador())) notFound();
  const sp = await searchParams;
  const filtros = {
    busca: um(sp.busca),
    situacao: um(sp.situacao),
    tipo: um(sp.tipo),
    pagina: um(sp.pagina),
  };
  const r = await servico.consultar(filtros);
  if (!r.ok && r.erro.codigo === "SEM_PERMISSAO") notFound();
  const atual = {
    ...(filtros.busca ? { busca: filtros.busca } : {}),
    ...(filtros.situacao ? { situacao: filtros.situacao } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
  };

  return (
    <PainelPagina
      titulo="Perfis e itens"
      subtitulo="Consulta de tudo o que foi cadastrado, em qualquer situação. Somente leitura."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>
      </p>

      <form
        className="filtros-busca"
        method="get"
        action="/administracao/negocios"
        role="search"
        aria-label="Filtrar perfis e itens"
      >
        <div className="campo campo-largo">
          <label htmlFor="n-busca">Buscar pelo nome</label>
          <input
            id="n-busca"
            name="busca"
            type="search"
            defaultValue={filtros.busca ?? ""}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div className="campo">
          <label htmlFor="n-tipo">Tipo</label>
          <select id="n-tipo" name="tipo" defaultValue={filtros.tipo ?? ""}>
            <option value="">Todos</option>
            <option value="perfil">Perfis</option>
            <option value="item">Produtos e serviços</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="n-situacao">Situação da versão mais recente</label>
          <select id="n-situacao" name="situacao" defaultValue={filtros.situacao ?? ""}>
            <option value="">Todas</option>
            <option value="rascunho">Rascunho</option>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovado</option>
            <option value="rejeitada">Rejeitado</option>
          </select>
        </div>
        <div className="acoes">
          <button type="submit" className="botao">
            Filtrar
          </button>{" "}
          <Link className="botao botao-secundario" href="/administracao/negocios">
            Limpar
          </Link>
        </div>
      </form>

      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.itens.length === 0 ? (
        <Aviso tipo="info">Nenhum resultado para esses filtros.</Aviso>
      ) : (
        <>
          <p className="ajuda">
            Página {r.valor.pagina}. Os alterados mais recentemente vêm primeiro.
          </p>
          <ul className="lista-cartoes">
            {r.valor.itens.map((n) => (
              <li key={n.chave} className="cartao">
                <h2>
                  {n.hrefPublico ? (
                    <Link href={n.hrefPublico}>{n.nome}</Link>
                  ) : n.hrefRevisao ? (
                    <Link href={n.hrefRevisao}>{n.nome}</Link>
                  ) : (
                    n.nome
                  )}
                </h2>
                <p>
                  <SeloEstado rotulo={n.tipoRotulo} /> <SeloEstado rotulo={n.situacaoRotulo} />{" "}
                  <SeloEstado rotulo={n.publicacaoRotulo} />
                  {n.indisponivel ? (
                    <>
                      {" "}
                      <SeloEstado rotulo="Indisponível" />
                    </>
                  ) : null}
                </p>
                {n.categoria || n.local ? (
                  <p className="ajuda">{[n.categoria, n.local].filter(Boolean).join(" · ")}</p>
                ) : null}
                {n.hrefRevisao ? (
                  <p className="ajuda">O nome leva à tela de revisão desta versão pendente.</p>
                ) : null}
                <p className="ajuda">
                  Criado em {formatarDataHora(n.criadoEm)} · Atualizado em{" "}
                  {formatarDataHora(n.atualizadoEm)}
                </p>
                {n.donoId ? (
                  <details>
                    <summary>Dono: {n.donoId.slice(0, 8)}</summary>
                    <code>{n.donoId}</code>
                  </details>
                ) : null}
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
