import { obterContextoPublico } from "../../../_lib/contexto-publico";
import { imagemPreviaPerfil } from "../../../_lib/imagem-previa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/og/perfil/[slug]">) {
  const { slug } = await params;
  return imagemPreviaPerfil(obterContextoPublico(), slug);
}
