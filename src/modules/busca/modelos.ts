import { formatarPreco, precoDeColunas } from "@/modules/catalogo";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import { TIPOS_BUSCA, type TipoBusca } from "./schemas";

/** Linha de `busca_publica` (rpc). O tipo lista só o que o banco deve devolver; extras são ignorados. */
export type LinhaBusca = {
  o_tipo: string;
  o_id: string;
  o_slug: string | null;
  o_perfil_id: string | null;
  o_perfil_slug: string | null;
  o_nome: string | null;
  o_descricao: string | null;
  o_imagem_path: string | null;
  o_categoria_id: string | null;
  o_categoria_nome: string | null;
  o_categoria_slug: string | null;
  o_cidade: string | null;
  o_uf: string | null;
  o_preco_modo: string | null;
  o_preco_centavos: number | string | null;
  o_total: number | string | null;
};

/**
 * Card da busca/home (IM-019). Montado campo a campo: NUNCA contém WhatsApp, responsável, e-mail nem id de
 * conta (IM-029), mesmo que a linha do banco traga colunas a mais.
 */
export type CardBusca = {
  tipo: TipoBusca;
  /** id do perfil ou do item. */
  id: string;
  /** Só perfil. */
  slug: string | null;
  /** Página pública do próprio card (perfil ou item). */
  link: string;
  nome: string;
  /** Até 200 caracteres (o banco já corta). */
  descricaoCurta: string | null;
  /** Caminho opaco no bucket; a URL é gerada no servidor. */
  imagemPath: string | null;
  categoria: { id: string; nome: string; slug: string } | null;
  /** Perfil: do perfil. Item de perfil: herdada do perfil. Anúncio particular: a do próprio anúncio. */
  cidade: string | null;
  uf: string | null;
  /** "R$ 10,00", "A partir de R$ 10,00", "Sob consulta" ou null (perfil e item sem preço). */
  precoTexto: string | null;
  /** Item sem perfil comercial (IM-015): o link vai para a página do item. */
  anuncioParticular: boolean;
  /** Item de perfil: link para o perfil dono; senão null. */
  perfilLink: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const aparar = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** null quando a linha é inutilizável (tipo/id/nome inválidos): some em vez de quebrar a página. */
export function paraCard(l: LinhaBusca): CardBusca | null {
  const tipo = (TIPOS_BUSCA as readonly string[]).includes(l.o_tipo)
    ? (l.o_tipo as TipoBusca)
    : null;
  const nome = aparar(l.o_nome);
  if (!tipo || !nome || typeof l.o_id !== "string" || !UUID.test(l.o_id)) return null;
  const id = l.o_id.toLowerCase();
  const slug = tipo === "perfil" ? aparar(l.o_slug) : null;
  if (tipo === "perfil" && !slug) return null;
  const perfilSlug = tipo === "perfil" ? null : aparar(l.o_perfil_slug);
  const categoriaId = aparar(l.o_categoria_id);
  const categoriaNome = aparar(l.o_categoria_nome);
  return {
    tipo,
    id,
    slug,
    link: tipo === "perfil" ? ROTAS_PUBLICAS.perfil(slug!) : ROTAS_PUBLICAS.item(id),
    nome,
    descricaoCurta: aparar(l.o_descricao),
    imagemPath: aparar(l.o_imagem_path),
    categoria:
      categoriaId && categoriaNome
        ? { id: categoriaId, nome: categoriaNome, slug: aparar(l.o_categoria_slug) ?? "" }
        : null,
    cidade: aparar(l.o_cidade),
    uf: aparar(l.o_uf),
    precoTexto:
      tipo === "perfil" ? null : formatarPreco(precoDeColunas(l.o_preco_modo, l.o_preco_centavos)),
    anuncioParticular: tipo !== "perfil" && !l.o_perfil_id,
    perfilLink: perfilSlug ? ROTAS_PUBLICAS.perfil(perfilSlug) : null,
  };
}

export type PaginaBusca = {
  cards: CardBusca[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
  temMais: boolean;
};

/** Total vem do count(*) over () (bigint pode chegar como texto). Sem linhas = 0. */
export function totalDasLinhas(linhas: LinhaBusca[]): number {
  const n = Number(linhas[0]?.o_total ?? 0);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function paraPagina(linhas: LinhaBusca[], pagina: number, limite: number): PaginaBusca {
  const total = totalDasLinhas(linhas);
  const totalPaginas = total === 0 ? 0 : Math.ceil(total / limite);
  return {
    cards: linhas.map(paraCard).filter((c): c is CardBusca => c !== null),
    pagina,
    limite,
    total,
    totalPaginas,
    temMais: pagina < totalPaginas,
  };
}
