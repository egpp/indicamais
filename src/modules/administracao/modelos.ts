import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import type { AlvoRevisao } from "./schemas";

/** Linha de public.administracao_fila_pendencias (só administradores leem). */
export type LinhaFila = {
  alvo_tipo: AlvoRevisao;
  versao_id: string;
  alvo_id: string;
  nome: string | null;
  enviada_em: string;
  dono_id: string;
  eh_edicao: boolean;
};

export type ItemFila = {
  alvo: AlvoRevisao;
  versaoId: string;
  alvoId: string;
  nome: string | null;
  enviadaEm: string;
  /** Edição de conteúdo já aprovado (a versão aprovada segue no ar até a decisão). */
  ehEdicao: boolean;
  donoId: string;
  /** O conteúdo é do próprio administrador logado: ele não pode decidir. */
  proprio: boolean;
};

/** O dono nunca decide o próprio conteúdo (IM-021; o banco também recusa). */
export function podeDecidir(a: { adminId: string; donoId: string }): boolean {
  return a.adminId !== a.donoId;
}

/** Mais antigos primeiro (ordem de chegada). */
export function paraItemFila(l: LinhaFila, adminId: string): ItemFila {
  return {
    alvo: l.alvo_tipo,
    versaoId: l.versao_id,
    alvoId: l.alvo_id,
    nome: l.nome,
    enviadaEm: l.enviada_em,
    ehEdicao: l.eh_edicao,
    donoId: l.dono_id,
    proprio: !podeDecidir({ adminId, donoId: l.dono_id }),
  };
}

export function ordenarFila(itens: ItemFila[]): ItemFila[] {
  return [...itens].sort((a, b) => Date.parse(a.enviadaEm) - Date.parse(b.enviadaEm));
}

/**
 * Uma versão enviada, com a decisão (se houver), como o responsável a enxerga.
 * O adaptador junta versão + revisão + ponteiros do pai (perfil ou item).
 */
export type LinhaResultadoRevisao = {
  alvo_tipo: AlvoRevisao;
  alvo_id: string;
  versao_id: string;
  nome: string | null;
  /** Só para perfil. */
  slug: string | null;
  enviada_em: string;
  /** 'pendente' | 'aprovada' | 'rejeitada' (situação da versão). */
  situacao: "pendente" | "aprovada" | "rejeitada";
  motivo: string | null;
  autor_id: string | null;
  decidida_em: string | null;
  /** Ponteiros do pai, para saber se esta versão é a que está no ar. */
  publicado: boolean;
  versao_aprovada_id: string | null;
};

export type ResultadoRevisao = {
  alvo: AlvoRevisao;
  alvoId: string;
  versaoId: string;
  nome: string | null;
  situacao: "em_analise" | "aprovado" | "rejeitado";
  /** Texto para o painel. */
  mensagem: string;
  /** Só na rejeição. */
  motivo: string | null;
  /** Só quando esta versão está no ar agora (aprovada, publicada e vigente). */
  linkPublicado: string | null;
  /** Quem decidiu e quando (IM-023, IM-086). */
  autorId: string | null;
  decididaEm: string | null;
  enviadaEm: string;
};

/** IM-023: situação, motivo da rejeição ou link publicado, autor e data. Função pura. */
export function resultadoDaRevisao(l: LinhaResultadoRevisao): ResultadoRevisao {
  const base = {
    alvo: l.alvo_tipo,
    alvoId: l.alvo_id,
    versaoId: l.versao_id,
    nome: l.nome,
    autorId: l.autor_id,
    decididaEm: l.decidida_em,
    enviadaEm: l.enviada_em,
  };
  if (l.situacao === "pendente") {
    return {
      ...base,
      situacao: "em_analise",
      mensagem: "Em análise. Avisaremos aqui quando houver decisão.",
      motivo: null,
      linkPublicado: null,
      autorId: null,
      decididaEm: null,
    };
  }
  if (l.situacao === "rejeitada") {
    return {
      ...base,
      situacao: "rejeitado",
      mensagem: "Rejeitado. Veja o motivo, ajuste e envie novamente.",
      motivo: l.motivo,
      linkPublicado: null,
    };
  }
  const vigente = l.versao_aprovada_id === l.versao_id;
  const noAr = vigente && l.publicado;
  let link: string | null = null;
  if (noAr) {
    if (l.alvo_tipo === "perfil") link = l.slug ? ROTAS_PUBLICAS.perfil(l.slug) : null;
    else link = ROTAS_PUBLICAS.item(l.alvo_id);
  }
  return {
    ...base,
    situacao: "aprovado",
    mensagem: noAr
      ? "Aprovado e publicado."
      : vigente
        ? "Aprovado. Está despublicado: publique quando quiser."
        : "Aprovado. Já foi substituído por uma versão mais recente.",
    motivo: null,
    linkPublicado: link,
  };
}

/** Mais recentes primeiro (decisão, ou envio se ainda em análise). */
export function ordenarResultados(rs: ResultadoRevisao[]): ResultadoRevisao[] {
  const chave = (r: ResultadoRevisao) => Date.parse(r.decididaEm ?? r.enviadaEm);
  return [...rs].sort((a, b) => chave(b) - chave(a));
}
