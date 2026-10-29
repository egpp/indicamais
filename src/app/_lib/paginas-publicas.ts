import { cache } from "react";
import type { CategoriaOpcao } from "./apresentacao";
import { obterContextoPublico } from "./contexto-publico";
import type { ItemDaPagina, PerfilDaPagina } from "./leitura-publica";
import { caminhosDoPerfil } from "./pagina";

/**
 * Carregamento (uma vez por requisição, compartilhado entre `generateMetadata` e a página) do conteúdo público
 * de perfil e item: modelo de exibição dos módulos + nomes de categoria + URLs assinadas geradas no servidor.
 * `null` = não existe ou não está aprovado e publicado (404 genérico, IM-079).
 */

type Urls = Record<string, string>;

async function categoriasPublicas(ctx: ReturnType<typeof obterContextoPublico>) {
  const r = await ctx.busca.listarFiltros();
  const categorias: CategoriaOpcao[] = r.ok
    ? r.valor.categorias.map((c) => ({ id: c.id, nome: c.nome }))
    : [];
  return categorias;
}

export type PerfilCarregado = PerfilDaPagina & { categorias: CategoriaOpcao[]; urls: Urls };

export const carregarPerfilPublico = cache(
  async (slug: string): Promise<PerfilCarregado | null> => {
    const ctx = obterContextoPublico();
    const dados = await ctx.leitura.perfilPorSlug(slug);
    if (!dados) return null;
    const [categorias, urls] = await Promise.all([
      categoriasPublicas(ctx),
      ctx.assinarImagens([
        ...caminhosDoPerfil(dados.perfil),
        ...dados.itens.flatMap((i) => (i.fotoPath ? [i.fotoPath] : [])),
      ]),
    ]);
    return { ...dados, categorias, urls };
  },
);

export type ItemCarregado = ItemDaPagina & { categorias: CategoriaOpcao[]; urls: Urls };

export const carregarItemPublico = cache(async (id: string): Promise<ItemCarregado | null> => {
  const ctx = obterContextoPublico();
  const dados = await ctx.leitura.itemPorId(id);
  if (!dados) return null;
  const [categorias, urls] = await Promise.all([
    categoriasPublicas(ctx),
    ctx.assinarImagens(dados.item.fotoPath ? [dados.item.fotoPath] : []),
  ]);
  return { ...dados, categorias, urls };
});
