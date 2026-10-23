/**
 * Variáveis públicas do Supabase. Só URL e chave pública (anon/publishable).
 * A chave service_role NUNCA é usada em código do app (IM-086).
 */
export function lerEnvSupabase(): { url: string; chavePublica: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chavePublica) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).",
    );
  }
  return { url, chavePublica };
}
