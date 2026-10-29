import { paraItemPublico, type ItemExibicao, type LinhaItemPublico } from "@/modules/catalogo";
import { paraPerfilPublico, type LinhaPerfilPublico, type PerfilExibicao } from "@/modules/perfis";
import type { RespostaBanco } from "@/shared/conteudo/resultado";
import { SLUG_FORMATO } from "@/shared/formatacao/slug";

/**
 * Leitura das páginas públicas de perfil e item (IM-011, IM-014, IM-015, IM-079). Lê SÓ as visões públicas
 * (`perfis_perfil_publico`, `catalogo_item_publico`): o que não está aprovado, publicado e disponível nem chega
 * aqui (a RLS e as visões cortam), e o resultado vira o mesmo modelo de exibição dos módulos, que não tem
 * WhatsApp, responsável, e-mail nem id de conta (IM-029). Sessão anônima.
 */
export interface ClienteBancoLeituraPublica {
  buscarPerfilPorSlug(slug: string): Promise<RespostaBanco<LinhaPerfilPublico>>;
  buscarPerfilPorId(id: string): Promise<RespostaBanco<LinhaPerfilPublico>>;
  buscarItemPorId(id: string): Promise<RespostaBanco<LinhaItemPublico>>;
  listarItensDoPerfil(perfilId: string): Promise<RespostaBanco<LinhaItemPublico[]>>;
}

export type PerfilDaPagina = { perfil: PerfilExibicao; itens: ItemExibicao[] };
export type ItemDaPagina = {
  item: ItemExibicao;
  /** Perfil dono do item (null no anúncio particular). */
  perfil: Pick<PerfilExibicao, "id" | "slug" | "nome"> | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Falha técnica na leitura (diferente de "não existe"): vira erro 500, nunca 404 nem texto do banco. */
export class FalhaLeituraPublica extends Error {
  constructor() {
    super("Falha ao ler o conteúdo público.");
    this.name = "FalhaLeituraPublica";
  }
}

export function criarLeituraPublica(banco: ClienteBancoLeituraPublica) {
  async function ler<T>(f: () => Promise<RespostaBanco<T>>): Promise<T | null> {
    let r: RespostaBanco<T>;
    try {
      r = await f();
    } catch {
      throw new FalhaLeituraPublica();
    }
    if (r.erro) throw new FalhaLeituraPublica();
    return r.dados ?? null;
  }

  return {
    /** null = não existe, não está aprovado+publicado ou o perfil está indisponível (IM-079). */
    async perfilPorSlug(slug: string): Promise<PerfilDaPagina | null> {
      if (slug.length > 60 || !SLUG_FORMATO.test(slug)) return null;
      const linha = await ler(() => banco.buscarPerfilPorSlug(slug));
      if (!linha || !linha.id) return null;
      const itens = (await ler(() => banco.listarItensDoPerfil(linha.id))) ?? [];
      return { perfil: paraPerfilPublico(linha), itens: itens.map(paraItemPublico) };
    },

    /** Só os dados básicos do perfil publicado e disponível (null = indisponível). Sem itens. */
    async perfilPorId(id: string): Promise<Pick<PerfilExibicao, "id" | "slug" | "nome"> | null> {
      if (!UUID.test(id)) return null;
      const linha = await ler(() => banco.buscarPerfilPorId(id.toLowerCase()));
      if (!linha || !linha.id) return null;
      const m = paraPerfilPublico(linha);
      return { id: m.id, slug: m.slug, nome: m.nome };
    },

    /** null = item inexistente, não publicado, ou do perfil indisponível; o anúncio particular independe do perfil. */
    async itemPorId(id: string): Promise<ItemDaPagina | null> {
      if (!UUID.test(id)) return null;
      const linha = await ler(() => banco.buscarItemPorId(id.toLowerCase()));
      if (!linha || !linha.id) return null;
      const item = paraItemPublico(linha);
      let perfil: ItemDaPagina["perfil"] = null;
      if (item.perfilId) {
        const p = await ler(() => banco.buscarPerfilPorId(item.perfilId!));
        if (p) {
          const m = paraPerfilPublico(p);
          perfil = { id: m.id, slug: m.slug, nome: m.nome };
        }
      }
      return { item, perfil };
    },
  };
}

export type LeituraPublica = ReturnType<typeof criarLeituraPublica>;
