import { notFound, redirect } from "next/navigation";
import {
  criarServicoCicloVida,
  type AplicadorBloqueioAcesso,
  type Permissao,
  type ServicoCicloVida,
} from "@/modules/administracao";
import { criarServicoCicloVidaConta, type ServicoCicloVidaConta } from "@/modules/contas";
import { bloquearAcessoNoAuth, liberarAcessoNoAuth } from "@/shared/supabase/acesso-conta";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoCicloVida, criarBancoCicloVidaConta } from "./banco-ciclo-vida";
import { denunciarViaServidor } from "./chamada-publica-servidor";
import { consultarAdmin } from "./bancos-supabase";

/**
 * Contexto da Fase 6 nas telas (D-014): administração (permissões, denúncias, suspensão, invalidação) e ciclo de
 * vida da própria conta. Serviços sobre a SESSÃO do usuário (ou anônima, na denúncia pública); nunca a chave de
 * serviço, exceto dentro de acesso-conta.ts (banimento no Auth, só servidor).
 */
export type FalhasBloqueio = { suspender: boolean; reativar: boolean };

export type ContextoCicloVida = {
  admin: ServicoCicloVida;
  conta: ServicoCicloVidaConta;
  logado: boolean;
  /** Falhas do banimento no Auth nesta requisição (o banco já mudou; a tela avisa e oferece repetir). */
  falhas: FalhasBloqueio;
  /** Administrador geral (conferido no banco; falha fechado). */
  ehAdministradorGeral: () => Promise<boolean>;
  /** Permissões da conta logada (falha fechado: lista vazia). */
  permissoes: () => Promise<Permissao[]>;
};

/** Aplica o banimento no Auth e só anota se falhou; nunca desfaz a suspensão nem expõe a causa (IM-086). */
export function criarAplicadorBloqueio(falhas: FalhasBloqueio): AplicadorBloqueioAcesso {
  return {
    async aoSuspender(contaId) {
      const r = await bloquearAcessoNoAuth(contaId);
      if (!r.ok) {
        falhas.suspender = true;
        console.warn("[ciclo-vida] falha ao bloquear no Auth; repetir por Sincronizar acesso");
      }
    },
    async aoReativar(contaId) {
      const r = await liberarAcessoNoAuth(contaId);
      if (!r.ok) {
        falhas.reativar = true;
        console.warn("[ciclo-vida] falha ao liberar no Auth; repetir por Sincronizar acesso");
      }
    },
  };
}

export function criarContextoCicloVida(d: {
  admin: ServicoCicloVida;
  conta: ServicoCicloVidaConta;
  logado: boolean;
  falhas?: FalhasBloqueio;
  ehAdministradorGeral?: () => Promise<boolean>;
}): ContextoCicloVida {
  return {
    admin: d.admin,
    conta: d.conta,
    logado: d.logado,
    falhas: d.falhas ?? { suspender: false, reativar: false },
    ehAdministradorGeral: d.ehAdministradorGeral ?? (async () => false),
    permissoes: async () => {
      try {
        const r = await d.admin.listarMinhasPermissoes();
        return r.ok ? r.valor : [];
      } catch {
        return [];
      }
    },
  };
}

async function montar(denunciaPublica = false): Promise<ContextoCicloVida> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const falhas: FalhasBloqueio = { suspender: false, reativar: false };
  const banco = criarBancoCicloVida(supabase);
  return criarContextoCicloVida({
    admin: criarServicoCicloVida(
      // D-034: a denúncia de quem NÃO está logado passa pelo servidor (chave de serviço só nessa chamada).
      denunciaPublica && !data.user ? { ...banco, denunciar: denunciarViaServidor } : banco,
      { aplicadorBloqueio: criarAplicadorBloqueio(falhas) },
    ),
    conta: criarServicoCicloVidaConta(criarBancoCicloVidaConta(supabase)),
    logado: Boolean(data.user),
    falhas,
    ehAdministradorGeral: () => consultarAdmin(supabase),
  });
}

/** Visitante ou logado. */
export const obterContextoCicloVidaAberto = () => montar();

/** Só para a denúncia (já protegida por Turnstile e origem): o visitante anônimo chama o banco pelo servidor. */
export const obterContextoDenunciaPublica = () => montar(true);

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoCicloVida(voltarPara: string): Promise<ContextoCicloVida> {
  const ctx = await montar();
  if (!ctx.logado) redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  return ctx;
}

/** Sem a permissão (ou sem conseguir conferir): 404 padrão, a rota não se revela. */
export async function exigirPermissao(ctx: ContextoCicloVida, p: Permissao): Promise<Permissao[]> {
  const minhas = await ctx.permissoes();
  if (!minhas.includes(p)) notFound();
  return minhas;
}

/** Só o administrador geral; os demais recebem o 404 padrão. */
export async function exigirAdministradorGeral(ctx: ContextoCicloVida): Promise<void> {
  let ok = false;
  try {
    ok = await ctx.ehAdministradorGeral();
  } catch {
    ok = false;
  }
  if (!ok) notFound();
}
