import {
  conteudoDeVersao as conteudoDeItem,
  paraItemExibicao,
  type ItemExibicao,
} from "@/modules/catalogo";
import {
  conteudoDeVersao as conteudoDePerfil,
  paraPerfilExibicao,
  type PerfilExibicao,
} from "@/modules/perfis";
import type { AlvoRevisao } from "@/modules/administracao";
import type { Contexto } from "./contexto";
import { caminhosDoPerfil } from "./pagina";

export type ConteudoParaRevisao =
  | { tipo: "perfil"; perfil: PerfilExibicao; caminhos: string[] }
  | { tipo: "item"; item: ItemExibicao; caminhos: string[] };

/**
 * Conteúdo de uma versão pendente para o administrador conferir. Passa pelos modelos de exibição dos módulos,
 * que por construção não têm WhatsApp, responsável nem e-mail (IM-029). `null` = não encontrado ou falha.
 */
export async function carregarConteudoRevisao(
  ctx: Contexto,
  alvo: AlvoRevisao,
  versaoId: string,
): Promise<ConteudoParaRevisao | null> {
  try {
    if (alvo === "perfil") {
      const r = await ctx.revisao.buscarVersaoPerfil(versaoId);
      if (r.erro || !r.dados) return null;
      const perfil = paraPerfilExibicao(r.dados.perfil, conteudoDePerfil(r.dados.versao));
      return { tipo: "perfil", perfil, caminhos: caminhosDoPerfil(perfil) };
    }
    const r = await ctx.revisao.buscarVersaoItem(versaoId);
    if (r.erro || !r.dados) return null;
    const item = paraItemExibicao(r.dados.item, conteudoDeItem(r.dados.versao));
    return { tipo: "item", item, caminhos: item.fotoPath ? [item.fotoPath] : [] };
  } catch {
    return null;
  }
}
