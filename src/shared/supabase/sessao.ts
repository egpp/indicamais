import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../db/database.types";
import { lerEnvSupabase } from "./env";
import { acessoPermitido } from "./estado-conta";

/** Página neutra para conta sem acesso (suspensa ou encerrada). Não revela o motivo (IM-080, IM-081). */
export const ROTA_CONTA_INDISPONIVEL = "/conta-indisponivel";

/** Rotas em que não se consulta a situação: a própria página neutra e o fluxo de autenticação (sair). */
function dispensaChecagem(caminho: string): boolean {
  return caminho === ROTA_CONTA_INDISPONIVEL || caminho.startsWith("/auth/");
}

/**
 * Renova a sessão do Supabase a cada requisição (chamado pelo proxy.ts).
 * getClaims() valida o token e o renova perto de expirar. Depois, para quem tem sessão, confere se a conta
 * ainda tem acesso (contas_meu_estado(), com cache curto): se não tem, encerra a sessão e redireciona para
 * /conta-indisponivel. Não protege rotas: cada página protegida confere o usuário no servidor.
 */
export async function renovarSessao(request: NextRequest): Promise<NextResponse> {
  let resposta = NextResponse.next({ request });
  const { url, chavePublica } = lerEnvSupabase();

  const supabase = createServerClient<Database>(url, chavePublica, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, cabecalhos) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
        for (const [chave, valor] of Object.entries(cabecalhos ?? {})) {
          resposta.headers.set(chave, valor);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const contaId = data?.claims?.sub;
  if (!contaId || dispensaChecagem(request.nextUrl.pathname)) return resposta;

  if (await acessoPermitido(supabase, contaId)) return resposta;

  // Sem acesso: tenta encerrar a sessão no Auth (pode falhar se a conta já estiver bloqueada) e, de qualquer
  // forma, apaga os cookies de sessão do navegador.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // sem importância: os cookies são apagados abaixo
  }
  const destino = NextResponse.redirect(new URL(ROTA_CONTA_INDISPONIVEL, request.url));
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-")) destino.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  destino.headers.set("Cache-Control", "no-store");
  return destino;
}
