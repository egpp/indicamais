import type { Database } from "@/shared/db/database.types";
import {
  ALVOS_DENUNCIA,
  PERMISSOES,
  SITUACOES_DENUNCIA,
  TIPOS_DENUNCIA,
  type AlvoDenuncia,
  type Permissao,
  type SituacaoDenuncia,
  type TipoDenuncia,
} from "./ciclo-schemas";

/**
 * Modelos de leitura (D-014). Cada campo é copiado um a um. Autor e denunciante só como `*Ref` opaco. Nenhum modelo tem
 * e-mail, telefone ou nome de pessoa. `contaId` aparece apenas onde é o ALVO de uma ação do administrador
 * (permissões concedidas e contas fora do normal), em visões que só quem tem permissão lê.
 */
type Visoes = Database["public"]["Views"];
export type LinhaMinhaPermissao = Visoes["administracao_minhas_permissoes"]["Row"];
export type LinhaPermissaoConcedida = Visoes["administracao_permissoes_concedidas"]["Row"];
export type LinhaDenunciaFila = Visoes["administracao_fila_denuncias"]["Row"];
export type LinhaDenunciaDecisao = Visoes["administracao_denuncia_decisoes"]["Row"];
export type LinhaContaCicloVida = Visoes["administracao_contas_ciclo_vida"]["Row"];
export type LinhaIndicacaoInvalidada = Visoes["administracao_indicacoes_invalidadas"]["Row"];

const ehPermissao = (v: string | null): v is Permissao =>
  v !== null && (PERMISSOES as readonly string[]).includes(v);
const num = (v: number | null) => (typeof v === "number" && v > 0 ? v : 0);
const dentro = <T extends string>(lista: readonly T[], v: string | null): T | null =>
  v !== null && (lista as readonly string[]).includes(v) ? (v as T) : null;

export type PermissaoConcedida = {
  contaId: string;
  permissao: Permissao;
  concedidaPorRef: string;
  criadoEm: string;
};

export function paraPermissaoConcedida(l: LinhaPermissaoConcedida): PermissaoConcedida | null {
  if (!l.conta_id || !ehPermissao(l.permissao) || !l.concedida_por_ref || !l.criado_em) return null;
  return {
    contaId: l.conta_id,
    permissao: l.permissao,
    concedidaPorRef: l.concedida_por_ref,
    criadoEm: l.criado_em,
  };
}

/** Permissões válidas da própria conta, sem repetição (o administrador geral recebe as seis). */
export function paraMinhasPermissoes(ls: LinhaMinhaPermissao[]): Permissao[] {
  const vistas = new Set<Permissao>();
  for (const l of ls) if (ehPermissao(l.permissao)) vistas.add(l.permissao);
  return PERMISSOES.filter((p) => vistas.has(p));
}

export type DenunciaNaFila = {
  id: string;
  alvoTipo: AlvoDenuncia;
  alvoId: string;
  alvoNome: string | null;
  tipo: TipoDenuncia;
  texto: string | null;
  situacao: SituacaoDenuncia;
  /** "anonimo" ou "conta"; nunca quem é. */
  denuncianteTipo: "anonimo" | "conta";
  /** Chave opaca, só para agrupar denúncias repetidas da mesma origem. */
  denuncianteRef: string;
  totalNoAlvo: number;
  criadoEm: string;
  atualizadoEm: string;
};

export function paraDenunciaNaFila(l: LinhaDenunciaFila): DenunciaNaFila | null {
  if (!l.id || !l.alvo_id || !l.criado_em || !l.atualizado_em || !l.denunciante_ref) return null;
  const alvoTipo = dentro(ALVOS_DENUNCIA, l.alvo_tipo);
  const tipo = dentro(TIPOS_DENUNCIA, l.tipo);
  const situacao = dentro(SITUACOES_DENUNCIA, l.situacao);
  if (!alvoTipo || !tipo || !situacao) return null;
  return {
    id: l.id,
    alvoTipo,
    alvoId: l.alvo_id,
    alvoNome: l.alvo_nome,
    tipo,
    texto: l.texto,
    situacao,
    denuncianteTipo: l.denunciante_tipo === "conta" ? "conta" : "anonimo",
    denuncianteRef: l.denunciante_ref,
    totalNoAlvo: num(l.total_no_alvo),
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

const ORDEM_SITUACAO: Record<SituacaoDenuncia, number> = {
  aberta: 0,
  em_analise: 1,
  procedente: 2,
  improcedente: 3,
};

/** Abertas primeiro, depois em análise; dentro de cada uma, as mais antigas primeiro. */
export const ordenarDenuncias = (xs: DenunciaNaFila[]): DenunciaNaFila[] =>
  [...xs].sort(
    (a, b) =>
      ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] ||
      a.criadoEm.localeCompare(b.criadoEm),
  );

export type DecisaoDeDenuncia = {
  denunciaId: string;
  deSituacao: string;
  paraSituacao: string;
  motivo: string;
  autorRef: string;
  criadoEm: string;
};

export function paraDecisaoDeDenuncia(l: LinhaDenunciaDecisao): DecisaoDeDenuncia | null {
  if (!l.denuncia_id || !l.de_situacao || !l.para_situacao || !l.autor_ref || !l.criado_em) {
    return null;
  }
  return {
    denunciaId: l.denuncia_id,
    deSituacao: l.de_situacao,
    paraSituacao: l.para_situacao,
    motivo: l.motivo ?? "",
    autorRef: l.autor_ref,
    criadoEm: l.criado_em,
  };
}

export type ContaForaDoNormal = {
  contaId: string;
  situacao: "suspensa" | "encerramento_solicitado" | "anonimizada";
  suspensaEm: string | null;
  encerramentoSolicitadoEm: string | null;
  encerramentoExecutarApos: string | null;
  anonimizadaEm: string | null;
  atualizadoEm: string;
};

export function paraContaForaDoNormal(l: LinhaContaCicloVida): ContaForaDoNormal | null {
  if (!l.conta_id || !l.atualizado_em) return null;
  if (
    l.situacao !== "suspensa" &&
    l.situacao !== "encerramento_solicitado" &&
    l.situacao !== "anonimizada"
  ) {
    return null;
  }
  return {
    contaId: l.conta_id,
    situacao: l.situacao,
    suspensaEm: l.suspensa_em,
    encerramentoSolicitadoEm: l.encerramento_solicitado_em,
    encerramentoExecutarApos: l.encerramento_executar_apos,
    anonimizadaEm: l.anonimizada_em,
    atualizadoEm: l.atualizado_em,
  };
}

export type IndicacaoInvalidada = {
  pedidoId: string;
  motivo: string;
  temReversao: boolean;
  autorRef: string;
  criadoEm: string;
};

export function paraIndicacaoInvalidada(l: LinhaIndicacaoInvalidada): IndicacaoInvalidada | null {
  if (!l.pedido_id || !l.autor_ref || !l.criado_em) return null;
  return {
    pedidoId: l.pedido_id,
    motivo: l.motivo ?? "",
    temReversao: l.tem_reversao === true,
    autorRef: l.autor_ref,
    criadoEm: l.criado_em,
  };
}

/** Mais recentes primeiro. */
export const maisRecentesPorCriacao = <T extends { criadoEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
