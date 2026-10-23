import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancosSupabase } from "./bancos-supabase";
import { criarContexto, type Contexto } from "./contexto";

/**
 * Contexto da requisição: exige usuário logado (senão leva a /entrar e volta depois) e monta os serviços
 * dos módulos sobre a sessão do usuário (RLS). Nunca usa service_role.
 */
export async function obterContexto(voltarPara: string): Promise<Contexto> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return criarContexto(criarBancosSupabase(supabase, data.user.id));
}
