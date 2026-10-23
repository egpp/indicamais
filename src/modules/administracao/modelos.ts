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
 * Linha da visão administracao_meus_resultados: uma versão enviada, com a decisão (se houver), como o
 * RESPONSÁVEL a enxerga. O responsável nunca lê as tabelas de revisão; o autor é opaco (`autor_ref`).
 */
export type LinhaResultadoRevisao = {
  tipo: AlvoRevisao;
  alvo_id: string;
  versao_id: string;
  /** 'pendente' | 'aprovada' | 'rejeitada' (situação da versão). */
  situacao: "pendente" | "aprovada" | "rejeitada";
  nome: string | null;
  motivo: string | null;
  decidida_em: string | null;
  enviada_em: string;
  /** Referência OPACA de quem decidiu (hash); nula enquanto pendente. Nunca é id, nome ou e-mail. */
  autor_ref: string | null;
  /** Só para perfil. */
  slug: string | null;
  publicado: boolean;
  /** Esta é a versão aprovada que o perfil/item aponta (a que está no ar quando publicado). */
  versao_vigente: boolean | null;
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
  /** Quem decidiu (referência opaca) e quando (IM-023, IM-086). */
  autorRef: string | null;
  decididaEm: string | null;
  enviadaEm: string;
};

/** IM-023: situação, motivo da rejeição ou link publicado, autor e data. Função pura. */
export function resultadoDaRevisao(l: LinhaResultadoRevisao): ResultadoRevisao {
  const base = {
    alvo: l.tipo,
    alvoId: l.alvo_id,
    versaoId: l.versao_id,
    nome: l.nome,
    autorRef: l.autor_ref,
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
      autorRef: null,
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
  const vigente = l.versao_vigente === true;
  const noAr = vigente && l.publicado;
  let link: string | null = null;
  if (noAr) {
    if (l.tipo === "perfil") link = l.slug ? ROTAS_PUBLICAS.perfil(l.slug) : null;
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
