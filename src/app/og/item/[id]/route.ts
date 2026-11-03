import { obterServicoLojaPublica } from "../../../_lib/contexto-loja";
import { obterContextoPublico } from "../../../_lib/contexto-publico";
import { imagemPreviaItem } from "../../../_lib/imagem-previa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/og/item/[id]">) {
  const { id } = await params;
  return imagemPreviaItem(obterContextoPublico(), id, async (itemId) => {
    // Imóvel da Loja (IM-098): só se estiver no ar e a Loja do perfil liberada.
    const r = await obterServicoLojaPublica().buscarItem(itemId);
    return r.ok && r.valor ? { fotoPath: r.valor.fotoPath } : null;
  });
}
