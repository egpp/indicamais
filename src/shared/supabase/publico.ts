import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { lerEnvSupabase } from "./env";

/**
 * Cliente Supabase das páginas PÚBLICAS: sempre anônimo (chave pública), sem cookies e sem guardar sessão.
 * Assim a página nunca depende de quem está logado nem carrega dado da sessão de outra pessoa; o que ela
 * enxerga é exatamente o que as visões públicas e a RLS liberam ao visitante (IM-029, IM-079, IM-086).
 */
export function criarClientePublico() {
  const { url, chavePublica } = lerEnvSupabase();
  return createClient<Database>(url, chavePublica, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
