import type { Metadata } from "next";
import Link from "next/link";
import {
  AVISO_SEM_AUTOMATICO,
  AvisosSituacao,
  CartaoComissao,
  SaldoComissoes,
} from "../_componentes/comissoes";
import { PainelPagina } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { obterContextoComissoes } from "../_lib/contexto-comissoes";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Minhas comissões | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const LIMITE = 100;

/**
 * IM-064, IM-065, IM-066, IM-072: saldo de comissões do indicador (geradas, pendentes de repasse e pagas), situação
 * de adimplência com avisos dentro da plataforma e histórico. Separado dos pontos: regras, saldo e histórico
 * próprios. O cliente aparece só como referência opaca (IM-029, IM-041, IM-050); o motivo interno do administrador
 * nunca é mostrado.
 */
export default async function PaginaMinhasComissoes() {
  const ctx = await obterContextoComissoes("/comissoes");
  const [admin, saldo, situacao, comissoes] = await Promise.all([
    ctx.ehAdministrador(),
    ctx.servico.meuSaldo(),
    ctx.servico.minhaSituacao(),
    ctx.servico.minhasComissoes(),
  ]);
  return (
    <PainelPagina
      titulo="Minhas comissões"
      subtitulo="Comissões sobre as mensalidades dos clientes que você indicou."
      admin={admin}
      atual="comissoes"
    >
      <Aviso tipo="info">{AVISO_SEM_AUTOMATICO}</Aviso>

      {situacao.ok ? <AvisosSituacao situacoes={situacao.valor} /> : null}

      <section aria-labelledby="titulo-saldo-comissoes">
        <h2 id="titulo-saldo-comissoes">Saldo de comissões</h2>
        {!saldo.ok ? (
          <Aviso tipo="erro">{saldo.erro.mensagem}</Aviso>
        ) : (
          <SaldoComissoes saldo={saldo.valor} />
        )}
      </section>

      <section aria-labelledby="titulo-situacao-comissoes">
        <h2 id="titulo-situacao-comissoes">Sua situação por negócio</h2>
        {!situacao.ok ? (
          <Aviso tipo="erro">{situacao.erro.mensagem}</Aviso>
        ) : situacao.valor.length === 0 ? (
          <p className="ajuda">Você ainda não tem clientes vinculados em negócios com comissões.</p>
        ) : (
          <ul className="lista-cartoes">
            {situacao.valor.map((s) => (
              <li key={s.negocioId} className="cartao">
                <p>
                  {s.emDia
                    ? "Em dia: você pode gerar novas comissões neste negócio."
                    : "Em atraso: novas comissões estão suspensas neste negócio."}
                </p>
                <p className="ajuda">
                  Clientes ativos: {s.clientesAtivos} · encerrados: {s.clientesEncerrados}
                  {s.moduloAtivo ? "" : " · módulo de comissões desligado neste negócio"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-historico-comissoes">
        <h2 id="titulo-historico-comissoes">Histórico</h2>
        {!comissoes.ok ? (
          <Aviso tipo="erro">{comissoes.erro.mensagem}</Aviso>
        ) : comissoes.valor.length === 0 ? (
          <p className="ajuda">
            Nenhuma comissão por aqui ainda. Elas aparecem quando um cliente que você indicou tem
            uma mensalidade confirmada. Seus pontos ficam em <Link href="/pontos">Meus pontos</Link>
            .
          </p>
        ) : (
          <>
            {comissoes.valor.length > LIMITE ? (
              <p className="ajuda">Mostrando as {LIMITE} mais recentes.</p>
            ) : null}
            <ul className="lista-cartoes">
              {comissoes.valor.slice(0, LIMITE).map((c) => (
                <CartaoComissao key={c.id} c={c} />
              ))}
            </ul>
          </>
        )}
      </section>
    </PainelPagina>
  );
}
