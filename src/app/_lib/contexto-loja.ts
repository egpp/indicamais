import { redirect } from "next/navigation";
import { criarServicoLojaAdmin, type ServicoLojaAdmin } from "@/modules/administracao";
import { criarServicoLoja, type ServicoLoja } from "@/modules/catalogo";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoLoja, criarBancoLojaAdmin } from "./banco-loja";

/** Loja nas páginas públicas: sessão ANÔNIMA, sem cookies, sem service_role. Só vê o que a Loja liberada publica. */
export function obterServicoLojaPublica(): ServicoLoja {
  return criarServicoLoja(criarBancoLoja(criarClientePublico()));
}

/**
 * Loja na área logada do dono (esconder/mostrar a Loja no perfil, IM-099): sessão do usuário. Perfil ainda não
 * publicado só é visível ao próprio dono (RLS), então a consulta precisa da sessão e não da leitura anônima.
 */
export async function obterServicoLojaDoDono(voltarPara: string): Promise<ServicoLoja> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return criarServicoLoja(criarBancoLoja(supabase));
}

export type ContextoLojaAdmin = { loja: ServicoLojaAdmin };

/** Painel da Loja (administrador geral): exige login; o papel é conferido no serviço e de novo no banco. */
export async function obterContextoLojaAdmin(voltarPara: string): Promise<ContextoLojaAdmin> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return { loja: criarServicoLojaAdmin(criarBancoLojaAdmin(supabase)) };
}
