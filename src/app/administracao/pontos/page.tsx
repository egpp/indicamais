import type { Metadata } from "next";
import Link from "next/link";
import { FormReprocessar, FormReverter } from "../../_componentes/form-pontos";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora, formatarPontos } from "../../_lib/apresentacao";
import { exigirAdministradorPontos, obterContextoPontos } from "../../_lib/contexto-pontos";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Pontos (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const LIMITE = 100;
const ROTULO_SITUACAO = {
  creditado: "Creditado",
  revertido: "Revertido",
  reversao: "Reversão",
} as const;
const REF = { wordBreak: "break-all" } as const;

/**
 * IM-030, IM-035, IM-028, IM-077, IM-078: lançamentos, saldos, decisões e falhas de crédito. O indicador aparece só
 * por referência opaca (nunca conta, WhatsApp ou dado do visitante). Reversão e reprocessamento exigem motivo e são
 * auditados no banco. Quem não é administrador recebe o 404 padrão.
 */
export default async function PaginaPontosAdmin({
  searchParams,
}: PageProps<"/administracao/pontos">) {
  const ctx = await obterContextoPontos("/administracao/pontos");
  await exigirAdministradorPontos(ctx);
  const somenteNaoPontuadas = um((await searchParams).decisoes) === "nao-pontuadas";
  const [lancamentos, saldos, decisoes, falhas] = await Promise.all([
    ctx.servico.lancamentosAdmin(),
    ctx.servico.saldosAdmin(),
    ctx.servico.decisoesAdmin({ somenteNaoPontuadas }),
    ctx.servico.falhasAdmin(),
  ]);
  return (
    <PainelPagina
      titulo="Pontos"
      subtitulo="Lançamentos, saldos, decisões por pedido e falhas de crédito."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>{" "}
        <Link className="botao botao-secundario" href="/administracao/parametros">
          Parâmetros
        </Link>{" "}
        <Link className="botao botao-secundario" href="/administracao/beneficios">
          Benefícios
        </Link>
      </p>

      <section aria-labelledby="titulo-falhas">
        <h2 id="titulo-falhas">Falhas de crédito</h2>
        {!falhas.ok ? (
          <Aviso tipo="erro">{falhas.erro.mensagem}</Aviso>
        ) : falhas.valor.length === 0 ? (
          <p className="ajuda">Nenhuma falha de crédito registrada.</p>
        ) : (
          <ul className="lista-cartoes">
            {falhas.valor.map((f) => (
              <li key={f.pedidoId} className="cartao">
                <h3>Pedido {f.pedidoId.slice(0, 8)}</h3>
                <p>
                  <SeloEstado rotulo={f.pendente ? "Sem decisão" : "Já decidido"} /> {f.falhas}{" "}
                  {f.falhas === 1 ? "falha" : "falhas"}
                </p>
                <p className="ajuda">Última em {formatarDataHora(f.ultimaFalhaEm)}</p>
                {f.pendente ? (
                  <details>
                    <summary className="botao-texto">Reprocessar</summary>
                    <FormReprocessar pedidoId={f.pedidoId} />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-lancamentos">
        <h2 id="titulo-lancamentos">Lançamentos</h2>
        {!lancamentos.ok ? (
          <Aviso tipo="erro">{lancamentos.erro.mensagem}</Aviso>
        ) : lancamentos.valor.length === 0 ? (
          <p className="ajuda">Nenhum lançamento ainda.</p>
        ) : (
          <>
            <p className="ajuda">Mostrando os {LIMITE} mais recentes.</p>
            <ul className="lista-cartoes">
              {lancamentos.valor.slice(0, LIMITE).map((l) => (
                <li key={l.id} className="cartao">
                  <h3>
                    {formatarPontos(l.pontos, true)}
                    {l.destinoNome ? ` · ${l.destinoNome}` : ""}
                  </h3>
                  <p>
                    <SeloEstado rotulo={ROTULO_SITUACAO[l.situacao]} />
                    {l.confirmouSaldoNegativo ? (
                      <>
                        {" "}
                        <SeloEstado rotulo="Saldo negativo confirmado" />
                      </>
                    ) : null}
                  </p>
                  <p className="ajuda" style={REF}>
                    Indicador (referência): {l.indicadorRef}
                  </p>
                  {l.tipo === "reversao" ? (
                    <p>
                      Categoria: {l.categoriaRotulo ?? "Sem categoria"}
                      {l.observacao ? <> · Observação interna: {l.observacao}</> : null}
                    </p>
                  ) : null}
                  <p className="ajuda">Em {formatarDataHora(l.criadoEm)}</p>
                  {l.tipo === "credito" && l.situacao === "creditado" ? (
                    <details>
                      <summary className="botao-texto">Reverter crédito</summary>
                      <FormReverter lancamentoId={l.id} />
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-saldos">
        <h2 id="titulo-saldos">Saldos por indicador</h2>
        {!saldos.ok ? (
          <Aviso tipo="erro">{saldos.erro.mensagem}</Aviso>
        ) : saldos.valor.length === 0 ? (
          <p className="ajuda">Nenhum saldo ainda.</p>
        ) : (
          <ul className="lista-cartoes">
            {saldos.valor.slice(0, LIMITE).map((s) => (
              <li key={s.indicadorRef} className="cartao">
                <h3>{formatarPontos(s.saldo)}</h3>
                <p className="ajuda" style={REF}>
                  Indicador (referência): {s.indicadorRef}
                </p>
                <p className="ajuda">
                  Creditado {formatarPontos(s.totalCreditado)} · Revertido{" "}
                  {formatarPontos(Math.abs(s.totalRevertido))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-decisoes">
        <h2 id="titulo-decisoes">Decisões por pedido</h2>
        <p className="ajuda">
          Esta informação é só da administração: o indicador nunca vê por que um contato não
          pontuou.
        </p>
        <nav aria-label="Filtro das decisões">
          <ul className="nav-painel">
            <li>
              <Link
                href="/administracao/pontos"
                aria-current={somenteNaoPontuadas ? undefined : "page"}
              >
                Todas
              </Link>
            </li>
            <li>
              <Link
                href="/administracao/pontos?decisoes=nao-pontuadas"
                aria-current={somenteNaoPontuadas ? "page" : undefined}
              >
                Só as que não pontuaram
              </Link>
            </li>
          </ul>
        </nav>
        {!decisoes.ok ? (
          <Aviso tipo="erro">{decisoes.erro.mensagem}</Aviso>
        ) : decisoes.valor.length === 0 ? (
          <p className="ajuda">Nenhuma decisão para esse filtro.</p>
        ) : (
          <ul className="lista-cartoes">
            {decisoes.valor.slice(0, LIMITE).map((d) => (
              <li key={d.id} className="cartao">
                <h3>{d.motivoRotulo}</h3>
                <p>
                  <SeloEstado rotulo={d.pontuado ? "Pontuou" : "Não pontuou"} />{" "}
                  {d.pontuado ? formatarPontos(d.pontos, true) : null}
                </p>
                <p className="ajuda" style={REF}>
                  Pedido {d.pedidoId} · Indicador (referência): {d.indicadorRef ?? "sem indicador"}
                </p>
                <p className="ajuda">
                  Intervalo de {d.intervaloDias} dias · Decidido em {formatarDataHora(d.decididoEm)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
