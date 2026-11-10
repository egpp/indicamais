import type { Metadata } from "next";
import Link from "next/link";
import { ESTADOS_NOTIFICACAO_DESCARTAVEIS } from "@/modules/indicacoes";
import { FormDescartarNotificacoes } from "../../_componentes/form-descartar-notificacoes";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirAdministrador, obterContextoIndicacoes } from "../../_lib/contexto-indicacoes";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Notificações pendentes | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const ROTA = "/administracao/notificacoes-pendentes";
const ROTULO_ESTADO = { pendente: "Pendentes", falhou: "Com falha" } as const;

function href(estado: string | undefined, pagina: number): string {
  const q = new URLSearchParams();
  if (estado) q.set("estado", estado);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `${ROTA}${s ? `?${s}` : ""}`;
}

/**
 * Notificações de contato pendentes ou com falha (IM-103, IM-027, IM-028, IM-086): o administrador escolhe quais
 * descartar, com motivo e confirmação. Sem nome, WhatsApp, e-mail ou mensagem do visitante. Quem não é
 * administrador recebe 404.
 */
export default async function PaginaNotificacoesPendentes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await obterContextoIndicacoes(ROTA);
  await exigirAdministrador(ctx);
  const sp = await searchParams;
  const estado = ESTADOS_NOTIFICACAO_DESCARTAVEIS.find((e) => e === um(sp.estado));
  const pagina = Math.max(1, Number.parseInt(um(sp.pagina) ?? "1", 10) || 1);
  const r = await ctx.servico.listarNotificacoesDescartaveis({
    ...(estado ? { estado } : {}),
    pagina,
  });
  const ultima = r.ok ? Math.max(1, Math.ceil(r.valor.total / r.valor.porPagina)) : 1;

  return (
    <PainelPagina
      titulo="Notificações pendentes"
      subtitulo="Avisos de contato que ainda não foram enviados ou que falharam."
      admin
      atual="administracao"
    >
      <Aviso tipo="info">
        Descartar encerra a notificação com um motivo registrado na auditoria. O pedido de contato é
        mantido e as notificações já enviadas nunca são descartadas. Uma notificação descartada não
        volta à fila.
      </Aviso>
      <nav aria-label="Filtrar por estado" className="abas-admin">
        <Link href={href(undefined, 1)} aria-current={estado ? undefined : "page"}>
          Todas
        </Link>
        {ESTADOS_NOTIFICACAO_DESCARTAVEIS.map((e) => (
          <Link key={e} href={href(e, 1)} aria-current={estado === e ? "page" : undefined}>
            {ROTULO_ESTADO[e]}
          </Link>
        ))}
      </nav>
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.itens.length === 0 ? (
        <Aviso tipo="info">Nenhuma notificação pendente ou com falha. Tudo em dia.</Aviso>
      ) : (
        <>
          <p>
            <strong>{r.valor.total}</strong>{" "}
            {r.valor.total === 1 ? "notificação encontrada" : "notificações encontradas"}.
          </p>
          <FormDescartarNotificacoes
            key={`${estado ?? "todas"}-${r.valor.pagina}`}
            itens={r.valor.itens.map((i) => ({
              id: i.id,
              criadoEmTexto: formatarDataHora(i.criadoEm),
              estado: i.estado,
              tentativas: i.tentativas,
              destinoNome: i.destinoNome,
            }))}
          />
          <nav className="paginacao" aria-label="Paginação">
            {r.valor.pagina > 1 ? (
              <Link
                className="botao botao-secundario"
                rel="prev"
                href={href(estado, r.valor.pagina - 1)}
              >
                Página anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="pagina-atual">
              Página {r.valor.pagina} de {ultima}
            </span>
            {r.valor.pagina < ultima ? (
              <Link
                className="botao botao-secundario"
                rel="next"
                href={href(estado, r.valor.pagina + 1)}
              >
                Próxima página
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </PainelPagina>
  );
}
