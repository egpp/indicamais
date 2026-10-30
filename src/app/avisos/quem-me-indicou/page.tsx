import type { Metadata } from "next";
import { AbasAvisos } from "../../_componentes/avisos";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContextoRelacionamento } from "../../_lib/contexto-relacionamento";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Quem me indicou | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTULO_TIPO = { perfil: "Perfil", item: "Produto, serviço ou anúncio" } as const;

/**
 * IM-048, IM-050, IM-045: quem indicou algo sob sua responsabilidade e qual item foi indicado. O indicador aparece
 * só pelo nome reduzido; quem saiu da base aparece sem nome. Nunca há telefone, e-mail ou dado do visitante.
 */
export default async function PaginaQuemMeIndicou() {
  const ctx = await obterContextoRelacionamento("/avisos/quem-me-indicou");
  const [admin, aba] = await Promise.all([ctx.ehAdministrador(), ctx.notificacoes.quemMeIndicou()]);
  return (
    <PainelPagina
      titulo="Quem me indicou"
      subtitulo="Pessoas que indicaram seus perfis, produtos e serviços e resultaram em contato."
      admin={admin}
      atual="avisos"
    >
      <AbasAvisos atual="quem" />
      {!aba.ok ? (
        <Aviso tipo="erro">{aba.erro.mensagem}</Aviso>
      ) : aba.valor.itens.length === 0 ? (
        <p className="ajuda">Nenhuma indicação sua resultou em contato ainda.</p>
      ) : (
        <>
          <p>
            <strong>{aba.valor.total}</strong>{" "}
            {aba.valor.total === 1 ? "indicação com contato" : "indicações com contato"}.
          </p>
          <ul className="lista-cartoes">
            {aba.valor.itens.map((i) => (
              <li key={i.id} className="cartao">
                <h2>{i.destinoNome || ROTULO_TIPO[i.destinoTipo]}</h2>
                <p>
                  <SeloEstado rotulo={ROTULO_TIPO[i.destinoTipo]} />
                </p>
                {i.destinoTipo === "item" && i.perfilDestinoNome ? (
                  <p>Perfil de destino: {i.perfilDestinoNome}</p>
                ) : null}
                <p>
                  Indicado por:{" "}
                  <strong>
                    {i.indicadorSaiuDaBase
                      ? "Pessoa que saiu da base"
                      : (i.indicadorNome ?? "Pessoa")}
                  </strong>
                </p>
                <p className="ajuda">{formatarDataHora(i.criadoEm)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="ajuda">
        Por privacidade, não mostramos telefone, e-mail nem nome completo de ninguém.
      </p>
    </PainelPagina>
  );
}
