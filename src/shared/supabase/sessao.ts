import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../db/database.types";
import { lerEnvSupabase } from "./env";

/**
 * Renova a sessão do Supabase a cada requisição (chamado pelo proxy.ts).
 * getClaims() valida o token e o renova perto de expirar. Não protege rotas:
 * cada página protegida confere o usuário no servidor.
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

  await supabase.auth.getClaims();
  return resposta;
}
