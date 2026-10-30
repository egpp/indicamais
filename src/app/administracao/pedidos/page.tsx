import type { Metadata } from "next";
import Link from "next/link";
import { FormInvalidarIndicacao } from "../../_componentes/form-ciclo-vida";
import { FormReenviarAdmin, FormTratarAlerta } from "../../_componentes/form-indicacoes-admin";
import { CartaoPedido } from "../../_componentes/pedidos";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { obterContextoCicloVida } from "../../_lib/contexto-ciclo-vida";
import { exigirAdministrador, obterContextoIndicacoes } from "../../_lib/contexto-indicacoes";
import { provedorEmailConfigurado } from "../../_lib/notificacoes-contato";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Pedidos de contato (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * IM-027, IM-028, IM-034: fila de pedidos de contato com estado do aviso, marcação de suspeita de
 * autoindicação, reenvio e tratamento de alerta (ambos com motivo, auditados no banco). Quem não é
 * administrador recebe o 404 padrão.
 */
export default async function PaginaPedidosAdmin({
  searchParams,
}: PageProps<"/administracao/pedidos">) {
  const ctx = await obterContextoIndicacoes("/administracao/pedidos");
  await exigirAdministrador(ctx);
  const somenteAlertas = um((await searchParams).alertas) === "abertos";
  const r = await ctx.servico.filaContatosAdmin({ somenteAlertasAbertos: somenteAlertas });
  const emailConfigurado = provedorEmailConfigurado();
  // IM-077: o botão de invalidar só aparece para quem tem a permissão (o banco confere de novo).
  let podeInvalidar = false;
  try {
    podeInvalidar = (
      await (await obterContextoCicloVida("/administracao/pedidos")).permissoes()
    ).includes("invalidar_indicacoes");
  } catch {
    podeInvalidar = false; // falha fechado: sem o botão
  }
  return (
    <PainelPagina
      titulo="Pedidos de contato"
      subtitulo="Todos os pedidos, com o estado do aviso por e-mail e as suspeitas de autoindicação."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>
      </p>
      <nav aria-label="Filtro da fila">
        <ul className="nav-painel">
          <li>
            <Link href="/administracao/pedidos" aria-current={somenteAlertas ? undefined : "page"}>
              Todos os pedidos
            </Link>
          </li>
          <li>
            <Link
              href="/administracao/pedidos?alertas=abertos"
              aria-current={somenteAlertas ? "page" : undefined}
            >
              Só alertas abertos
            </Link>
          </li>
        </ul>
      </nav>
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">
          {somenteAlertas ? "Nenhum alerta aberto." : "Nenhum pedido de contato ainda."}
        </Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <CartaoPedido
              key={p.id}
              pedido={p}
              administracao={p}
              emailConfigurado={emailConfigurado}
            >
              <details>
                <summary className="botao-texto">Reenviar aviso</summary>
                <FormReenviarAdmin pedidoId={p.id} />
              </details>
              {podeInvalidar ? (
                <details>
                  <summary className="botao-texto">Invalidar indicação</summary>
                  <FormInvalidarIndicacao pedidoId={p.id} />
                </details>
              ) : null}
              {p.alertaEstado === "aberto" ? (
                <details>
                  <summary className="botao-texto">Tratar alerta</summary>
                  <FormTratarAlerta pedidoId={p.id} />
                </details>
              ) : null}
            </CartaoPedido>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
