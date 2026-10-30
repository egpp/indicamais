import { notFound, redirect } from "next/navigation";
import { criarServicoPontos, type ClienteBancoPontos, type ServicoPontos } from "@/modules/pontos";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoPontos } from "./banco-pontos";
import { consultarAdmin } from "./bancos-supabase";

/**
 * Contexto do módulo pontos nas telas (Fase 4): serviço sobre a SESSÃO do usuário (RLS e visões decidem o que cada
 * um vê) ou sobre a sessão anônima na vitrine pública. Nunca usa a chave de serviço.
 */
export type ContextoPontos = {
  servico: ServicoPontos;
  logado: boolean;
  /** Administrador (conferido no banco; falha fechado). */
  ehAdministrador: () => Promise<boolean>;
};

export function criarContextoPontos(d: {
  banco: ClienteBancoPontos;
  logado: boolean;
  ehAdministrador?: () => Promise<boolean>;
  agora?: () => Date;
}): ContextoPontos {
  return {
    servico: criarServicoPontos(d.banco, d.agora ? { agora: d.agora } : {}),
    logado: d.logado,
    ehAdministrador: d.ehAdministrador ?? (async () => false),
  };
}

async function montar(): Promise<ContextoPontos> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return criarContextoPontos({
    banco: criarBancoPontos(supabase),
    logado: Boolean(data.user),
    ehAdministrador: () => consultarAdmin(supabase),
  });
}

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoPontos(voltarPara: string): Promise<ContextoPontos> {
  const ctx = await montar();
  if (!ctx.logado) redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  return ctx;
}

/** Vitrine pública: sessão anônima, sem cookies. */
export function obterServicoPontosPublico(): ServicoPontos {
  return criarServicoPontos(criarBancoPontos(criarClientePublico()));
}

/** Quem não é administrador recebe o 404 padrão (a rota não se revela). */
export async function exigirAdministradorPontos(ctx: ContextoPontos): Promise<void> {
  let admin = false;
  try {
    admin = await ctx.ehAdministrador();
  } catch {
    admin = false;
  }
  if (!admin) notFound();
}
