import type { Database } from "@/shared/db/database.types";

/**
 * Modelos de leitura. Nenhum tem id de conta, WhatsApp, e-mail ou nome completo (IM-041, IM-050). O responsável vê só
 * o nome público ("Maria S." ou "Pessoa"), datas e contagens. Cada campo é copiado um a um, nunca por espalhamento.
 */
type Visoes = Database["public"]["Views"];
export type LinhaMeuMembro = Visoes["relacionamento_meus_membros"]["Row"];
export type LinhaMeuResumo = Visoes["relacionamento_meu_resumo"]["Row"];
export type LinhaMinhaParticipacao = Visoes["relacionamento_minhas_participacoes"]["Row"];

/** Membro da base de um perfil do responsável. `id` é o do registro de membro, não de conta. */
export type MembroDaBase = {
  id: string;
  perfilId: string;
  perfilNome: string;
  pessoaNome: string;
  curtiu: boolean;
  curtidaEm: string | null;
  indicou: boolean;
  primeiraIndicacaoEm: string | null;
  ultimaIndicacaoEm: string | null;
  indicacoesValidas: number;
  interacoes: number;
  entrouEm: string;
};

/** Totais por perfil. `saidas` é histórico agregado e anônimo (IM-045). */
export type ResumoDaBase = {
  perfilId: string;
  perfilNome: string;
  membros: number;
  curtidasAtivas: number;
  indicadores: number;
  interacoes: number;
  saidas: number;
};

/** Base em que a pessoa está (para curtir/descurtir e "Sair da base"). */
export type MinhaParticipacao = {
  perfilId: string;
  perfilSlug: string;
  perfilNome: string;
  curtiu: boolean;
  curtidaEm: string | null;
  indicou: boolean;
  indicacoesValidas: number;
  entrouEm: string;
};

/** Resultado idempotente de curtir/descurtir/sair: `alterou` = false quando já estava nesse estado. */
export type ResultadoAcaoBase = { alterou: boolean };

const NOME_PADRAO = "Pessoa";
const num = (v: number | null) => (typeof v === "number" && v > 0 ? v : 0);

export function paraMembroDaBase(l: LinhaMeuMembro): MembroDaBase | null {
  if (!l.id || !l.perfil_id || !l.entrou_em) return null;
  return {
    id: l.id,
    perfilId: l.perfil_id,
    perfilNome: l.perfil_nome ?? "",
    pessoaNome: l.pessoa_nome?.trim() || NOME_PADRAO,
    curtiu: l.curtiu ?? false,
    curtidaEm: l.curtida_em,
    indicou: l.indicou ?? false,
    primeiraIndicacaoEm: l.primeira_indicacao_em,
    ultimaIndicacaoEm: l.ultima_indicacao_em,
    indicacoesValidas: num(l.indicacoes_validas),
    interacoes: num(l.interacoes),
    entrouEm: l.entrou_em,
  };
}

export function paraResumoDaBase(l: LinhaMeuResumo): ResumoDaBase | null {
  if (!l.perfil_id) return null;
  return {
    perfilId: l.perfil_id,
    perfilNome: l.perfil_nome ?? "",
    membros: num(l.membros),
    curtidasAtivas: num(l.curtidas_ativas),
    indicadores: num(l.indicadores),
    interacoes: num(l.interacoes),
    saidas: num(l.saidas),
  };
}

export function paraMinhaParticipacao(l: LinhaMinhaParticipacao): MinhaParticipacao | null {
  if (!l.perfil_id || !l.perfil_slug || !l.entrou_em) return null;
  return {
    perfilId: l.perfil_id,
    perfilSlug: l.perfil_slug,
    perfilNome: l.perfil_nome ?? "",
    curtiu: l.curtiu ?? false,
    curtidaEm: l.curtida_em,
    indicou: l.indicou ?? false,
    indicacoesValidas: num(l.indicacoes_validas),
    entrouEm: l.entrou_em,
  };
}

/** Mais recente primeiro (por entrada). */
export const maisRecentes = <T extends { entrouEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => b.entrouEm.localeCompare(a.entrouEm));
