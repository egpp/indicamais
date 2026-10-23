import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../db/database.types";

/**
 * Cliente Supabase para componentes de cliente. Usa só a chave pública.
 * As variáveis NEXT_PUBLIC_* precisam ser lidas de forma literal para o bundler as embutir.
 */
export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
