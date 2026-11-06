import { notFound, redirect } from "next/navigation";
import { criarServicoCicloVidaConta } from "@/modules/contas";
import { criarServicoIndicacoes, type ServicoIndicacoes } from "@/modules/indicacoes";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoCicloVidaConta } from "./banco-ciclo-vida";
import { criarBancoIndicacoes } from "./banco-indicacoes";
import { enviarContatoViaServidor } from "./chamada-publica-servidor";
import { criarBancoLeituraPublica, consultarAdmin } from "./bancos-supabase";
import { criarLeituraPublica, type LeituraPublica } from "./leitura-publica";
import { origemPublica } from "./site";

/**
 * Contexto do módulo indicacoes nas telas: serviço sobre a SESSÃO do usuário (ou a anônima, no contato do
 * visitante) e leitura pública anônima para resolver o destino (nome, slug) no servidor, sem confiar no que
 * o navegador mandou. Nunca usa a chave de serviço.
 */
export type ContextoIndicacoes = {
  servico: ServicoIndicacoes;
  leitura: LeituraPublica;
  /** Há usuário logado nesta requisição. */
  logado: boolean;
  /** Administrador (conferido no banco; falha fechado). */
  ehAdministrador: () => Promise<boolean>;
  /** Estado da própria conta (IM-080), só para refinar a mensagem de quem tenta gerar link. null = não sei. */
  estadoDaConta: () => Promise<{ acessoPermitido: boolean } | null>;
};

export function criarContextoIndicacoes(d: {
  banco: Parameters<typeof criarServicoIndicacoes>[0];
  leitura: LeituraPublica;
  logado: boolean;
  urlBase?: string | null;
  ehAdministrador?: () => Promise<boolean>;
  estadoDaConta?: () => Promise<{ acessoPermitido: boolean } | null>;
}): ContextoIndicacoes {
  return {
    servico: criarServicoIndicacoes(d.banco, { urlBase: d.urlBase ?? origemPublica() }),
    leitura: d.leitura,
    logado: d.logado,
    ehAdministrador: d.ehAdministrador ?? (async () => false),
    estadoDaConta: d.estadoDaConta ?? (async () => null),
  };
}

async function montar(contatoPublico = false): Promise<ContextoIndicacoes> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const banco = criarBancoIndicacoes(supabase);
  return criarContextoIndicacoes({
    // D-034: o contato de quem NÃO está logado passa pelo servidor (chave de serviço só nessa chamada).
    banco:
      contatoPublico && !data.user ? { ...banco, enviarContato: enviarContatoViaServidor } : banco,
    leitura: criarLeituraPublica(criarBancoLeituraPublica(criarClientePublico())),
    logado: Boolean(data.user),
    ehAdministrador: () => consultarAdmin(supabase),
    estadoDaConta: async () => {
      const r = await criarServicoCicloVidaConta(
        criarBancoCicloVidaConta(supabase),
      ).obterMeuEstado();
      return r.ok ? r.valor : null;
    },
  });
}

/** Visitante anônimo ou logado (contato público e "Indique"). */
export const obterContextoIndicacoesAberto = () => montar();

/** Só para o envio do contato (já protegido por Turnstile e origem): o visitante anônimo chama o banco pelo servidor. */
export const obterContextoContatoPublico = () => montar(true);

/** Exige login (senão leva a /entrar e volta depois). */
export async function obterContextoIndicacoes(voltarPara: string): Promise<ContextoIndicacoes> {
  const ctx = await montar();
  if (!ctx.logado) redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  return ctx;
}

/** Papel de administrador (conferido no banco, falha fechado); quem não é recebe o 404 padrão (a rota não se revela). */
export async function exigirAdministrador(ctx: ContextoIndicacoes): Promise<void> {
  let admin = false;
  try {
    admin = await ctx.ehAdministrador();
  } catch {
    admin = false;
  }
  if (!admin) notFound();
}
