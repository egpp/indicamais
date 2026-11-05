import type {
  CausaReversao,
  ComissaoDoNegocio,
  EstadoComissao,
  MeuSaldoComissoes,
  MinhaComissao,
  MinhaSituacao,
  VinculoDoNegocio,
} from "@/modules/comissoes";
import { formatarDataCivil as civil } from "../_lib/apresentacao";
import { formatarPercentualBp, formatarReais, rotuloCompetencia } from "../_lib/dinheiro-comissoes";
import { SeloEstado } from "./painel";
import { Aviso } from "./ui";

/**
 * Peças de exibição das telas de comissões (Fase 7). Só apresentação: valores já vêm prontos do módulo. Cliente e
 * indicador aparecem apenas como referência opaca (IM-029, IM-041, IM-050). Comissões não se misturam com pontos
 * (IM-065). Texto sempre em pt-BR e valores em R$.
 */

export const ROTULO_ESTADO_COMISSAO: Record<EstadoComissao, string> = {
  gerada: "Gerada",
  pendente_repasse: "Pendente de repasse",
  paga: "Paga",
};

export const ROTULO_CAUSA_REVERSAO: Record<CausaReversao, string> = {
  cancelamento: "Cancelamento",
  estorno: "Estorno",
  correcao: "Correção",
};

export const AVISO_SEM_AUTOMATICO =
  "A plataforma não cobra nem repassa dinheiro. O administrador confirma cada pagamento e cada repasse manualmente, com registro de auditoria.";

const formatarDataCivil = (iso: string | null | undefined) => civil(iso?.slice(0, 10));

/** Referência curta e opaca (nunca nome, telefone ou e-mail). */
const refCurta = (ref: string) => (ref.length > 12 ? `${ref.slice(0, 12)}…` : ref);

export function SaldoComissoes({ saldo }: { saldo: MeuSaldoComissoes }) {
  return (
    <div className="cartao">
      <p>
        <strong className="saldo-destaque">{formatarReais(saldo.liquidoCentavos)}</strong> em
        comissões (líquido de reversões)
      </p>
      <dl className="lista-dados">
        <dt>Geradas</dt>
        <dd>{formatarReais(saldo.geradaCentavos)}</dd>
        <dt>Pendentes de repasse</dt>
        <dd>{formatarReais(saldo.pendenteRepasseCentavos)}</dd>
        <dt>Pagas</dt>
        <dd>{formatarReais(saldo.pagaCentavos)}</dd>
        <dt>Total gerado desde o início</dt>
        <dd>{formatarReais(saldo.totalGeradoCentavos)}</dd>
        {saldo.revertidaAposPagaCentavos > 0 ? (
          <>
            <dt>Revertido depois de pago</dt>
            <dd>{formatarReais(saldo.revertidaAposPagaCentavos)}</dd>
          </>
        ) : null}
      </dl>
      <p className="ajuda">Este saldo é só de comissões. Ele não soma nem altera seus pontos.</p>
    </div>
  );
}

export function CartaoComissao({
  c,
  comIndicador,
}: {
  c: MinhaComissao | ComissaoDoNegocio;
  comIndicador?: boolean;
}) {
  const indicador = "indicadorRef" in c ? c.indicadorRef : null;
  return (
    <li className="cartao">
      <h3>
        {formatarReais(c.liquidoCentavos)}
        {c.ofertaNome ? ` · ${c.ofertaNome}` : ""}
      </h3>
      <p>
        <SeloEstado rotulo={c.revertida ? "Revertida" : ROTULO_ESTADO_COMISSAO[c.estado]} />
        {c.revertida && c.reversaoCausa ? ` (${ROTULO_CAUSA_REVERSAO[c.reversaoCausa]})` : null}
      </p>
      <p className="ajuda">
        Mês {rotuloCompetencia(c.competencia)} · {formatarReais(c.baseCentavos)} ×{" "}
        {formatarPercentualBp(c.percentualBp)} = {formatarReais(c.valorCentavos)}
      </p>
      <p className="ajuda quebra-total">
        Cliente (referência): {refCurta(c.clienteRef)}
        {comIndicador && indicador ? ` · Indicador (referência): ${refCurta(indicador)}` : ""}
      </p>
    </li>
  );
}

/** IM-072: aviso interno de inadimplência do indicador (derivado das visões; sem cópia nem envio externo). */
export function AvisosSituacao({
  situacoes,
  nomes,
}: {
  situacoes: readonly MinhaSituacao[];
  nomes?: Record<string, string>;
}) {
  const comAlerta = situacoes.filter((s) => !s.emDia && s.inadimplenteDesde);
  if (comAlerta.length === 0) return null;
  return (
    <>
      {comAlerta.map((s) => (
        <Aviso key={s.negocioId} tipo="atencao">
          <p>
            <strong>{nomes?.[s.negocioId] ?? "Em um negócio onde você indica"}:</strong> sua
            mensalidade consta em atraso desde {formatarDataCivil(s.inadimplenteDesde)}. Enquanto
            estiver em atraso, você não gera novas comissões neste negócio; o que já foi gerado fica
            preservado.
          </p>
          {s.encerraEm ? (
            <p>
              {s.emAviso
                ? `Regularize até ${formatarDataCivil(s.encerraEm)} para manter seus clientes vinculados.`
                : `O prazo venceu em ${formatarDataCivil(s.encerraEm)}. A administração pode encerrar seus vínculos neste negócio; os clientes não passam para outra pessoa.`}
            </p>
          ) : null}
          <p className="ajuda">
            Ao regularizar, as comissões voltam a ser geradas só daí em diante.
          </p>
        </Aviso>
      ))}
    </>
  );
}

export function CartaoVinculo({ v }: { v: VinculoDoNegocio }) {
  return (
    <li className="cartao">
      <p>
        <SeloEstado rotulo={v.situacao === "ativo" ? "Ativo" : "Encerrado"} />{" "}
        {v.situacao === "ativo" && !v.indicadorEmDia ? (
          <SeloEstado rotulo="Indicador em atraso" />
        ) : null}
      </p>
      <p className="ajuda quebra-total">
        Indicador (referência): {refCurta(v.indicadorRef)} · Cliente (referência):{" "}
        {refCurta(v.clienteRef)}
      </p>
      {v.inadimplenteDesde ? (
        <p className="ajuda">
          Indicador em atraso desde {formatarDataCivil(v.inadimplenteDesde)}
          {v.encerraEm && v.situacao === "ativo"
            ? `; prazo até ${formatarDataCivil(v.encerraEm)}`
            : ""}
          .
        </p>
      ) : null}
      <p className="ajuda">
        Vinculado em {formatarDataCivil(v.criadoEm)}
        {v.encerradoEm ? ` · encerrado em ${formatarDataCivil(v.encerradoEm)}` : ""}
      </p>
    </li>
  );
}
