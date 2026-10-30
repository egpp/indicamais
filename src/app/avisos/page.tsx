import type { Metadata } from "next";
import { AbasAvisos } from "../_componentes/avisos";
import { AcoesDoAviso, MarcarTodosLidos } from "../_componentes/form-relacionamento";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { formatarDataHora } from "../_lib/apresentacao";
import { obterContextoRelacionamento } from "../_lib/contexto-relacionamento";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Avisos | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * IM-047, IM-050 a IM-052: avisos da própria conta (contato válido, curtida, indicação que gerou contato e resultado
 * de revisão). Os textos vêm só de `textoDoAviso`; quem agiu aparece pelo nome reduzido e nunca há telefone, e-mail ou
 * nome completo. Nenhum texto afirma compartilhamento externo.
 */
export default async function PaginaAvisos() {
  const ctx = await obterContextoRelacionamento("/avisos");
  const [admin, avisos] = await Promise.all([ctx.ehAdministrador(), ctx.notificacoes.meusAvisos()]);
  const naoLidas = avisos.ok ? avisos.valor.filter((a) => !a.lida).length : 0;
  return (
    <PainelPagina
      titulo="Avisos"
      subtitulo="Novidades sobre seus perfis, itens e indicações."
      admin={admin}
      atual="avisos"
    >
      <AbasAvisos atual="avisos" />
      {!avisos.ok ? (
        <Aviso tipo="erro">{avisos.erro.mensagem}</Aviso>
      ) : avisos.valor.length === 0 ? (
        <p className="ajuda">Você não tem avisos por enquanto.</p>
      ) : (
        <>
          <p aria-live="polite">
            {naoLidas === 0
              ? "Todos os avisos foram lidos."
              : naoLidas === 1
                ? "1 aviso não lido."
                : `${naoLidas} avisos não lidos.`}
          </p>
          {naoLidas > 0 ? <MarcarTodosLidos /> : null}
          <ul className="lista-cartoes">
            {avisos.valor.map((a) => (
              <li
                key={`${a.origem}-${a.origemId}`}
                className={`cartao${a.lida ? "" : " aviso-nao-lido"}`}
              >
                <h2>{a.titulo}</h2>
                <p>
                  <SeloEstado rotulo={a.lida ? "Lido" : "Novo"} />
                </p>
                <p>{a.texto}</p>
                <p className="ajuda">{formatarDataHora(a.criadoEm)}</p>
                <AcoesDoAviso
                  origem={a.origem}
                  origemId={a.origemId}
                  lida={a.lida}
                  temDestino={a.destino !== null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </PainelPagina>
  );
}
