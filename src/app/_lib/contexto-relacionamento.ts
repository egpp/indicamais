import { redirect } from "next/navigation";
import {
  criarServicoNotificacoes,
  type ClienteBancoNotificacoesApp,
  type ServicoNotificacoes,
} from "@/modules/notificacoes";
import {
  criarServicoRelacionamento,
  type ClienteBancoRelacionamento,
  type ServicoRelacionamento,
} from "@/modules/relacionamento";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoAvisos } from "./banco-notificacoes-app";
import { criarBancoRelacionamento } from "./banco-relacionamento";
import { consultarAdmin, criarBancoLeituraPublica } from "./bancos-supabase";
import { criarLeituraPublica, type LeituraPublica } from "./leitura-publica";

/**
 * Contexto dos módulos relacionamento e notificacoes nas telas (Fase 5): serviços sobre a SESSÃO do usuário (as
 * visões e RPCs do banco filtram por auth.uid()). Nunca usa a chave de serviço.
 */
export type ContextoRelacionamento = {
  relacionamento: ServicoRelacionamento;
  notificacoes: ServicoNotificacoes;
  /** Leitura pública anônima, só para resolver o endereço público de um destino. */
  leitura: LeituraPublica;
  logado: boolean;
  /** Administrador (conferido no banco; falha fechado). */
  ehAdministrador: () => Promise<boolean>;
};

export function criarContextoRelacionamento(d: {
  bancoRelacionamento: ClienteBancoRelacionamento;
  bancoNotificacoes: ClienteBancoNotificacoesApp;
  leitura: LeituraPublica;
  logado: boolean;
  ehAdministrador?: () => Promise<boolean>;
}): ContextoRelacionamento {
  return {
    relacionamento: criarServicoRelacionamento(d.bancoRelacionamento),
    notificacoes: criarServicoNotificacoes(d.bancoNotificacoes),
    leitura: d.leitura,
    logado: d.logado,
    ehAdministrador: d.ehAdministrador ?? (async () => false),
  };
}

async function montar(): Promise<ContextoRelacionamento> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return criarContextoRelacionamento({
    bancoRelacionamento: criarBancoRelacionamento(supabase),
    bancoNotificacoes: criarBancoAvisos(supabase),
    leitura: criarLeituraPublica(criarBancoLeituraPublica(criarClientePublico())),
    logado: Boolean(data.user),
    ehAdministrador: () => consultarAdmin(supabase),
  });
}

/** Visitante ou logado (páginas públicas e rota do sino). */
export const obterContextoRelacionamentoAberto = montar;

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoRelacionamento(
  voltarPara: string,
): Promise<ContextoRelacionamento> {
  const ctx = await montar();
  if (!ctx.logado) redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  return ctx;
}

/**
 * Estado do botão Curtir numa página pública. Qualquer falha vira "visitante": a página nunca quebra.
 * `proprio`: o perfil é do próprio usuário logado (o botão Curtir não aparece; o banco também recusa, IM-043).
 * A conferência é uma leitura de uma linha na visão perfis_meus_perfis, só para quem está logado.
 */
export type EstadoCurtida = { logado: boolean; curtiu: boolean; proprio: boolean };

export async function lerEstadoCurtida(perfilId: string): Promise<EstadoCurtida> {
  try {
    const supabase = await criarClienteServidor();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { logado: false, curtiu: false, proprio: false };
    const meu = await supabase
      .from("perfis_meus_perfis")
      .select("id")
      .eq("id", perfilId)
      .maybeSingle();
    if (meu.data) return { logado: true, curtiu: false, proprio: true };
    const ctx = await montar();
    const r = await ctx.relacionamento.minhasParticipacoes();
    const curtiu = r.ok && r.valor.some((p) => p.perfilId === perfilId && p.curtiu);
    return { logado: true, curtiu, proprio: false };
  } catch {
    return { logado: false, curtiu: false, proprio: false };
  }
}
