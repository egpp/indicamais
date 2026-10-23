import { categoriasParaColunas, colunasParaCategorias } from "@/shared/conteudo/categorias";
import type { SituacaoVersao } from "@/shared/conteudo/ciclo-versao";
import { precoDeColunas, precoParaColunas, formatarPreco, type Preco } from "./preco";
import type { TipoItem } from "./schemas";

/** Linhas como o banco devolve (colunas de catalogo_item, catalogo_item_versao e catalogo_categoria*). */
export type LinhaItem = {
  id: string;
  perfil_id: string | null;
  tipo: TipoItem;
  publicado: boolean;
  versao_aprovada_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type LinhaItemVersao = {
  id: string;
  item_id: string;
  situacao: SituacaoVersao;
  nome: string | null;
  descricao: string | null;
  foto_path: string | null;
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
  preco_modo: string | null;
  preco_centavos: number | string | null;
  criado_em: string;
  enviada_em: string | null;
};

/** Linha da visão catalogo_item_publico. Sem conta_id. */
export type LinhaItemPublico = {
  id: string;
  perfil_id: string | null;
  tipo: TipoItem;
  nome: string | null;
  descricao: string | null;
  foto_path: string | null;
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
  preco_modo: string | null;
  preco_centavos: number | string | null;
  criado_em: string;
};

export type LinhaCategoria = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

export type LinhaSolicitacao = {
  id: string;
  solicitante_id: string;
  nome_sugerido: string;
  justificativa: string | null;
  situacao: "pendente" | "atendida" | "recusada";
  categoria_id: string | null;
  motivo_resposta: string | null;
  decidida_em: string | null;
  criado_em: string;
};

/** Conteúdo editável de uma versão de item, em forma de domínio. */
export type ConteudoItem = {
  nome: string | null;
  descricao: string | null;
  fotoPath: string | null;
  categoriaPrincipalId: string | null;
  categoriasSecundariasIds: string[];
  preco: Preco | null;
};

export const CONTEUDO_ITEM_VAZIO: ConteudoItem = {
  nome: null,
  descricao: null,
  fotoPath: null,
  categoriaPrincipalId: null,
  categoriasSecundariasIds: [],
  preco: null,
};

export function conteudoDeVersao(v: LinhaItemVersao): ConteudoItem {
  const cat = colunasParaCategorias(v);
  return {
    nome: v.nome,
    descricao: v.descricao,
    fotoPath: v.foto_path,
    categoriaPrincipalId: cat.principalId,
    categoriasSecundariasIds: cat.secundariasIds,
    preco: precoDeColunas(v.preco_modo, v.preco_centavos),
  };
}

export function colunasDeConteudo(c: ConteudoItem) {
  return {
    nome: c.nome,
    descricao: c.descricao,
    foto_path: c.fotoPath,
    ...categoriasParaColunas({
      principalId: c.categoriaPrincipalId,
      secundariasIds: c.categoriasSecundariasIds,
    }),
    ...precoParaColunas(c.preco),
  };
}
export type ColunasVersaoItem = ReturnType<typeof colunasDeConteudo>;

/**
 * Modelo de exibição de um item. É o MESMO formato para a página pública e para a prévia (IM-017),
 * e por construção não tem conta/dono, e-mail nem telefone (IM-029). Campos copiados um a um.
 */
export type ItemExibicao = {
  id: string;
  perfilId: string | null;
  /** Anúncio particular (IM-015): sem perfil comercial. */
  anuncioParticular: boolean;
  tipo: TipoItem;
  nome: string | null;
  descricao: string | null;
  fotoPath: string | null;
  categoriaPrincipalId: string | null;
  categoriasSecundariasIds: string[];
  preco: Preco | null;
  /** "R$ 10,00", "A partir de R$ 10,00", "Sob consulta" ou null. */
  precoTexto: string | null;
};

export function paraItemExibicao(
  base: { id: string; perfil_id: string | null; tipo: TipoItem },
  conteudo: ConteudoItem,
): ItemExibicao {
  return {
    id: base.id,
    perfilId: base.perfil_id,
    anuncioParticular: base.perfil_id === null,
    tipo: base.tipo,
    nome: conteudo.nome,
    descricao: conteudo.descricao,
    fotoPath: conteudo.fotoPath,
    categoriaPrincipalId: conteudo.categoriaPrincipalId,
    categoriasSecundariasIds: [...conteudo.categoriasSecundariasIds],
    preco: conteudo.preco,
    precoTexto: formatarPreco(conteudo.preco),
  };
}

/** Linha da visão pública -> modelo público. Ignora qualquer coluna fora da lista. */
export function paraItemPublico(l: LinhaItemPublico): ItemExibicao {
  return paraItemExibicao(
    { id: l.id, perfil_id: l.perfil_id, tipo: l.tipo },
    conteudoDeVersao({
      id: "",
      item_id: l.id,
      situacao: "aprovada",
      nome: l.nome,
      descricao: l.descricao,
      foto_path: l.foto_path,
      categoria_principal_id: l.categoria_principal_id,
      categoria_secundaria_1_id: l.categoria_secundaria_1_id,
      categoria_secundaria_2_id: l.categoria_secundaria_2_id,
      preco_modo: l.preco_modo,
      preco_centavos: l.preco_centavos,
      criado_em: l.criado_em,
      enviada_em: null,
    }),
  );
}

/** Parâmetros de `catalogo_criar_item`: sem foto (o item precisa existir antes do upload). */
export type DadosCriarItem = Omit<ColunasVersaoItem, "foto_path"> & {
  tipo: TipoItem;
  perfil_id: string | null;
};

export function dadosDeCriacao(
  c: ConteudoItem,
  tipo: TipoItem,
  perfilId: string | null,
): DadosCriarItem {
  const cols = colunasDeConteudo(c);
  return {
    nome: cols.nome,
    descricao: cols.descricao,
    categoria_principal_id: cols.categoria_principal_id,
    categoria_secundaria_1_id: cols.categoria_secundaria_1_id,
    categoria_secundaria_2_id: cols.categoria_secundaria_2_id,
    preco_modo: cols.preco_modo,
    preco_centavos: cols.preco_centavos,
    tipo,
    perfil_id: perfilId,
  };
}
