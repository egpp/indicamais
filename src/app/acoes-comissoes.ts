"use server";

import { revalidatePath } from "next/cache";
import { MENSAGENS_COMISSOES } from "@/modules/comissoes";
import { obterContextoComissoes } from "./_lib/contexto-comissoes";
import type { ChaveComissoes } from "./_lib/definicoes-comissoes";
import type { EstadoComissoes } from "./_lib/estado-comissoes";
import { tratarComissoes } from "./_lib/tratadores-comissoes";

/**
 * Server Actions da Fase 7 (IM-061 a IM-073). Só ligam o formulário ao tratador: sessão do usuário, serviço do módulo
 * e atualização das telas. Sem regra de negócio e sem texto técnico para o usuário. Administrador, responsável do
 * negócio e módulo habilitado são conferidos pelo banco (IM-086). Nada aqui cobra ou repassa dinheiro (IM-090).
 */

const ehRedirecionamento = (e: unknown) =>
  e instanceof Error &&
  /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`);

const ADMIN = "/administracao/comissoes";
const MINHAS = "/comissoes";
const NEGOCIO = ["/meus-perfis/[id]/comissoes", "page"] as const;

async function executar(
  voltarPara: string,
  chave: ChaveComissoes,
  f: FormData,
  revalidar: readonly (string | readonly [string, "page"])[],
): Promise<EstadoComissoes> {
  try {
    const estado = await tratarComissoes(await obterContextoComissoes(voltarPara), chave, f);
    if (estado.sucesso) {
      for (const r of revalidar) {
        if (typeof r === "string") revalidatePath(r);
        else revalidatePath(r[0], r[1]);
      }
    }
    return estado;
  } catch (e) {
    // Redirecionamentos do Next (sessão expirada) precisam seguir adiante.
    if (ehRedirecionamento(e)) throw e;
    return { erro: MENSAGENS_COMISSOES.generica };
  }
}

const doAdmin = (chave: ChaveComissoes, f: FormData) =>
  executar(ADMIN, chave, f, [ADMIN, MINHAS, NEGOCIO]);
const doNegocio = (chave: ChaveComissoes, f: FormData) =>
  executar(MINHAS, chave, f, [ADMIN, MINHAS, NEGOCIO]);

// Administrador geral
export async function acaoDefinirPrazoInadimplencia(_: EstadoComissoes, f: FormData) {
  return doAdmin("parametro", f);
}
export async function acaoDefinirAntecedenciaAviso(_: EstadoComissoes, f: FormData) {
  return doAdmin("antecedenciaAviso", f);
}
export async function acaoDefinirHabilitacao(_: EstadoComissoes, f: FormData) {
  return doAdmin("habilitacao", f);
}
export async function acaoRegistrarVinculo(_: EstadoComissoes, f: FormData) {
  return doAdmin("vinculo", f);
}
export async function acaoRegistrarAssinatura(_: EstadoComissoes, f: FormData) {
  return doAdmin("assinatura", f);
}
export async function acaoCancelarAssinatura(_: EstadoComissoes, f: FormData) {
  return doAdmin("cancelarAssinatura", f);
}
export async function acaoConfirmarPagamento(_: EstadoComissoes, f: FormData) {
  return doAdmin("pagamento", f);
}
export async function acaoEstornarPagamento(_: EstadoComissoes, f: FormData) {
  return doAdmin("estorno", f);
}
export async function acaoReverterComissao(_: EstadoComissoes, f: FormData) {
  return doAdmin("reversao", f);
}
export async function acaoAvancarRepasse(_: EstadoComissoes, f: FormData) {
  return doAdmin("repasse", f);
}
export async function acaoEncerrarVinculo(_: EstadoComissoes, f: FormData) {
  return doAdmin("encerrarVinculo", f);
}

// Anunciante (responsável pelo negócio)
export async function acaoCriarOferta(_: EstadoComissoes, f: FormData) {
  return doNegocio("oferta", f);
}
export async function acaoAlterarPercentual(_: EstadoComissoes, f: FormData) {
  return doNegocio("percentual", f);
}
export async function acaoDefinirOfertaAtiva(_: EstadoComissoes, f: FormData) {
  return doNegocio("ofertaAtiva", f);
}
