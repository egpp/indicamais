import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FormAlterarCategoria,
  FormCriarCategoria,
  FormDecidirSolicitacao,
} from "../../_componentes/form-administracao";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Categorias | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Categorias (criar, ativar e desativar com motivo) e pedidos dos responsáveis (IM-016). */
export default async function PaginaCategoriasAdmin() {
  const ctx = await obterContexto("/administracao/categorias");
  if (!(await ctx.ehAdministrador())) notFound();
  const [todas, pendentes] = await Promise.all([
    ctx.revisao.listarTodasCategorias(),
    ctx.categorias.listarSolicitacoesPendentes(),
  ]);
  const categorias = [...(todas.dados ?? [])].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const ativas = categorias.filter((c) => c.ativa).map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <PainelPagina
      titulo="Categorias"
      subtitulo="Lista usada nos perfis, produtos e serviços."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>
      </p>

      <section aria-labelledby="titulo-pedidos">
        <h2 id="titulo-pedidos">Pedidos de nova categoria</h2>
        {!pendentes.ok ? (
          <Aviso tipo="erro">{pendentes.erro.mensagem}</Aviso>
        ) : pendentes.valor.length === 0 ? (
          <p className="ajuda">Nenhum pedido pendente.</p>
        ) : (
          <ul className="lista-cartoes">
            {pendentes.valor.map((s) => (
              <li key={s.id} className="cartao">
                <h3>{s.nomeSugerido}</h3>
                {s.justificativa ? <p>{s.justificativa}</p> : null}
                <p className="ajuda">Pedido em {formatarDataHora(s.criadoEm)}</p>
                <p className="ajuda">Para atender, crie a categoria abaixo e escolha-a aqui.</p>
                <FormDecidirSolicitacao modo="atender" solicitacaoId={s.id} categorias={ativas} />
                <FormDecidirSolicitacao modo="recusar" solicitacaoId={s.id} categorias={ativas} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-nova">
        <h2 id="titulo-nova">Nova categoria</h2>
        <FormCriarCategoria />
      </section>

      <section aria-labelledby="titulo-lista">
        <h2 id="titulo-lista">Categorias existentes</h2>
        {!todas.dados && todas.erro ? (
          <Aviso tipo="erro">Não foi possível carregar as categorias.</Aviso>
        ) : (
          <ul className="lista-cartoes">
            {categorias.map((c) => (
              <li key={c.id} className="cartao">
                <h3>
                  {c.nome} <SeloEstado rotulo={c.ativa ? "Ativa" : "Inativa"} />
                </h3>
                <FormAlterarCategoria categoria={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
