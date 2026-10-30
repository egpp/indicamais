"use server";

import { revalidatePath } from "next/cache";
import { MENSAGENS_PONTOS } from "@/modules/pontos";
import { obterContextoPontos, type ContextoPontos } from "./_lib/contexto-pontos";
import type { EstadoPontos } from "./_lib/estado-pontos";
import {
  cadastrarBeneficioAdmin,
  criarBeneficioResponsavel,
  decidirBeneficioAdmin,
  definirParametroPontos,
  editarPropostaAdmin,
  enviarVersaoResponsavel,
  ligarDesligarBeneficio,
  reprocessarPedidoAdmin,
  responderPropostaResponsavel,
  reverterCreditoAdmin,
  salvarBeneficioResponsavel,
} from "./_lib/tratadores-pontos";

/**
 * Server Actions da Fase 4. Só ligam o formulário ao tratador: sessão do usuário, serviço do módulo e atualização
 * das telas. Sem regra de negócio e sem texto técnico para o usuário.
 */

type Rota = string | readonly [string, "page"];

async function executar(
  voltarPara: string,
  tratador: (ctx: ContextoPontos, f: FormData) => Promise<EstadoPontos>,
  f: FormData,
  revalidar: readonly Rota[],
): Promise<EstadoPontos> {
  try {
    const estado = await tratador(await obterContextoPontos(voltarPara), f);
    if (estado.sucesso) {
      for (const r of revalidar) {
        if (typeof r === "string") revalidatePath(r);
        else revalidatePath(r[0], r[1]);
      }
    }
    return estado;
  } catch (e) {
    // Redirecionamentos do Next (sessão expirada) precisam seguir adiante.
    if (
      e instanceof Error &&
      /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`)
    ) {
      throw e;
    }
    return { erro: MENSAGENS_PONTOS.generica };
  }
}

const ADM_PONTOS = "/administracao/pontos";
const ADM_BENEF = "/administracao/beneficios";
const PERFIL_BENEF = ["/meus-perfis/[id]/beneficios", "page"] as const;
const VITRINES: readonly Rota[] = ["/beneficios", ["/perfil/[slug]", "page"]];

// Administração
export async function acaoDefinirParametroPontos(_: EstadoPontos, f: FormData) {
  return executar("/administracao/parametros", definirParametroPontos, f, [
    "/administracao/parametros",
  ]);
}
export async function acaoReverterCredito(_: EstadoPontos, f: FormData) {
  return executar(ADM_PONTOS, reverterCreditoAdmin, f, [ADM_PONTOS, "/pontos"]);
}
export async function acaoReprocessarPedido(_: EstadoPontos, f: FormData) {
  return executar(ADM_PONTOS, reprocessarPedidoAdmin, f, [ADM_PONTOS, "/pontos"]);
}
export async function acaoDecidirBeneficio(_: EstadoPontos, f: FormData) {
  return executar(ADM_BENEF, decidirBeneficioAdmin, f, [ADM_BENEF, PERFIL_BENEF]);
}
export async function acaoCadastrarBeneficioAdmin(_: EstadoPontos, f: FormData) {
  return executar(ADM_BENEF, cadastrarBeneficioAdmin, f, [ADM_BENEF, PERFIL_BENEF]);
}
export async function acaoEditarPropostaAdmin(_: EstadoPontos, f: FormData) {
  return executar(ADM_BENEF, editarPropostaAdmin, f, [ADM_BENEF, PERFIL_BENEF]);
}

// Responsável
export async function acaoCriarBeneficio(_: EstadoPontos, f: FormData) {
  return executar("/meus-perfis", criarBeneficioResponsavel, f, [PERFIL_BENEF, ADM_BENEF]);
}
export async function acaoSalvarBeneficio(_: EstadoPontos, f: FormData) {
  return executar("/meus-perfis", salvarBeneficioResponsavel, f, [PERFIL_BENEF, ADM_BENEF]);
}
export async function acaoEnviarVersao(_: EstadoPontos, f: FormData) {
  return executar("/meus-perfis", enviarVersaoResponsavel, f, [PERFIL_BENEF, ADM_BENEF]);
}
export async function acaoLigarDesligarBeneficio(_: EstadoPontos, f: FormData) {
  return executar("/meus-perfis", ligarDesligarBeneficio, f, [PERFIL_BENEF, ...VITRINES]);
}
export async function acaoResponderProposta(_: EstadoPontos, f: FormData) {
  return executar("/meus-perfis", responderPropostaResponsavel, f, [
    PERFIL_BENEF,
    ADM_BENEF,
    ...VITRINES,
  ]);
}
