/**
 * Ciclo de versões de conteúdo (IM-021, IM-022, IM-079), comum a perfis e itens.
 * rascunho -> pendente -> aprovada | rejeitada. No máximo UMA versão aberta (rascunho ou pendente).
 * `publicado` (liga/desliga do dono) e `versao_aprovada_id` (versão no ar) são ponteiros separados:
 * editar nunca mexe em `publicado`, então editar um despublicado não o republica.
 */

export type SituacaoVersao = "rascunho" | "pendente" | "aprovada" | "rejeitada";

export type VersaoBasica = { id: string; situacao: SituacaoVersao; criado_em: string };

export type AcaoDeEdicao =
  | { tipo: "atualizar_rascunho"; versaoId: string }
  | { tipo: "bloqueada_em_analise"; versaoId: string }
  /** Cria rascunho novo copiando `baseId` (null = nada para copiar). A aprovada continua no ar. */
  | { tipo: "nova_versao"; baseId: string | null };

function maisRecentesPrimeiro<T extends VersaoBasica>(versoes: readonly T[]): T[] {
  return versoes
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const d = Date.parse(b.v.criado_em) - Date.parse(a.v.criado_em);
      return d !== 0 && !Number.isNaN(d) ? d : a.i - b.i;
    })
    .map((x) => x.v);
}

export function versaoAberta<T extends VersaoBasica>(versoes: readonly T[]): T | null {
  return versoes.find((v) => v.situacao === "rascunho" || v.situacao === "pendente") ?? null;
}

export function decidirEdicao(versoes: readonly VersaoBasica[]): AcaoDeEdicao {
  const aberta = versaoAberta(versoes);
  if (aberta?.situacao === "rascunho") return { tipo: "atualizar_rascunho", versaoId: aberta.id };
  if (aberta?.situacao === "pendente") return { tipo: "bloqueada_em_analise", versaoId: aberta.id };
  const base = maisRecentesPrimeiro(versoes).find(
    (v) => v.situacao === "aprovada" || v.situacao === "rejeitada",
  );
  return { tipo: "nova_versao", baseId: base?.id ?? null };
}

export type EstadoConteudo = {
  publicado: boolean;
  temAprovada: boolean;
  /** Visível ao público (ignora a disponibilidade do perfil dono, ver `disponivelPublicamente`). */
  noAr: boolean;
  aberta: "rascunho" | "pendente" | null;
  /** A decisão mais recente foi rejeição e ainda não há versão aberta nova. */
  ultimaRejeitada: boolean;
  rotulo: string;
};

export function estadoDoConteudo(
  ponteiros: { publicado: boolean; versao_aprovada_id: string | null },
  versoes: readonly VersaoBasica[],
): EstadoConteudo {
  const ord = maisRecentesPrimeiro(versoes);
  const aberta = versaoAberta(ord);
  const temAprovada = ponteiros.versao_aprovada_id !== null;
  const noAr = ponteiros.publicado && temAprovada;
  const ultimaDecidida = ord.find((v) => v.situacao === "aprovada" || v.situacao === "rejeitada");
  const ultimaRejeitada = !aberta && ultimaDecidida?.situacao === "rejeitada";

  let rotulo: string;
  if (aberta?.situacao === "pendente") {
    rotulo = temAprovada ? "Edição aguardando aprovação" : "Aguardando aprovação";
  } else if (aberta?.situacao === "rascunho") {
    rotulo = temAprovada ? "Edição em rascunho" : "Rascunho";
  } else if (ultimaRejeitada) {
    rotulo = temAprovada ? "Edição rejeitada" : "Rejeitado";
  } else if (noAr) {
    rotulo = "Publicado";
  } else if (temAprovada) {
    rotulo = "Despublicado";
  } else {
    rotulo = "Sem conteúdo";
  }
  return {
    publicado: ponteiros.publicado,
    temAprovada,
    noAr,
    aberta: aberta ? (aberta.situacao as "rascunho" | "pendente") : null,
    ultimaRejeitada,
    rotulo,
  };
}

/** Só se publica o que foi aprovado (o banco também exige). */
export function podePublicar(p: { versao_aprovada_id: string | null }): boolean {
  return p.versao_aprovada_id !== null;
}

/**
 * IM-079: disponível = publicado + aprovado e, para item de perfil, o perfil também disponível.
 * `perfilDisponivel` é null para anúncio particular (sem perfil).
 */
export function disponivelPublicamente(a: {
  publicado: boolean;
  versao_aprovada_id: string | null;
  perfilDisponivel: boolean | null;
}): boolean {
  if (!a.publicado || a.versao_aprovada_id === null) return false;
  return a.perfilDisponivel === null ? true : a.perfilDisponivel;
}
