import type { Database } from "@/shared/db/database.types";

/**
 * Modelos de leitura de comissões. Nenhum traz nome, telefone, e-mail nem id de conta de cliente ou de indicador
 * (IM-029, IM-041, IM-050): só referências opacas (`clienteRef`, `indicadorRef`). O motivo interno do administrador
 * nunca é lido; só a causa fixa da reversão. Cada campo é copiado um a um, nunca por espalhamento, para que coluna nova
 * da visão não vaze sem revisão. Valores em centavos inteiros; percentual em pontos-base.
 */
type Visoes = Database["public"]["Views"];
type Funcoes = Database["public"]["Functions"];
export type LinhaMinhaComissao = Visoes["comissoes_minhas_comissoes"]["Row"];
export type LinhaMeuSaldo = Visoes["comissoes_meu_saldo"]["Row"];
export type LinhaMinhaSituacao = Visoes["comissoes_minha_situacao"]["Row"];
export type LinhaMeuNegocio = Visoes["comissoes_meus_negocios"]["Row"];
export type LinhaMinhaOferta = Visoes["comissoes_minhas_ofertas"]["Row"];
export type LinhaNegocioComissao = Visoes["comissoes_negocio_comissoes"]["Row"];
export type LinhaNegocioVinculo = Visoes["comissoes_negocio_vinculos"]["Row"];
export type LinhaSituacaoVinculo = Funcoes["comissoes_situacoes_como_indicador"]["Returns"][number];
export type LinhaVinculoVencido = Funcoes["comissoes_listar_vinculos_vencidos"]["Returns"][number];

export type EstadoComissao = "gerada" | "pendente_repasse" | "paga";
export type CausaReversao = "cancelamento" | "estorno" | "correcao";

const ESTADOS: readonly string[] = ["gerada", "pendente_repasse", "paga"];
const CAUSAS: readonly string[] = ["cancelamento", "estorno", "correcao"];

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const estadoValido = (v: string | null): v is EstadoComissao => v !== null && ESTADOS.includes(v);
const causaOuNula = (v: string | null): CausaReversao | null =>
  v !== null && CAUSAS.includes(v) ? (v as CausaReversao) : null;

/** Comissão do indicador. `liquidoCentavos` = valor menos a reversão, quando houver. */
export type MinhaComissao = {
  id: string;
  negocioId: string;
  ofertaNome: string;
  competencia: string;
  baseCentavos: number;
  percentualBp: number;
  valorCentavos: number;
  clienteRef: string;
  estado: EstadoComissao;
  revertida: boolean;
  reversaoCausa: CausaReversao | null;
  liquidoCentavos: number;
  criadaEm: string;
};

/** Saldo próprio de comissões, em centavos. Não soma nada de pontos (IM-065). */
export type MeuSaldoComissoes = {
  totalGeradoCentavos: number;
  liquidoCentavos: number;
  geradaCentavos: number;
  pendenteRepasseCentavos: number;
  pagaCentavos: number;
  revertidaAposPagaCentavos: number;
  quantidade: number;
};

/** Situação do indicador por negócio; base do aviso interno de inadimplência (IM-066, IM-072). */
export type MinhaSituacao = {
  negocioId: string;
  moduloAtivo: boolean;
  clientesAtivos: number;
  clientesEncerrados: number;
  emDia: boolean;
  inadimplenteDesde: string | null;
  encerraEm: string | null;
  prazoDias: number | null;
  /** Derivado: há inadimplência e o prazo ainda não passou (`encerraEm` futuro). */
  emAviso: boolean;
};

export type MeuNegocio = {
  negocioId: string;
  moduloAtivo: boolean;
  habilitadoDesde: string | null;
};

export type MinhaOferta = {
  id: string;
  negocioId: string;
  itemId: string;
  nome: string;
  periodicidade: "mensal";
  percentualBp: number;
  ativa: boolean;
  criadaEm: string;
};

/** Comissão vista pelo anunciante: indicador e cliente só como referência opaca. */
export type ComissaoDoNegocio = {
  id: string;
  negocioId: string;
  ofertaNome: string;
  competencia: string;
  baseCentavos: number;
  percentualBp: number;
  valorCentavos: number;
  indicadorRef: string;
  clienteRef: string;
  estado: EstadoComissao;
  revertida: boolean;
  reversaoCausa: CausaReversao | null;
  liquidoCentavos: number;
  criadaEm: string;
};

export type VinculoDoNegocio = {
  id: string;
  negocioId: string;
  indicadorRef: string;
  clienteRef: string;
  situacao: "ativo" | "encerrado";
  indicadorEmDia: boolean;
  inadimplenteDesde: string | null;
  encerraEm: string | null;
  criadoEm: string;
  encerradoEm: string | null;
};

export type SituacaoVinculo = {
  vinculoId: string;
  emDia: boolean;
  inadimplenteDesde: string | null;
};

/** Vínculo cujo prazo de inadimplência venceu; só o administrador vê e só ele encerra (IM-068, IM-072). */
export type VinculoVencido = {
  vinculoId: string;
  negocioId: string;
  indicadorRef: string;
  inadimplenteDesde: string;
  prazoDias: number;
  venceEm: string;
};

export function paraMinhaComissao(l: LinhaMinhaComissao): MinhaComissao | null {
  if (
    !l.id ||
    !l.negocio_id ||
    !l.competencia ||
    !l.cliente_ref ||
    !l.criada_em ||
    !estadoValido(l.estado)
  )
    return null;
  const valor = num(l.valor_centavos);
  const revertida = l.revertida === true;
  return {
    id: l.id,
    negocioId: l.negocio_id,
    ofertaNome: l.oferta_nome ?? "",
    competencia: l.competencia,
    baseCentavos: num(l.base_centavos),
    percentualBp: num(l.percentual_bp),
    valorCentavos: valor,
    clienteRef: l.cliente_ref,
    estado: l.estado,
    revertida,
    reversaoCausa: causaOuNula(l.reversao_causa),
    liquidoCentavos: revertida ? 0 : valor,
    criadaEm: l.criada_em,
  };
}

export function paraMeuSaldo(l: LinhaMeuSaldo | undefined): MeuSaldoComissoes {
  return {
    totalGeradoCentavos: num(l?.total_gerado_centavos),
    liquidoCentavos: num(l?.liquido_centavos),
    geradaCentavos: num(l?.gerada_centavos),
    pendenteRepasseCentavos: num(l?.pendente_repasse_centavos),
    pagaCentavos: num(l?.paga_centavos),
    revertidaAposPagaCentavos: num(l?.revertida_apos_paga_centavos),
    quantidade: num(l?.quantidade),
  };
}

export function paraMinhaSituacao(l: LinhaMinhaSituacao, hoje: string): MinhaSituacao | null {
  if (!l.negocio_id) return null;
  const desde = l.inadimplente_desde;
  const encerraEm = l.encerra_em;
  return {
    negocioId: l.negocio_id,
    moduloAtivo: l.modulo_ativo === true,
    clientesAtivos: num(l.clientes_ativos),
    clientesEncerrados: num(l.clientes_encerrados),
    emDia: l.em_dia !== false,
    inadimplenteDesde: desde,
    encerraEm,
    prazoDias: typeof l.prazo_dias === "number" ? l.prazo_dias : null,
    emAviso: desde !== null && l.em_dia === false && (encerraEm === null || encerraEm > hoje),
  };
}

export function paraMeuNegocio(l: LinhaMeuNegocio): MeuNegocio | null {
  if (!l.negocio_id) return null;
  return {
    negocioId: l.negocio_id,
    moduloAtivo: l.modulo_ativo === true,
    habilitadoDesde: l.habilitado_desde,
  };
}

export function paraMinhaOferta(l: LinhaMinhaOferta): MinhaOferta | null {
  if (!l.id || !l.negocio_id || !l.item_id || !l.criada_em) return null;
  return {
    id: l.id,
    negocioId: l.negocio_id,
    itemId: l.item_id,
    nome: l.nome ?? "",
    periodicidade: "mensal",
    percentualBp: num(l.percentual_bp),
    ativa: l.ativa === true,
    criadaEm: l.criada_em,
  };
}

export function paraComissaoDoNegocio(l: LinhaNegocioComissao): ComissaoDoNegocio | null {
  if (
    !l.id ||
    !l.negocio_id ||
    !l.competencia ||
    !l.indicador_ref ||
    !l.cliente_ref ||
    !l.criada_em ||
    !estadoValido(l.estado)
  )
    return null;
  const valor = num(l.valor_centavos);
  const revertida = l.revertida === true;
  return {
    id: l.id,
    negocioId: l.negocio_id,
    ofertaNome: l.oferta_nome ?? "",
    competencia: l.competencia,
    baseCentavos: num(l.base_centavos),
    percentualBp: num(l.percentual_bp),
    valorCentavos: valor,
    indicadorRef: l.indicador_ref,
    clienteRef: l.cliente_ref,
    estado: l.estado,
    revertida,
    reversaoCausa: causaOuNula(l.reversao_causa),
    liquidoCentavos: revertida ? 0 : valor,
    criadaEm: l.criada_em,
  };
}

export function paraVinculoDoNegocio(l: LinhaNegocioVinculo): VinculoDoNegocio | null {
  if (!l.id || !l.negocio_id || !l.indicador_ref || !l.cliente_ref || !l.criado_em) return null;
  if (l.situacao !== "ativo" && l.situacao !== "encerrado") return null;
  return {
    id: l.id,
    negocioId: l.negocio_id,
    indicadorRef: l.indicador_ref,
    clienteRef: l.cliente_ref,
    situacao: l.situacao,
    indicadorEmDia: l.indicador_em_dia !== false,
    inadimplenteDesde: l.inadimplente_desde,
    encerraEm: l.encerra_em,
    criadoEm: l.criado_em,
    encerradoEm: l.encerrado_em,
  };
}

export function paraSituacaoVinculo(l: LinhaSituacaoVinculo): SituacaoVinculo | null {
  if (!l.o_vinculo_id) return null;
  return {
    vinculoId: l.o_vinculo_id,
    emDia: l.o_em_dia !== false,
    inadimplenteDesde: l.o_inadimplente_desde ?? null,
  };
}

export function paraVinculoVencido(l: LinhaVinculoVencido): VinculoVencido | null {
  if (
    !l.o_vinculo_id ||
    !l.o_perfil_id ||
    !l.o_indicador_ref ||
    !l.o_inadimplente_desde ||
    !l.o_vence_em
  )
    return null;
  return {
    vinculoId: l.o_vinculo_id,
    negocioId: l.o_perfil_id,
    indicadorRef: l.o_indicador_ref,
    inadimplenteDesde: l.o_inadimplente_desde,
    prazoDias: num(l.o_prazo_dias),
    venceEm: l.o_vence_em,
  };
}
