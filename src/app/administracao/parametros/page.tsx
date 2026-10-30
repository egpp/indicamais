import type { Metadata } from "next";
import Link from "next/link";
import { FormParametro } from "../../_componentes/form-indicacoes-admin";
import { FormParametroPontos } from "../../_componentes/form-pontos";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirAdministrador, obterContextoIndicacoes } from "../../_lib/contexto-indicacoes";
import { exigirAdministradorPontos, obterContextoPontos } from "../../_lib/contexto-pontos";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Parâmetros | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * Parâmetros centrais do módulo de indicações (limites e janelas). Cada alteração exige motivo, respeita a
 * faixa (mínimo e máximo) e fica na auditoria. Quem não é administrador recebe o 404 padrão.
 */
export default async function PaginaParametros() {
  const ctx = await obterContextoIndicacoes("/administracao/parametros");
  await exigirAdministrador(ctx);
  const r = await ctx.servico.listarParametros();
  const ctxPontos = await obterContextoPontos("/administracao/parametros");
  await exigirAdministradorPontos(ctxPontos);
  const pontos = await ctxPontos.servico.parametrosAtuais();
  return (
    <PainelPagina
      titulo="Parâmetros"
      subtitulo="Valores centrais das indicações e dos pedidos de contato."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>
      </p>
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">Nenhum parâmetro disponível.</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((p) => (
            <li key={p.chave} className="cartao">
              <h2>{p.chave}</h2>
              <p>{p.descricao}</p>
              <dl className="lista-dados">
                <dt>Valor atual</dt>
                <dd>{p.valor}</dd>
                <dt>Mínimo</dt>
                <dd>{p.minimo}</dd>
                <dt>Máximo</dt>
                <dd>{p.maximo}</dd>
                <dt>Atualizado em</dt>
                <dd>{formatarDataHora(p.atualizadoEm)}</dd>
              </dl>
              <details>
                <summary className="botao-texto">Alterar</summary>
                <FormParametro
                  chave={p.chave}
                  valor={p.valor}
                  minimo={p.minimo}
                  maximo={p.maximo}
                />
              </details>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="titulo-pontos">
        <h2 id="titulo-pontos">Pontos</h2>
        <p className="ajuda">
          Quantos pontos vale uma indicação válida e o intervalo para o mesmo contato pontuar de
          novo no mesmo destino. Alterações valem para os próximos pedidos. Cada alteração exige
          motivo e fica na auditoria; valores fora da faixa permitida são recusados.
        </p>
        {!pontos.ok ? (
          <Aviso tipo="erro">{pontos.erro.mensagem}</Aviso>
        ) : (
          <ul className="lista-cartoes">
            <li className="cartao">
              <h3>Pontos por indicação válida</h3>
              <p>Valor atual: {pontos.valor.pontosPorIndicacao}</p>
              <details>
                <summary className="botao-texto">Alterar</summary>
                <FormParametroPontos
                  chave="pontos_por_indicacao"
                  valor={pontos.valor.pontosPorIndicacao}
                />
              </details>
            </li>
            <li className="cartao">
              <h3>Intervalo entre pontuações (dias)</h3>
              <p>Valor atual: {pontos.valor.intervaloDias}</p>
              <details>
                <summary className="botao-texto">Alterar</summary>
                <FormParametroPontos chave="intervalo_dias" valor={pontos.valor.intervaloDias} />
              </details>
            </li>
          </ul>
        )}
        <p>
          <Link className="botao botao-secundario" href="/administracao/pontos">
            Ver lançamentos de pontos
          </Link>
        </p>
      </section>
    </PainelPagina>
  );
}
