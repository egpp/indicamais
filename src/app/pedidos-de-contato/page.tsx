import type { Metadata } from "next";
import { FormAcao } from "../_componentes/form-acao";
import { CartaoPedido } from "../_componentes/pedidos";
import { PainelPagina } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { acaoPedirReenvio } from "../acoes-indicacoes";
import { obterContextoIndicacoes } from "../_lib/contexto-indicacoes";
import { provedorEmailConfigurado } from "../_lib/notificacoes-contato";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Pedidos de contato | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * IM-027, IM-028: pedidos de contato dos perfis e anúncios do responsável, com os dados que o visitante
 * informou. É aqui que o responsável sempre encontra o pedido, mesmo se o aviso por e-mail falhar.
 */
export default async function PaginaPedidosDeContato() {
  const ctx = await obterContextoIndicacoes("/pedidos-de-contato");
  const [admin, r] = await Promise.all([ctx.ehAdministrador(), ctx.servico.listarMeusPedidos()]);
  const emailConfigurado = provedorEmailConfigurado();
  return (
    <PainelPagina
      titulo="Pedidos de contato"
      subtitulo="Pessoas que pediram contato com seus perfis, produtos, serviços e anúncios. Do mais recente ao mais antigo."
      admin={admin}
      atual="pedidos"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">Você ainda não recebeu pedidos de contato.</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <CartaoPedido key={p.id} pedido={p} emailConfigurado={emailConfigurado}>
              {p.notificacaoEstado === "falhou" ? (
                <FormAcao
                  acao={acaoPedirReenvio}
                  campos={{ pedidoId: p.id }}
                  rotulo="Pedir reenvio"
                  rotuloEnviando="Pedindo..."
                  secundario
                />
              ) : null}
            </CartaoPedido>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
