import { notFound, redirect } from "next/navigation";
import { criarServicoAparencia, type ServicoAparencia } from "@/modules/perfis";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoAparencia } from "./banco-aparencia";
import { consultarAdmin } from "./bancos-supabase";

/**
 * Contexto da aparência da página (D-016; IM-091, IM-093) nas telas: serviço do módulo perfis sobre a SESSÃO do
 * usuário (RLS e funções do banco decidem tudo) ou sobre a sessão anônima na vitrine. Nunca usa service_role.
 */
export type ContextoAparencia = {
  servico: ServicoAparencia;
  /** Administrador geral (conferido no banco; falha fechado). */
  ehAdministradorGeral: () => Promise<boolean>;
};

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoAparencia(voltarPara: string): Promise<ContextoAparencia> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return {
    servico: criarServicoAparencia(criarBancoAparencia(supabase)),
    ehAdministradorGeral: () => consultarAdmin(supabase),
  };
}

/** Vitrine pública: sessão anônima, sem cookies. */
export function obterServicoAparenciaPublico(): ServicoAparencia {
  return criarServicoAparencia(criarBancoAparencia(criarClientePublico()));
}

/** Só o administrador geral; os demais recebem o 404 padrão (a rota não se revela). */
export async function exigirGeral(ctx: ContextoAparencia): Promise<void> {
  let ok = false;
  try {
    ok = await ctx.ehAdministradorGeral();
  } catch {
    ok = false;
  }
  if (!ok) notFound();
}
