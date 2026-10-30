"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { MENSAGENS_CICLO } from "@/modules/administracao";
import {
  obterContextoCicloVida,
  obterContextoCicloVidaAberto,
  type ContextoCicloVida,
} from "./_lib/contexto-ciclo-vida";
import type { EstadoCicloVida } from "./_lib/estado-ciclo-vida";
import { origemDaDenuncia } from "./_lib/origem-denuncia";
import {
  cancelarEncerramento,
  concederPermissao,
  decidirDenuncia,
  enviarDenuncia,
  invalidarIndicacao,
  reativarConta,
  revogarPermissao,
  sincronizarAcesso,
  solicitarEncerramento,
  suspenderConta,
} from "./_lib/tratadores-ciclo-vida";

/**
 * Server Actions da Fase 6. Só ligam o formulário ao tratador: sessão do usuário, serviço do módulo e atualização
 * das telas. Sem regra de negócio e sem texto técnico para o usuário. A denúncia é a única que aceita visitante
 * anônimo; a origem (hash de IP + user-agent) é calculada aqui, no servidor, nunca vem do navegador.
 */
const ehRedirecionamento = (e: unknown) =>
  e instanceof Error &&
  /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`);

async function executar(
  voltarPara: string,
  tratador: (ctx: ContextoCicloVida, f: FormData) => Promise<EstadoCicloVida>,
  f: FormData,
  revalidar: readonly string[],
): Promise<EstadoCicloVida> {
  try {
    const estado = await tratador(await obterContextoCicloVida(voltarPara), f);
    if (estado.sucesso || estado.erro) for (const r of revalidar) revalidatePath(r);
    return estado;
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
    return { erro: MENSAGENS_CICLO.generica };
  }
}

const DENUNCIAS = "/administracao/denuncias";
const PERMISSOES = "/administracao/permissoes";
const CONTAS = "/administracao/contas";
const INDICACOES = "/administracao/indicacoes";
const MINHA_CONTA = "/minha-conta";

export async function acaoDenunciar(_: EstadoCicloVida, f: FormData): Promise<EstadoCicloVida> {
  try {
    const origem = await origemDaDenuncia(await headers());
    return await enviarDenuncia(await obterContextoCicloVidaAberto(), f, origem);
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
    return { erro: MENSAGENS_CICLO.denunciaIndisponivel };
  }
}

export async function acaoDecidirDenuncia(_: EstadoCicloVida, f: FormData) {
  return executar(DENUNCIAS, decidirDenuncia, f, [DENUNCIAS]);
}
export async function acaoConcederPermissao(_: EstadoCicloVida, f: FormData) {
  return executar(PERMISSOES, concederPermissao, f, [PERMISSOES]);
}
export async function acaoRevogarPermissao(_: EstadoCicloVida, f: FormData) {
  return executar(PERMISSOES, revogarPermissao, f, [PERMISSOES]);
}
export async function acaoSuspenderConta(_: EstadoCicloVida, f: FormData) {
  return executar(CONTAS, suspenderConta, f, [CONTAS]);
}
export async function acaoReativarConta(_: EstadoCicloVida, f: FormData) {
  return executar(CONTAS, reativarConta, f, [CONTAS]);
}
export async function acaoSincronizarAcesso(_: EstadoCicloVida, f: FormData) {
  return executar(CONTAS, sincronizarAcesso, f, [CONTAS]);
}
export async function acaoInvalidarIndicacao(_: EstadoCicloVida, f: FormData) {
  return executar(INDICACOES, invalidarIndicacao, f, [
    INDICACOES,
    "/pontos",
    "/administracao/pontos",
  ]);
}
export async function acaoSolicitarEncerramento(_: EstadoCicloVida, f: FormData) {
  return executar(MINHA_CONTA, solicitarEncerramento, f, [MINHA_CONTA]);
}
export async function acaoCancelarEncerramento(_: EstadoCicloVida, f: FormData) {
  return executar(MINHA_CONTA, (ctx) => cancelarEncerramento(ctx), f, [MINHA_CONTA]);
}
