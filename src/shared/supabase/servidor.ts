import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../db/database.types";
import { lerEnvSupabase } from "./env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Cria um cliente por requisição, com a sessão do usuário nos cookies.
 */
export async function criarClienteServidor() {
  const { url, chavePublica } = lerEnvSupabase();
  const armazenamento = await cookies();
  return createServerClient<Database>(url, chavePublica, {
    cookies: {
      getAll: () => armazenamento.getAll(),
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) armazenamento.set(name, value, options);
        } catch {
          // Chamado de um Server Component (cookies somente leitura): o proxy renova a sessão.
        }
      },
    },
  });
}
