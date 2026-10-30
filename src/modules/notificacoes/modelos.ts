import type { Database } from "@/shared/db/database.types";
import { ehTipoAviso, textoDoAviso, type TipoAviso } from "./textos";
import { ORIGENS_AVISO, type OrigemAviso } from "./schemas";

/**
 * Modelos de leitura. Nenhum tem id de conta, WhatsApp, e-mail, nome completo nem dado do visitante (IM-029, IM-041,
 * IM-050). Cada campo é copiado um a um, nunca por espalhamento da linha.
 */
type Visoes = Database["public"]["Views"];
export type LinhaAviso = Visoes["notificacoes_meus_avisos"]["Row"];
export type LinhaQuemMeIndicou = Visoes["notificacoes_quem_me_indicou"]["Row"];
export type LinhaMinhaIndicacao = Visoes["indicacoes_minhas_indicacoes"]["Row"];

export type TipoDestino = "perfil" | "item";
const tipoDestino = (v: string | null): TipoDestino | null =>
  v === "perfil" || v === "item" ? v : null;
const ehOrigem = (v: string | null): v is OrigemAviso =>
  v !== null && (ORIGENS_AVISO as readonly string[]).includes(v);

/** Aviso do sino (IM-047, IM-052). `destino` diz qual item abrir ao clicar. */
export type Aviso = {
  origem: OrigemAviso;
  origemId: string;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  destino: { tipo: TipoDestino; id: string; nome: string } | null;
  atorNome: string | null;
  criadoEm: string;
  lida: boolean;
  lidaEm: string | null;
};

/** Contato válido que chegou por indicação a algo do responsável (IM-048). Indicador só por nome público. */
export type QuemMeIndicou = {
  id: string;
  destinoTipo: TipoDestino;
  destinoId: string;
  destinoNome: string;
  perfilDestinoId: string | null;
  perfilDestinoNome: string | null;
  indicadorNome: string | null;
  indicadorRef: string | null;
  indicadorSaiuDaBase: boolean;
  criadoEm: string;
};

/** Indicação feita pela pessoa (IM-049): destino, data e status. Sem nenhum dado do visitante (IM-029). */
export type MinhaIndicacao = {
  id: string;
  destinoTipo: TipoDestino;
  destinoId: string;
  destinoNome: string;
  criadoEm: string;
  status: string;
};

export type AbaMinhasIndicacoes = { total: number; itens: MinhaIndicacao[] };
export type AbaQuemMeIndicou = { total: number; itens: QuemMeIndicou[] };

export function paraAviso(l: LinhaAviso): Aviso | null {
  if (!ehOrigem(l.origem) || !l.origem_id || !ehTipoAviso(l.tipo) || !l.criado_em) return null;
  const tipo = tipoDestino(l.destino_tipo);
  const destino =
    tipo && l.destino_id ? { tipo, id: l.destino_id, nome: l.destino_nome ?? "" } : null;
  const { titulo, texto } = textoDoAviso(l.tipo, l.destino_nome ?? "", l.ator_nome);
  return {
    origem: l.origem,
    origemId: l.origem_id,
    tipo: l.tipo,
    titulo,
    texto,
    destino,
    atorNome: l.ator_nome,
    criadoEm: l.criado_em,
    lida: l.lida ?? false,
    lidaEm: l.lida_em,
  };
}

export function paraQuemMeIndicou(l: LinhaQuemMeIndicou): QuemMeIndicou | null {
  const tipo = tipoDestino(l.destino_tipo);
  if (!tipo || !l.id || !l.destino_id || !l.criado_em) return null;
  const saiu = l.indicador_saiu_da_base ?? false;
  return {
    id: l.id,
    destinoTipo: tipo,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    perfilDestinoId: l.perfil_destino_id,
    perfilDestinoNome: l.perfil_destino_nome,
    // Quem saiu da base não aparece pelo nome nem pela referência (IM-045), mesmo que a linha traga algum.
    indicadorNome: saiu ? null : l.indicador_nome,
    indicadorRef: saiu ? null : l.indicador_ref,
    indicadorSaiuDaBase: saiu,
    criadoEm: l.criado_em,
  };
}

export function paraMinhaIndicacao(l: LinhaMinhaIndicacao): MinhaIndicacao | null {
  const tipo = tipoDestino(l.destino_tipo);
  if (!tipo || !l.id || !l.destino_id || !l.criado_em) return null;
  return {
    id: l.id,
    destinoTipo: tipo,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    criadoEm: l.criado_em,
    status: l.status ?? "recebido",
  };
}

/** Mais recente primeiro. */
export const maisRecentes = <T extends { criadoEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
