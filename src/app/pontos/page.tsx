import type { Metadata } from "next";
import Link from "next/link";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { AVISO_SEM_RESGATE } from "../_componentes/pontos";
import { Aviso } from "../_componentes/ui";
import { formatarDataHora, formatarPontos } from "../_lib/apresentacao";
import { obterContextoPontos } from "../_lib/contexto-pontos";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Meus pontos | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTULO_SITUACAO = {
  creditado: "Creditado",
  revertido: "Revertido",
  reversao: "Reversão",
} as const;

/**
 * IM-035, IM-078: saldo único (sem expiração) e histórico do indicador. Mostra só a CATEGORIA da reversão, nunca a
 * observação interna, e nunca o motivo de um contato não ter pontuado (D-012). Resgate desativado (IM-037).
 */
export default async function PaginaMeusPontos() {
  const ctx = await obterContextoPontos("/pontos");
  const [admin, saldo, lancamentos] = await Promise.all([
    ctx.ehAdministrador(),
    ctx.servico.meuSaldo(),
    ctx.servico.meusLancamentos(),
  ]);
  return (
    <PainelPagina
      titulo="Meus pontos"
      subtitulo="Seu saldo e o histórico de pontos das suas indicações."
      admin={admin}
      atual="pontos"
    >
      <Aviso tipo="info">{AVISO_SEM_RESGATE}</Aviso>

      <section aria-labelledby="titulo-saldo">
        <h2 id="titulo-saldo">Saldo</h2>
        {!saldo.ok ? (
          <Aviso tipo="erro">{saldo.erro.mensagem}</Aviso>
        ) : (
          <div className="cartao">
            <p>
              <strong style={{ fontSize: "2rem" }}>
                {saldo.valor.saldo.toLocaleString("pt-BR")}
              </strong>{" "}
              {saldo.valor.saldo === 1 ? "ponto" : "pontos"}
            </p>
            <dl className="lista-dados">
              <dt>Total creditado</dt>
              <dd>{formatarPontos(saldo.valor.totalCreditado)}</dd>
              <dt>Total revertido</dt>
              <dd>{formatarPontos(Math.abs(saldo.valor.totalRevertido))}</dd>
              {saldo.valor.ultimoLancamentoEm ? (
                <>
                  <dt>Último lançamento</dt>
                  <dd>{formatarDataHora(saldo.valor.ultimoLancamentoEm)}</dd>
                </>
              ) : null}
            </dl>
            <p className="ajuda">Os pontos não expiram.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-historico">
        <h2 id="titulo-historico">Histórico</h2>
        {!lancamentos.ok ? (
          <Aviso tipo="erro">{lancamentos.erro.mensagem}</Aviso>
        ) : lancamentos.valor.length === 0 ? (
          <p className="ajuda">
            Nenhum ponto por aqui ainda. Os pontos aparecem quando uma indicação sua é creditada.{" "}
            <Link href="/minhas-indicacoes">Ver minhas indicações</Link>
          </p>
        ) : (
          <ul className="lista-cartoes">
            {lancamentos.valor.map((l) => (
              <li key={l.id} className="cartao">
                <h3>
                  {formatarPontos(l.pontos, true)}
                  {l.destinoNome ? ` · ${l.destinoNome}` : ""}
                </h3>
                <p>
                  <SeloEstado rotulo={ROTULO_SITUACAO[l.situacao]} />
                </p>
                {l.tipo === "reversao" && l.categoriaRotulo ? (
                  <p>Motivo: {l.categoriaRotulo}</p>
                ) : null}
                <p className="ajuda">Em {formatarDataHora(l.criadoEm)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
