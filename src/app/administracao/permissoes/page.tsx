import type { Metadata } from "next";
import { ROTULOS_PERMISSAO } from "@/modules/administracao";
import { FormConcederPermissao, FormRevogarPermissao } from "../../_componentes/form-ciclo-vida";
import { NavAdministracao } from "../../_componentes/nav-administracao";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirAdministradorGeral, obterContextoCicloVida } from "../../_lib/contexto-ciclo-vida";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Permissões (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * IM-077: permissões específicas concedidas a outras contas. Só o administrador geral (404 para os demais).
 * Conceder e revogar exigem motivo e são auditados no banco. Quem concedeu aparece só por referência opaca.
 */
export default async function PaginaPermissoesAdmin() {
  const ctx = await obterContextoCicloVida("/administracao/permissoes");
  await exigirAdministradorGeral(ctx);
  const [lista, permissoes] = await Promise.all([
    ctx.admin.listarPermissoesConcedidas(),
    ctx.permissoes(),
  ]);
  return (
    <PainelPagina
      titulo="Permissões"
      subtitulo="Quem pode analisar denúncias, suspender contas e outras ações."
      admin
      atual="administracao"
    >
      <NavAdministracao permissoes={permissoes} geral atual="permissoes" />
      <section aria-labelledby="titulo-conceder">
        <h2 id="titulo-conceder">Conceder permissão</h2>
        <FormConcederPermissao />
      </section>
      <section aria-labelledby="titulo-concedidas">
        <h2 id="titulo-concedidas">Permissões concedidas</h2>
        {!lista.ok ? (
          <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
        ) : lista.valor.length === 0 ? (
          <p className="ajuda">Nenhuma permissão concedida a outras contas.</p>
        ) : (
          <ul className="lista-cartoes">
            {lista.valor.map((p) => (
              <li key={`${p.contaId}-${p.permissao}`} className="cartao">
                <h3>{ROTULOS_PERMISSAO[p.permissao]}</h3>
                <p className="ajuda quebra-total">Conta: {p.contaId}</p>
                <p className="ajuda quebra-total">
                  Concedida em {formatarDataHora(p.criadoEm)} (referência {p.concedidaPorRef})
                </p>
                <details>
                  <summary className="botao-texto">Revogar</summary>
                  <FormRevogarPermissao contaId={p.contaId} permissao={p.permissao} />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
