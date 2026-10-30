import type { Metadata } from "next";
import { FormInvalidarIndicacao } from "../../_componentes/form-ciclo-vida";
import { NavAdministracao } from "../../_componentes/nav-administracao";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirPermissao, obterContextoCicloVida } from "../../_lib/contexto-ciclo-vida";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Invalidar indicações (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * IM-077, IM-078: invalidar indicação para quem tem a permissão invalidar_indicacoes (404 para os demais). Reverte só
 * os pontos do pedido; não altera a base de relacionamento nem o pedido. Exige motivo, é auditado e pede
 * confirmação se o saldo ficaria negativo. O botão também aparece em cada pedido de /administracao/pedidos.
 */
export default async function PaginaIndicacoesAdmin() {
  const ctx = await obterContextoCicloVida("/administracao/indicacoes");
  const permissoes = await exigirPermissao(ctx, "invalidar_indicacoes");
  const [lista, geral] = await Promise.all([
    ctx.admin.listarIndicacoesInvalidadas(),
    ctx.ehAdministradorGeral(),
  ]);
  return (
    <PainelPagina
      titulo="Invalidar indicações"
      subtitulo="Reverte os pontos de uma indicação indevida. A base de relacionamento não muda."
      admin
      atual="administracao"
    >
      <NavAdministracao permissoes={permissoes} geral={geral} atual="indicacoes" />
      <section aria-labelledby="titulo-invalidar">
        <h2 id="titulo-invalidar">Invalidar uma indicação</h2>
        <FormInvalidarIndicacao />
      </section>
      <section aria-labelledby="titulo-invalidadas">
        <h2 id="titulo-invalidadas">Indicações invalidadas</h2>
        {!lista.ok ? (
          <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
        ) : lista.valor.length === 0 ? (
          <p className="ajuda">Nenhuma indicação invalidada até agora.</p>
        ) : (
          <ul className="lista-cartoes">
            {lista.valor.map((i) => (
              <li key={`${i.pedidoId}-${i.criadoEm}`} className="cartao">
                <h3 className="quebra-total">Pedido {i.pedidoId.slice(0, 8)}</h3>
                <p>
                  <SeloEstado
                    rotulo={i.temReversao ? "Pontos revertidos" : "Sem crédito a reverter"}
                  />
                </p>
                <p className="texto-corrido quebra-total">Motivo: {i.motivo}</p>
                <p className="ajuda">
                  Em {formatarDataHora(i.criadoEm)} (referência {i.autorRef})
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
