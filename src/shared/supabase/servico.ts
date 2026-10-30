import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";

/** Origem das credenciais. No Worker agendado vem do `env` do handler; no app, de process.env. */
export type CredenciaisServico = { url?: string; chave?: string };

/**
 * ÚNICO arquivo do app que lê a chave de serviço (service_role). Uso restrito ao SERVIDOR e a tarefas de
 * sistema (avisar o responsável por e-mail, IM-027/IM-050; bloqueio de acesso por suspensão, IM-080; rotinas
 * agendadas, IM-081). Nunca importar de componente de cliente, nunca registrar a chave em log ou mensagem
 * (IM-086). A varredura em tests/varredura-select-service-role.test.ts garante que nenhum outro arquivo a
 * mencione.
 */
export function criarClienteServico(credenciais: CredenciaisServico = {}) {
  if (typeof window !== "undefined") {
    throw new Error("O cliente de serviço só pode ser criado no servidor.");
  }
  const url = credenciais.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = credenciais.chave ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    // Mensagem sem valores: só diz o que falta configurar.
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e a chave de serviço do servidor.");
  }
  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
