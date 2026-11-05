import { notFound, redirect } from "next/navigation";
import {
  criarServicoComissoes,
  type ClienteBancoComissoes,
  type ServicoComissoes,
} from "@/modules/comissoes";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoComissoes } from "./banco-comissoes";
import { consultarAdmin } from "./bancos-supabase";

/**
 * Contexto do módulo comissoes nas telas (Fase 7, IM-061 a IM-073): serviço sobre a SESSÃO do usuário (o banco
 * confere administrador, responsável e módulo habilitado). Nunca usa a chave de serviço.
 */
export type ContextoComissoes = {
  servico: ServicoComissoes;
  logado: boolean;
  /** Administrador geral (conferido no banco; falha fechado). */
  ehAdministrador: () => Promise<boolean>;
};

export function criarContextoComissoes(d: {
  banco: ClienteBancoComissoes;
  logado: boolean;
  ehAdministrador?: () => Promise<boolean>;
  agora?: () => Date;
}): ContextoComissoes {
  return {
    servico: criarServicoComissoes(d.banco, d.agora ? { agora: d.agora } : {}),
    logado: d.logado,
    ehAdministrador: d.ehAdministrador ?? (async () => false),
  };
}

async function montar(): Promise<ContextoComissoes> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return criarContextoComissoes({
    banco: criarBancoComissoes(supabase),
    logado: Boolean(data.user),
    ehAdministrador: () => consultarAdmin(supabase),
  });
}

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoComissoes(voltarPara: string): Promise<ContextoComissoes> {
  const ctx = await montar();
  if (!ctx.logado) redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  return ctx;
}

/** O módulo está habilitado neste negócio para o responsável logado? Qualquer falha vira "não" (seção oculta). */
export async function moduloComissoesAtivo(perfilId: string): Promise<boolean> {
  try {
    const ctx = await montar();
    if (!ctx.logado) return false;
    const r = await ctx.servico.meusNegocios();
    return r.ok && r.valor.some((n) => n.negocioId === perfilId && n.moduloAtivo);
  } catch {
    return false;
  }
}

/** Quem não é administrador geral recebe o 404 padrão (a rota não se revela). */
export async function exigirAdministradorComissoes(ctx: ContextoComissoes): Promise<void> {
  let admin = false;
  try {
    admin = await ctx.ehAdministrador();
  } catch {
    admin = false;
  }
  if (!admin) notFound();
}
