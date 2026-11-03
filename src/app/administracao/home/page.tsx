import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAlterarSecaoHome } from "../../_componentes/form-home";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContextoHomeAdmin } from "../../_lib/contexto-home";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Seções da página inicial | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * Seções em carrossel da página inicial (IM-096, D-018): título, situação, ordem, mínimo e limite de itens de cada
 * uma das cinco seções. Somente o administrador geral; quem não é recebe o 404 padrão. Cada alteração exige motivo
 * e fica na auditoria (feita pelo banco).
 */
export default async function PaginaHomeAdmin() {
  const ctx = await obterContextoHomeAdmin("/administracao/home");
  const r = await ctx.home.listarSecoesHome();
  if (!r.ok && r.erro.codigo === "SEM_PERMISSAO") notFound();
  return (
    <PainelPagina
      titulo="Seções da página inicial"
      subtitulo="Carrosséis por critério de importância. Edite o título, a ordem e se a seção aparece."
      admin
      atual="administracao"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">Nenhuma seção cadastrada.</Aviso>
      ) : (
        <>
          <p className="ajuda">
            A seção só aparece quando tem itens suficientes (o mínimo definido abaixo). Mudanças
            valem na página inicial em poucos minutos.
          </p>
          <ul className="lista-cartoes">
            {r.valor.map((s) => (
              <li key={s.chave} className="cartao" data-secao={s.chave}>
                <h2>{s.titulo}</h2>
                <dl className="lista-dados">
                  <dt>Situação</dt>
                  <dd>{s.ativa ? "Ativa" : "Desativada"}</dd>
                  <dt>Ordem</dt>
                  <dd>{s.ordem}</dd>
                  <dt>Mínimo de itens</dt>
                  <dd>{s.minimoItens}</dd>
                  <dt>Máximo de itens</dt>
                  <dd>{s.limitePadrao}</dd>
                  <dt>Atualizada em</dt>
                  <dd>{formatarDataHora(s.atualizadoEm)}</dd>
                </dl>
                <details>
                  <summary className="botao-texto">Editar</summary>
                  <FormAlterarSecaoHome secao={s} />
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </PainelPagina>
  );
}
