import { NextResponse } from "next/server";
import { obterContextoRelacionamentoAberto } from "../../_lib/contexto-relacionamento";

/**
 * Contador do sino (IM-047, IM-052). Só devolve se há login e quantos avisos NÃO lidos a própria conta tem; nada
 * de conteúdo. Resposta nunca em cache nem indexada. Qualquer falha responde como visitante (o sino some).
 */
export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } as const;

export async function GET() {
  try {
    const ctx = await obterContextoRelacionamentoAberto();
    if (!ctx.logado)
      return NextResponse.json({ logado: false, naoLidas: 0 }, { headers: CABECALHOS });
    const r = await ctx.notificacoes.contarNaoLidas();
    return NextResponse.json(
      { logado: true, naoLidas: r.ok ? r.valor : 0 },
      { headers: CABECALHOS },
    );
  } catch {
    return NextResponse.json({ logado: false, naoLidas: 0 }, { headers: CABECALHOS });
  }
}
