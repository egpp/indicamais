import type { Database } from "@/shared/db/database.types";
import type { CausaReversao, EstadoComissao } from "./modelos";

/**
 * Leituras do administrador geral (IM-061 a IM-073). O banco só devolve estas listas a quem é administrador. Trazem
 * id de conta (necessário às ações do administrador) e NUNCA nome, telefone nem e-mail de cliente, indicador ou
 * visitante (IM-029, IM-041, IM-050). O motivo interno do administrador não é coluna. Cada campo é copiado um a um,
 * nunca por espalhamento, para que coluna nova não vaze sem revisão.
 */
type Funcoes = Database["public"]["Functions"];
export type LinhaNegocioAdmin = Funcoes["comissoes_admin_listar_negocios"]["Returns"][number];
export type LinhaAssinaturaAdmin = Funcoes["comissoes_admin_listar_assinaturas"]["Returns"][number];
export type LinhaPagamentoAdmin = Funcoes["comissoes_admin_listar_pagamentos"]["Returns"][number];
export type LinhaComissaoAdmin = Funcoes["comissoes_admin_listar_comissoes"]["Returns"][number];
export type LinhaVinculoAdmin = Funcoes["comissoes_admin_listar_vinculos"]["Returns"][number];
export type LinhaPrazoAdmin = Funcoes["comissoes_admin_prazo_inadimplencia"]["Returns"][number];
export type LinhaNegocioVinculado =
  Funcoes["comissoes_meus_negocios_vinculados"]["Returns"][number];

/** Página de uma lista do administrador; `total` é o total do filtro (não só da página). */
export type Pagina<T> = { itens: T[]; total: number; limite: number; deslocamento: number };

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const texto = (v: string | null | undefined) => (typeof v === "string" && v !== "" ? v : null);
const ESTADOS_COMISSAO: readonly string[] = ["gerada", "pendente_repasse", "paga"];
const CAUSAS: readonly string[] = ["cancelamento", "estorno", "correcao"];
const ESTADOS_PAGAMENTO: readonly string[] = ["confirmado", "estornado"];
const SITUACOES_ASSINATURA: readonly string[] = ["ativa", "encerrada", "cancelada"];

export type NegocioAdmin = {
  negocioId: string;
  slug: string;
  /** Nome PÚBLICO (só se o perfil está publicado); nulo caso contrário. */
  nome: string | null;
  publicado: boolean;
  moduloAtivo: boolean;
  estadoDesde: string | null;
  origem: "espontanea" | "solicitacao" | null;
};

export type AssinaturaAdmin = {
  id: string;
  negocioId: string;
  ofertaId: string;
  ofertaNome: string;
  clienteId: string;
  valorCentavos: number;
  inicio: string;
  fim: string | null;
  situacao: "ativa" | "encerrada" | "cancelada";
  canceladaEm: string | null;
  criadaEm: string;
};

export type PagamentoAdmin = {
  id: string;
  assinaturaId: string;
  negocioId: string;
  ofertaNome: string;
  clienteId: string;
  competencia: string;
  valorCentavos: number;
  estado: "confirmado" | "estornado";
  estornadoEm: string | null;
  comissaoId: string | null;
  confirmadoEm: string;
};

export type ComissaoAdmin = {
  id: string;
  negocioId: string;
  pagamentoId: string;
  ofertaNome: string;
  competencia: string;
  indicadorId: string;
  clienteId: string;
  baseCentavos: number;
  percentualBp: number;
  valorCentavos: number;
  estado: EstadoComissao;
  estadoEm: string | null;
  revertida: boolean;
  reversaoCausa: CausaReversao | null;
  criadaEm: string;
};

export type VinculoAdmin = {
  id: string;
  negocioId: string;
  indicadorId: string;
  clienteId: string;
  situacao: "ativo" | "encerrado";
  indicadorEmDia: boolean;
  inadimplenteDesde: string | null;
  encerraEm: string | null;
  /** Derivado: vínculo ativo cuja data prevista de encerramento já chegou. Só o administrador encerra, um a um. */
  vencido: boolean;
  criadoEm: string;
  encerradoEm: string | null;
};

export type PrazoInadimplencia = {
  prazoDias: number;
  minimo: number;
  maximo: number;
  atualizadoEm: string | null;
};

/** Negócio onde o indicador tem vínculo; nome e slug só se o perfil é público (IM-072). */
export type NegocioVinculado = { negocioId: string; nome: string | null; slug: string | null };

export function paraNegocioAdmin(l: LinhaNegocioAdmin): NegocioAdmin | null {
  if (!l.o_negocio_id || !l.o_slug) return null;
  return {
    negocioId: l.o_negocio_id,
    slug: l.o_slug,
    nome: texto(l.o_nome),
    publicado: l.o_publicado === true,
    moduloAtivo: l.o_modulo_ativo === true,
    estadoDesde: l.o_estado_desde ?? null,
    origem: l.o_origem === "espontanea" || l.o_origem === "solicitacao" ? l.o_origem : null,
  };
}

export function paraAssinaturaAdmin(l: LinhaAssinaturaAdmin): AssinaturaAdmin | null {
  if (
    !l.o_id ||
    !l.o_negocio_id ||
    !l.o_oferta_id ||
    !l.o_cliente_id ||
    !l.o_inicio ||
    !l.o_criada_em ||
    !SITUACOES_ASSINATURA.includes(l.o_situacao)
  )
    return null;
  return {
    id: l.o_id,
    negocioId: l.o_negocio_id,
    ofertaId: l.o_oferta_id,
    ofertaNome: l.o_oferta_nome ?? "",
    clienteId: l.o_cliente_id,
    valorCentavos: num(l.o_valor_centavos),
    inicio: l.o_inicio,
    fim: l.o_fim ?? null,
    situacao: l.o_situacao as AssinaturaAdmin["situacao"],
    canceladaEm: l.o_cancelada_em ?? null,
    criadaEm: l.o_criada_em,
  };
}

export function paraPagamentoAdmin(l: LinhaPagamentoAdmin): PagamentoAdmin | null {
  if (
    !l.o_id ||
    !l.o_assinatura_id ||
    !l.o_negocio_id ||
    !l.o_cliente_id ||
    !l.o_competencia ||
    !l.o_confirmado_em ||
    !ESTADOS_PAGAMENTO.includes(l.o_estado)
  )
    return null;
  return {
    id: l.o_id,
    assinaturaId: l.o_assinatura_id,
    negocioId: l.o_negocio_id,
    ofertaNome: l.o_oferta_nome ?? "",
    clienteId: l.o_cliente_id,
    competencia: l.o_competencia,
    valorCentavos: num(l.o_valor_centavos),
    estado: l.o_estado as PagamentoAdmin["estado"],
    estornadoEm: l.o_estornado_em ?? null,
    comissaoId: l.o_comissao_id ?? null,
    confirmadoEm: l.o_confirmado_em,
  };
}

export function paraComissaoAdmin(l: LinhaComissaoAdmin): ComissaoAdmin | null {
  if (
    !l.o_id ||
    !l.o_negocio_id ||
    !l.o_pagamento_id ||
    !l.o_competencia ||
    !l.o_indicador_id ||
    !l.o_cliente_id ||
    !l.o_criada_em ||
    !ESTADOS_COMISSAO.includes(l.o_estado)
  )
    return null;
  const causa = l.o_reversao_causa ?? null;
  return {
    id: l.o_id,
    negocioId: l.o_negocio_id,
    pagamentoId: l.o_pagamento_id,
    ofertaNome: l.o_oferta_nome ?? "",
    competencia: l.o_competencia,
    indicadorId: l.o_indicador_id,
    clienteId: l.o_cliente_id,
    baseCentavos: num(l.o_base_centavos),
    percentualBp: num(l.o_percentual_bp),
    valorCentavos: num(l.o_valor_centavos),
    estado: l.o_estado as EstadoComissao,
    estadoEm: l.o_estado_em ?? null,
    revertida: l.o_revertida === true,
    reversaoCausa: causa !== null && CAUSAS.includes(causa) ? (causa as CausaReversao) : null,
    criadaEm: l.o_criada_em,
  };
}

export function paraVinculoAdmin(l: LinhaVinculoAdmin, hoje: string): VinculoAdmin | null {
  if (!l.o_id || !l.o_negocio_id || !l.o_indicador_id || !l.o_cliente_id || !l.o_criado_em)
    return null;
  if (l.o_situacao !== "ativo" && l.o_situacao !== "encerrado") return null;
  const encerraEm = l.o_encerra_em ?? null;
  return {
    id: l.o_id,
    negocioId: l.o_negocio_id,
    indicadorId: l.o_indicador_id,
    clienteId: l.o_cliente_id,
    situacao: l.o_situacao,
    indicadorEmDia: l.o_indicador_em_dia !== false,
    inadimplenteDesde: l.o_inadimplente_desde ?? null,
    encerraEm,
    vencido: l.o_situacao === "ativo" && encerraEm !== null && encerraEm <= hoje,
    criadoEm: l.o_criado_em,
    encerradoEm: l.o_encerrado_em ?? null,
  };
}

export function paraPrazoInadimplencia(l: LinhaPrazoAdmin | undefined): PrazoInadimplencia | null {
  if (!l || typeof l.o_prazo_dias !== "number") return null;
  return {
    prazoDias: l.o_prazo_dias,
    minimo: num(l.o_minimo),
    maximo: num(l.o_maximo),
    atualizadoEm: l.o_atualizado_em ?? null,
  };
}

export function paraNegocioVinculado(l: LinhaNegocioVinculado): NegocioVinculado | null {
  if (!l.o_negocio_id) return null;
  return { negocioId: l.o_negocio_id, nome: texto(l.o_nome), slug: texto(l.o_slug) };
}

/** Total do filtro, lido da primeira linha (todas repetem o mesmo `o_total`). */
export function totalDe(linhas: readonly { o_total: number }[]): number {
  return num(linhas[0]?.o_total);
}
