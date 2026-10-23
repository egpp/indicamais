import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { caminhoSeguro } from "../../_lib/destino";

const TIPOS: ReadonlySet<string> = new Set([
  "signup",
  "recovery",
  "email",
  "email_change",
  "magiclink",
  "invite",
]);

/**
 * Retorno de confirmação de e-mail, recuperação de senha e login com Google.
 * Aceita `code` (PKCE/OAuth) ou `token_hash` + `type` (link do e-mail, funciona em outro aparelho).
 * Nunca repassa texto vindo da URL para a tela.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");
  const destinoPedido = searchParams.get("proximo");

  const falha = (aviso: string) => NextResponse.redirect(`${origin}/entrar?aviso=${aviso}`);

  // Erro vindo do provedor (usuário cancelou, provedor desligado etc.).
  if (searchParams.get("error") || searchParams.get("error_code")) return falha("oauth");

  const supabase = await criarClienteServidor();
  let recuperacao = tipo === "recovery";

  if (tokenHash && tipo && TIPOS.has(tipo)) {
    const { error } = await supabase.auth.verifyOtp({
      type: tipo as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return falha("link_invalido");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return falha("link_invalido");
    // Recuperação por PKCE chega com o destino pedido na ida.
    recuperacao = recuperacao || destinoPedido === "/redefinir-senha";
  } else {
    return falha("link_invalido");
  }

  const destino = recuperacao ? "/redefinir-senha" : caminhoSeguro(destinoPedido);
  return NextResponse.redirect(`${origin}${destino}`);
}
