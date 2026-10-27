import type { ItemExibicao } from "@/modules/catalogo";
import type { PerfilExibicao } from "@/modules/perfis";
import type { AlvoRevisao } from "@/modules/administracao";
import type { Contexto } from "./contexto";
import { caminhosDoPerfil } from "./pagina";

export type ConteudoParaRevisao =
  | { tipo: "perfil"; perfil: PerfilExibicao; caminhos: string[] }
  | { tipo: "item"; item: ItemExibicao; caminhos: string[] };

/**
 * Conteúdo de uma versão pendente para o administrador conferir. Vem dos serviços dos módulos (só administrador), em formato de exibição,
 * que por construção não têm WhatsApp, responsável nem e-mail (IM-029). `null` = não encontrado ou falha.
 */
export async function carregarConteudoRevisao(
  ctx: Contexto,
  alvo: AlvoRevisao,
  versaoId: string,
): Promise<ConteudoParaRevisao | null> {
  try {
    if (alvo === "perfil") {
      const r = await ctx.perfis.obterVersaoParaRevisao(versaoId);
      if (!r.ok) return null;
      return { tipo: "perfil", perfil: r.valor.perfil, caminhos: caminhosDoPerfil(r.valor.perfil) };
    }
    const r = await ctx.itens.obterVersaoParaRevisao(versaoId);
    if (!r.ok) return null;
    const item = r.valor.item;
    return { tipo: "item", item, caminhos: item.fotoPath ? [item.fotoPath] : [] };
  } catch {
    return null;
  }
}
