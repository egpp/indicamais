import { z } from "zod";
import { SLUG_FORMATO } from "@/shared/formatacao/slug";
import type { ContextoPublico } from "./contexto-publico";

/**
 * Imagem estável de prévia (Open Graph) para WhatsApp e redes. A URL assinada do Storage expira em 1 hora, mas
 * as redes reabrem a imagem depois; por isso o og:image aponta para estas rotas, que assinam NO SERVIDOR a cada
 * pedido e respondem 302. Só entram slug ou id validados (nunca caminho do Storage); só conteúdo aprovado,
 * publicado e disponível (a mesma leitura anônima das páginas); o resto é 404 genérico (IM-079). A resposta não
 * leva metadado do objeto (owner) nem cabeçalho do Storage (IM-029, IM-086).
 */
export const IMAGEM_PADRAO = "/og-padrao.png";

const slugSchema = z.string().max(60).regex(SLUG_FORMATO);
const idSchema = z.uuid();

const CABECALHOS = {
  "Cache-Control": "public, max-age=300, s-maxage=300",
  "X-Robots-Tag": "noindex, nofollow",
};

const naoEncontrada = () =>
  new Response("Não encontrado", {
    status: 404,
    headers: {
      ...CABECALHOS,
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

const redirecionar = (destino: string) =>
  new Response(null, { status: 302, headers: { ...CABECALHOS, Location: destino } });

async function destinoDaImagem(ctx: ContextoPublico, caminho: string | null | undefined) {
  if (!caminho) return IMAGEM_PADRAO;
  const urls = await ctx.assinarImagens([caminho]);
  return urls[caminho] ?? IMAGEM_PADRAO;
}

export async function imagemPreviaPerfil(ctx: ContextoPublico, slug: string): Promise<Response> {
  const v = slugSchema.safeParse(slug);
  if (!v.success) return naoEncontrada();
  const dados = await ctx.leitura.perfilPorSlug(v.data);
  if (!dados) return naoEncontrada();
  return redirecionar(await destinoDaImagem(ctx, dados.perfil.imagemPath));
}

export async function imagemPreviaItem(ctx: ContextoPublico, id: string): Promise<Response> {
  const v = idSchema.safeParse(id);
  if (!v.success) return naoEncontrada();
  const dados = await ctx.leitura.itemPorId(v.data);
  if (!dados) return naoEncontrada();
  return redirecionar(await destinoDaImagem(ctx, dados.item.fotoPath));
}
