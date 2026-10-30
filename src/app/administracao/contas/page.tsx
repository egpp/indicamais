import type { Metadata } from "next";
import {
  FormReativarConta,
  FormSincronizarAcesso,
  FormSuspenderConta,
} from "../../_componentes/form-ciclo-vida";
import { NavAdministracao } from "../../_componentes/nav-administracao";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirPermissao, obterContextoCicloVida } from "../../_lib/contexto-ciclo-vida";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Contas (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const ROTULO = {
  suspensa: "Suspensa",
  encerramento_solicitado: "Encerramento solicitado",
  anonimizada: "Encerrada e anonimizada",
} as const;

/**
 * IM-080, IM-081: contas fora do estado normal, para quem tem a permissão suspender (404 para os demais).
 * Suspender e reativar exigem motivo e são auditados. Depois da mudança no banco, o servidor aplica ou desfaz o
 * bloqueio no login; se isso falhar, a suspensão continua valendo e a tela avisa. Sem nome, telefone ou e-mail.
 */
export default async function PaginaContasAdmin() {
  const ctx = await obterContextoCicloVida("/administracao/contas");
  const permissoes = await exigirPermissao(ctx, "suspender");
  const [lista, geral] = await Promise.all([
    ctx.admin.listarContasCicloVida(),
    ctx.ehAdministradorGeral(),
  ]);
  return (
    <PainelPagina
      titulo="Contas"
      subtitulo="Contas suspensas e em encerramento. Nada é suspenso automaticamente."
      admin
      atual="administracao"
    >
      <NavAdministracao permissoes={permissoes} geral={geral} atual="contas" />
      <section aria-labelledby="titulo-suspender">
        <h2 id="titulo-suspender">Suspender uma conta</h2>
        <FormSuspenderConta />
      </section>
      <section aria-labelledby="titulo-fora">
        <h2 id="titulo-fora">Contas fora do normal</h2>
        {!lista.ok ? (
          <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
        ) : lista.valor.length === 0 ? (
          <p className="ajuda">Nenhuma conta suspensa ou em encerramento.</p>
        ) : (
          <ul className="lista-cartoes">
            {lista.valor.map((c) => (
              <li key={c.contaId} className="cartao">
                <h3>
                  <SeloEstado rotulo={ROTULO[c.situacao]} />
                </h3>
                <p className="ajuda quebra-total">Conta: {c.contaId}</p>
                {c.suspensaEm ? (
                  <p className="ajuda">Suspensa em {formatarDataHora(c.suspensaEm)}</p>
                ) : null}
                {c.encerramentoExecutarApos ? (
                  <p className="ajuda">
                    Encerramento definitivo após {formatarDataHora(c.encerramentoExecutarApos)}
                  </p>
                ) : null}
                {c.anonimizadaEm ? (
                  <p className="ajuda">Anonimizada em {formatarDataHora(c.anonimizadaEm)}</p>
                ) : null}
                {c.situacao === "suspensa" ? (
                  <details>
                    <summary className="botao-texto">Reativar</summary>
                    <FormReativarConta contaId={c.contaId} />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="titulo-sincronizar">
        <h2 id="titulo-sincronizar">Sincronizar acesso</h2>
        <p className="ajuda">
          Se o aviso disser que o bloqueio ou a liberação do login não pôde ser aplicado, repita
          aqui.
        </p>
        <FormSincronizarAcesso />
      </section>
    </PainelPagina>
  );
}
