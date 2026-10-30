import type { Database } from "@/shared/db/database.types";

/**
 * Tipos de leitura. Linhas = colunas das visões/tabelas; modelos = o que a aplicação entrega.
 * Nenhum modelo tem id de conta, WhatsApp ou dado do visitante (IM-029, IM-041). O indicador NÃO recebe o motivo
 * de um contato não ter pontuado (D-012): os modelos do indicador não trazem decisão alguma.
 */

type Visoes = Database["public"]["Views"];
type Tabelas = Database["public"]["Tables"];
export type LinhaMeuSaldo = Visoes["pontos_meu_saldo"]["Row"];
export type LinhaMeuLancamento = Visoes["pontos_meus_lancamentos"]["Row"];
export type LinhaLancamentoAdmin = Visoes["administracao_pontos_lancamentos"]["Row"];
export type LinhaSaldoAdmin = Visoes["administracao_pontos_saldos"]["Row"];
export type LinhaDecisaoAdmin = Visoes["administracao_pontos_decisoes"]["Row"];
export type LinhaFalhaAdmin = Visoes["administracao_pontos_falhas"]["Row"];
export type LinhaFilaBeneficio = Visoes["administracao_fila_beneficios"]["Row"];
export type LinhaBeneficioPublico = Visoes["pontos_beneficio_publico"]["Row"];
export type LinhaParametrosAtuais =
  Database["public"]["Functions"]["pontos_parametros_atuais"]["Returns"][number];
export type LinhaBeneficio = Pick<
  Tabelas["pontos_beneficio"]["Row"],
  "id" | "perfil_id" | "ativo" | "versao_aprovada_id" | "criado_em"
>;
export type LinhaBeneficioVersao = Pick<
  Tabelas["pontos_beneficio_versao"]["Row"],
  | "id"
  | "beneficio_id"
  | "situacao"
  | "nome"
  | "descricao"
  | "pontos_necessarios"
  | "condicoes"
  | "limite_total"
  | "limite_por_pessoa"
  | "prazo_resgate_ate"
  | "prazo_uso_ate"
  | "criado_em"
  | "enviada_em"
>;
export type LinhaBeneficioRevisao = Pick<
  Tabelas["pontos_beneficio_revisao"]["Row"],
  "versao_id" | "decisao" | "motivo" | "decidida_em"
>;
export type LinhasBeneficiosDoPerfil = {
  beneficios: LinhaBeneficio[];
  versoes: LinhaBeneficioVersao[];
  revisoes: LinhaBeneficioRevisao[];
};

export type TipoLancamento = "credito" | "reversao";
export type SituacaoLancamento = "creditado" | "revertido" | "reversao";
export type TipoDestinoPontos = "perfil" | "item";

const tipoLancamento = (v: string | null): TipoLancamento | null =>
  v === "credito" || v === "reversao" ? v : null;
const situacao = (v: string | null): SituacaoLancamento | null =>
  v === "creditado" || v === "revertido" || v === "reversao" ? v : null;
const tipoDestino = (v: string | null): TipoDestinoPontos | null =>
  v === "perfil" || v === "item" ? v : null;

export const ordenarPorMaisRecente = <T extends { criadoEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));

// Indicador ------------------------------------------------------------------------------------------------------

/** Saldo único, sem expiração (IM-035). totalRevertido é negativo ou zero. */
export type MeuSaldo = {
  saldo: number;
  totalCreditado: number;
  totalRevertido: number;
  ultimoLancamentoEm: string | null;
};

export const SALDO_ZERO: MeuSaldo = {
  saldo: 0,
  totalCreditado: 0,
  totalRevertido: 0,
  ultimoLancamentoEm: null,
};

export function paraMeuSaldo(l: LinhaMeuSaldo | undefined): MeuSaldo {
  if (!l) return SALDO_ZERO;
  return {
    saldo: l.saldo ?? 0,
    totalCreditado: l.total_creditado ?? 0,
    totalRevertido: l.total_revertido ?? 0,
    ultimoLancamentoEm: l.ultimo_lancamento_em,
  };
}

export type MeuLancamento = {
  id: string;
  tipo: TipoLancamento;
  pontos: number;
  situacao: SituacaoLancamento;
  destinoTipo: TipoDestinoPontos;
  destinoId: string;
  destinoNome: string;
  /** Só na reversão: categoria/texto escrito pelo administrador. Observação interna nunca chega aqui. */
  motivo: string | null;
  originalId: string | null;
  criadoEm: string;
};

export function paraMeuLancamento(l: LinhaMeuLancamento): MeuLancamento | null {
  const tipo = tipoLancamento(l.tipo);
  const sit = situacao(l.situacao);
  const dest = tipoDestino(l.destino_tipo);
  if (!l.id || !tipo || !sit || !dest || !l.destino_id || l.pontos === null || !l.criado_em) {
    return null;
  }
  return {
    id: l.id,
    tipo,
    pontos: l.pontos,
    situacao: sit,
    destinoTipo: dest,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    motivo: tipo === "reversao" ? l.motivo : null,
    originalId: l.original_id,
    criadoEm: l.criado_em,
  };
}

// Parâmetros -----------------------------------------------------------------------------------------------------

export type ParametrosPontos = { pontosPorIndicacao: number; intervaloDias: number };

export function paraParametros(l: LinhaParametrosAtuais | undefined): ParametrosPontos | null {
  if (!l) return null;
  if (!Number.isInteger(l.o_pontos_por_indicacao) || !Number.isInteger(l.o_intervalo_dias)) {
    return null;
  }
  return { pontosPorIndicacao: l.o_pontos_por_indicacao, intervaloDias: l.o_intervalo_dias };
}

// Administrador (indicador identificado só por indicador_ref, hash opaco) -----------------------------------------

export type LancamentoAdmin = MeuLancamento & {
  indicadorRef: string;
  pedidoId: string | null;
  confirmouSaldoNegativo: boolean;
};

export function paraLancamentoAdmin(l: LinhaLancamentoAdmin): LancamentoAdmin | null {
  const base = paraMeuLancamento({ ...l, motivo: l.motivo });
  if (!base || !l.indicador_ref) return null;
  return {
    ...base,
    // Para o administrador o motivo é mostrado inteiro.
    motivo: l.motivo,
    indicadorRef: l.indicador_ref,
    pedidoId: l.pedido_id,
    confirmouSaldoNegativo: l.confirmou_saldo_negativo ?? false,
  };
}

export type SaldoAdmin = MeuSaldo & { indicadorRef: string };

export function paraSaldoAdmin(l: LinhaSaldoAdmin): SaldoAdmin | null {
  if (!l.indicador_ref) return null;
  return { ...paraMeuSaldo(l), indicadorRef: l.indicador_ref };
}

export type MotivoDecisao =
  "pontuado" | "sem_atribuicao" | "autoindicacao" | "destino_indisponivel" | "dentro_do_intervalo";

export const ROTULOS_MOTIVO_DECISAO: Record<MotivoDecisao, string> = {
  pontuado: "Pontuou",
  sem_atribuicao: "Sem indicador (contato direto)",
  autoindicacao: "Autoindicação",
  destino_indisponivel: "Destino indisponível",
  dentro_do_intervalo: "Dentro do intervalo do mesmo contato e destino",
};

const motivoDecisao = (v: string | null): MotivoDecisao | null =>
  v && v in ROTULOS_MOTIVO_DECISAO ? (v as MotivoDecisao) : null;

/** Decisão por pedido, só para administrador (auditoria). Nada do visitante; só ids opacos. */
export type DecisaoAdmin = {
  id: number;
  pedidoId: string;
  pedidoCriadoEm: string;
  destinoTipo: TipoDestinoPontos;
  destinoId: string;
  indicadorRef: string | null;
  pontuado: boolean;
  motivo: MotivoDecisao;
  motivoRotulo: string;
  pontos: number;
  intervaloDias: number;
  decididoEm: string;
};

export function paraDecisaoAdmin(l: LinhaDecisaoAdmin): DecisaoAdmin | null {
  const motivo = motivoDecisao(l.motivo);
  const dest = tipoDestino(l.destino_tipo);
  if (
    l.id === null ||
    !l.pedido_id ||
    !l.pedido_criado_em ||
    !motivo ||
    !dest ||
    !l.destino_id ||
    l.pontuado === null ||
    l.pontos === null ||
    l.intervalo_dias === null ||
    !l.decidido_em
  ) {
    return null;
  }
  return {
    id: l.id,
    pedidoId: l.pedido_id,
    pedidoCriadoEm: l.pedido_criado_em,
    destinoTipo: dest,
    destinoId: l.destino_id,
    indicadorRef: l.indicador_ref,
    pontuado: l.pontuado,
    motivo,
    motivoRotulo: ROTULOS_MOTIVO_DECISAO[motivo],
    pontos: l.pontos,
    intervaloDias: l.intervalo_dias,
    decididoEm: l.decidido_em,
  };
}

/** Falha de crédito (IM-028). pendente = o pedido ainda está sem decisão e pode ser reprocessado. */
export type FalhaCredito = {
  pedidoId: string;
  falhas: number;
  ultimaFalhaEm: string;
  ultimoErro: string;
  pendente: boolean;
};

export function paraFalhaCredito(l: LinhaFalhaAdmin): FalhaCredito | null {
  if (!l.pedido_id || l.falhas === null || !l.ultima_falha_em) return null;
  return {
    pedidoId: l.pedido_id,
    falhas: l.falhas,
    ultimaFalhaEm: l.ultima_falha_em,
    ultimoErro: l.ultimo_erro ?? "",
    pendente: l.pendente ?? false,
  };
}

// Benefícios (IM-036): cadastro, sem resgate (IM-037 é futuro) -------------------------------------------------------

export type BeneficioPublico = {
  id: string;
  perfilId: string;
  nome: string;
  descricao: string;
  pontosNecessarios: number;
  condicoes: string | null;
  limiteTotal: number | null;
  limitePorPessoa: number | null;
  /** AAAA-MM-DD, inclusive. */
  prazoResgateAte: string | null;
  prazoUsoAte: string | null;
};

/** Data civil de hoje em America/Sao_Paulo (AAAA-MM-DD). */
export function hojeSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Confirmação D-012: benefício com prazo de resgate vencido sai da vitrine. O último dia do prazo ainda vale. */
export function prazoResgateVigente(prazoResgateAte: string | null, agora: Date): boolean {
  return prazoResgateAte === null || prazoResgateAte >= hojeSaoPaulo(agora);
}

export function paraBeneficioPublico(
  l: LinhaBeneficioPublico,
  agora: Date,
): BeneficioPublico | null {
  if (!l.id || !l.perfil_id || !l.nome || !l.descricao || l.pontos_necessarios === null)
    return null;
  if (!prazoResgateVigente(l.prazo_resgate_ate, agora)) return null;
  return {
    id: l.id,
    perfilId: l.perfil_id,
    nome: l.nome,
    descricao: l.descricao,
    pontosNecessarios: l.pontos_necessarios,
    condicoes: l.condicoes,
    limiteTotal: l.limite_total,
    limitePorPessoa: l.limite_por_pessoa,
    prazoResgateAte: l.prazo_resgate_ate,
    prazoUsoAte: l.prazo_uso_ate,
  };
}

export type SituacaoVersao = "rascunho" | "pendente" | "aprovada" | "rejeitada";

export type VersaoBeneficio = {
  id: string;
  situacao: SituacaoVersao;
  nome: string | null;
  descricao: string | null;
  pontosNecessarios: number | null;
  condicoes: string | null;
  limiteTotal: number | null;
  limitePorPessoa: number | null;
  prazoResgateAte: string | null;
  prazoUsoAte: string | null;
  criadoEm: string;
  enviadaEm: string | null;
  /** Motivo da rejeição, quando houver (o autor da decisão nunca é exposto). */
  motivoRejeicao: string | null;
};

export type BeneficioDoPerfil = {
  id: string;
  perfilId: string;
  ativo: boolean;
  versaoAprovadaId: string | null;
  /** Mais recente primeiro. */
  versoes: VersaoBeneficio[];
};

const situacaoVersao = (v: string): SituacaoVersao | null =>
  v === "rascunho" || v === "pendente" || v === "aprovada" || v === "rejeitada" ? v : null;

export function montarBeneficiosDoPerfil(l: LinhasBeneficiosDoPerfil): BeneficioDoPerfil[] {
  const rejeicao = new Map<string, string | null>();
  for (const r of l.revisoes) if (r.decisao === "rejeitada") rejeicao.set(r.versao_id, r.motivo);
  const out: BeneficioDoPerfil[] = [];
  for (const b of l.beneficios) {
    const versoes: VersaoBeneficio[] = [];
    for (const v of l.versoes) {
      const sit = situacaoVersao(v.situacao);
      if (v.beneficio_id !== b.id || !sit) continue;
      versoes.push({
        id: v.id,
        situacao: sit,
        nome: v.nome,
        descricao: v.descricao,
        pontosNecessarios: v.pontos_necessarios,
        condicoes: v.condicoes,
        limiteTotal: v.limite_total,
        limitePorPessoa: v.limite_por_pessoa,
        prazoResgateAte: v.prazo_resgate_ate,
        prazoUsoAte: v.prazo_uso_ate,
        criadoEm: v.criado_em,
        enviadaEm: v.enviada_em,
        motivoRejeicao: sit === "rejeitada" ? (rejeicao.get(v.id) ?? null) : null,
      });
    }
    out.push({
      id: b.id,
      perfilId: b.perfil_id,
      ativo: b.ativo,
      versaoAprovadaId: b.versao_aprovada_id,
      versoes: ordenarPorMaisRecente(versoes),
    });
  }
  return out;
}

/** Fila do administrador: versões pendentes. eh_edicao = o benefício já tem versão aprovada no ar. */
export type BeneficioPendente = {
  versaoId: string;
  beneficioId: string;
  perfilId: string;
  nome: string;
  enviadaEm: string;
  ehEdicao: boolean;
};

export function paraBeneficioPendente(l: LinhaFilaBeneficio): BeneficioPendente | null {
  if (!l.versao_id || !l.beneficio_id || !l.perfil_id || !l.enviada_em) return null;
  return {
    versaoId: l.versao_id,
    beneficioId: l.beneficio_id,
    perfilId: l.perfil_id,
    nome: l.nome ?? "",
    enviadaEm: l.enviada_em,
    ehEdicao: l.eh_edicao ?? false,
  };
}
