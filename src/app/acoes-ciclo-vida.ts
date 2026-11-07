"use server";

import { revalidatePath } from "next/cache";
import { MENSAGENS_CICLO } from "@/modules/administracao";
import {
  obterContextoCicloVida,
  obterContextoDenunciaPublica,
  type ContextoCicloVida,
} from "./_lib/contexto-ciclo-vida";
import { exigirAdministrador } from "./_lib/exigir-administrador";
import type { EstadoCicloVida } from "./_lib/estado-ciclo-vida";
import { protegerFormularioPublico } from "./_lib/protecao-publica";
import { valoresDe } from "./_lib/resposta";
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
 * anônimo; a origem (HMAC de IP + user-agent com segredo do servidor) é calculada aqui, no servidor, nunca vem do navegador.
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

/** RSA-06: conceder e revogar permissões é do administrador geral; conferido no servidor antes do banco. */
async function executarAdmin(...args: Parameters<typeof executar>): Promise<EstadoCicloVida> {
  await exigirAdministrador(args[0]);
  return executar(...args);
}

const DENUNCIAS = "/administracao/denuncias";
const PERMISSOES = "/administracao/permissoes";
const CONTAS = "/administracao/contas";
const INDICACOES = "/administracao/indicacoes";
const MINHA_CONTA = "/minha-conta";

export async function acaoDenunciar(_: EstadoCicloVida, f: FormData): Promise<EstadoCicloVida> {
  try {
    // RSA-05/RSA-07: Turnstile e origem (HMAC com segredo do servidor) antes de qualquer chamada ao banco.
    const protecao = await protegerFormularioPublico(
      f,
      "denuncia",
      MENSAGENS_CICLO.denunciaIndisponivel,
    );
    if (!protecao.ok) return { erro: protecao.erro, valores: valoresDe(f, ["tipo", "texto"]) };
    return await enviarDenuncia(await obterContextoDenunciaPublica(), f, protecao.origem);
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
    return { erro: MENSAGENS_CICLO.denunciaIndisponivel };
  }
}

export async function acaoDecidirDenuncia(_: EstadoCicloVida, f: FormData) {
  return executar(DENUNCIAS, decidirDenuncia, f, [DENUNCIAS]);
}
export async function acaoConcederPermissao(_: EstadoCicloVida, f: FormData) {
  return executarAdmin(PERMISSOES, concederPermissao, f, [PERMISSOES]);
}
export async function acaoRevogarPermissao(_: EstadoCicloVida, f: FormData) {
  return executarAdmin(PERMISSOES, revogarPermissao, f, [PERMISSOES]);
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
