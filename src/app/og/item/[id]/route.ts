import { obterContextoPublico } from "../../../_lib/contexto-publico";
import { imagemPreviaItem } from "../../../_lib/imagem-previa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/og/item/[id]">) {
  const { id } = await params;
  return imagemPreviaItem(obterContextoPublico(), id);
}
