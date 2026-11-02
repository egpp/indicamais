import { NextResponse } from "next/server";
import { obterContextoCicloVidaAberto } from "../../_lib/contexto-ciclo-vida";

/**
 * Acesso do menu do painel (D-015). Só diz se há login, se a conta é administradora geral e quais permissões ela
 * tem, para o menu não oferecer o que a pessoa não pode usar. Nada de dados de outras pessoas. Nunca em cache nem
 * indexada. Qualquer falha responde como "sem acesso" (falha fechado); as rotas conferem a permissão de novo.
 */
export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } as const;

export async function GET() {
  try {
    const ctx = await obterContextoCicloVidaAberto();
    if (!ctx.logado)
      return NextResponse.json(
        { logado: false, geral: false, permissoes: [] },
        { headers: CABECALHOS },
      );
    const [geral, permissoes] = await Promise.all([
      ctx.ehAdministradorGeral().catch(() => false),
      ctx.permissoes(),
    ]);
    return NextResponse.json({ logado: true, geral, permissoes }, { headers: CABECALHOS });
  } catch {
    return NextResponse.json(
      { logado: false, geral: false, permissoes: [] },
      { headers: CABECALHOS },
    );
  }
}
