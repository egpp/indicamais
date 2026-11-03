import { paraCard, type CardBusca, type LinhaBusca } from "./modelos";
import { CHAVES_SECAO_HOME, type ChaveSecaoHome } from "./home-schemas";

/** Linha de `busca_home_secoes` (rpc). */
export type LinhaSecaoHome = {
  o_chave: string;
  o_titulo: string;
  o_ordem: number | string;
  o_tipo_item: string;
  o_minimo_itens: number | string;
  o_limite_padrao: number | string;
  o_total_itens: number | string;
  o_exibir: boolean;
};

/** Linha de `busca_home_secao_perfis` (rpc). `o_metrica` e `o_posicao` existem no banco, mas nunca vão ao card. */
export type LinhaPerfilHome = {
  o_posicao?: number | string | null;
  o_id: string;
  o_slug: string | null;
  o_nome: string | null;
  o_descricao: string | null;
  o_imagem_path: string | null;
  o_categoria_id: string | null;
  o_categoria_nome: string | null;
  o_categoria_slug: string | null;
  o_cidade: string | null;
  o_uf: string | null;
  o_metrica?: number | string | null;
};

/** Seção pronta para a interface: título editado pelo administrador e cards de perfil na ordem do banco. */
export type SecaoHome = {
  chave: ChaveSecaoHome;
  titulo: string;
  /** Hoje só "perfil" (D-018); produtos e serviços entram depois. */
  tipoItem: "perfil";
  itens: CardBusca[];
};

/** Parâmetro de exibição de uma seção, já validado (sem o texto cru do banco). */
export type ParametroSecaoHome = {
  chave: ChaveSecaoHome;
  titulo: string;
  ordem: number;
  minimoItens: number;
  exibir: boolean;
};

const inteiro = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
};

/** null quando a linha é inutilizável (chave fora da lista, tipo de item não suportado, título vazio ou números ruins). */
export function paraParametroSecao(l: LinhaSecaoHome): ParametroSecaoHome | null {
  const chave = (CHAVES_SECAO_HOME as readonly string[]).includes(l.o_chave)
    ? (l.o_chave as ChaveSecaoHome)
    : null;
  const titulo = typeof l.o_titulo === "string" ? l.o_titulo.trim() : "";
  const ordem = inteiro(l.o_ordem);
  const minimo = inteiro(l.o_minimo_itens);
  if (!chave || !titulo || ordem === null || minimo === null || minimo < 1) return null;
  if (l.o_tipo_item !== "perfil") return null;
  return { chave, titulo, ordem, minimoItens: minimo, exibir: l.o_exibir === true };
}

/** Linha de perfil da home vira o mesmo card da busca. Campos de pessoa não existem na linha nem no card (IM-029). */
export function paraCardDaHome(l: LinhaPerfilHome): CardBusca | null {
  const linha: LinhaBusca = {
    o_tipo: "perfil",
    o_id: l.o_id,
    o_slug: l.o_slug,
    o_perfil_id: null,
    o_perfil_slug: null,
    o_nome: l.o_nome,
    o_descricao: l.o_descricao,
    o_imagem_path: l.o_imagem_path,
    o_categoria_id: l.o_categoria_id,
    o_categoria_nome: l.o_categoria_nome,
    o_categoria_slug: l.o_categoria_slug,
    o_cidade: l.o_cidade,
    o_uf: l.o_uf,
    o_preco_modo: null,
    o_preco_centavos: null,
    o_total: null,
  };
  return paraCard(linha);
}

/** Entrada mínima de um perfil do usuário para achar a cidade dele (estrutural: o módulo busca não importa perfis). */
export type PerfilParaCidade = {
  publicado: boolean;
  conteudoNoAr: { cidade: string | null; uf: string | null } | null;
};
