"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obterContexto } from "./_lib/contexto-sessao";
import type { Contexto } from "./_lib/contexto";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import type { Resposta } from "./_lib/resposta";
import {
  alterarCategoria,
  criarCategoria,
  decidirRevisao,
  decidirSolicitacao,
  solicitarCategoria,
} from "./_lib/tratadores-administracao";
import {
  criarItem,
  despublicarItem,
  editarItem,
  enviarItem,
  publicarItem,
  salvarFotoItem,
} from "./_lib/tratadores-itens";
import {
  alterarEnderecoPerfil,
  criarPerfil,
  despublicarPerfil,
  editarPerfil,
  enviarPerfil,
  publicarPerfil,
  salvarImagensPerfil,
} from "./_lib/tratadores-perfis";

/**
 * Server Actions de perfis, itens, revisão e categorias. Só ligam o formulário ao tratador: sessão do usuário
 * (RLS), serviço do módulo, redirecionamento e atualização da tela. Sem regra de negócio.
 */

type Tratador = (ctx: Contexto, f: FormData) => Promise<Resposta>;

async function rodar(
  voltarPara: string,
  tratador: Tratador,
  f: FormData,
): Promise<EstadoFormulario> {
  const ctx = await obterContexto(voltarPara);
  const { destino, ...estado } = await tratador(ctx, f);
  revalidatePath("/", "layout");
  if (destino) redirect(destino);
  return estado;
}

// Responsável: perfis ----------------------------------------------------------------------------------
export async function acaoCriarPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis/novo", criarPerfil, f);
}
export async function acaoEditarPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", editarPerfil, f);
}
export async function acaoSalvarImagensPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", salvarImagensPerfil, f);
}
export async function acaoAlterarEnderecoPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", alterarEnderecoPerfil, f);
}
export async function acaoEnviarPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", enviarPerfil, f);
}
export async function acaoPublicarPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", publicarPerfil, f);
}
export async function acaoDespublicarPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", despublicarPerfil, f);
}

// Responsável: itens e anúncios particulares -----------------------------------------------------------
export async function acaoCriarItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens/novo", criarItem, f);
}
export async function acaoEditarItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens", editarItem, f);
}
export async function acaoSalvarFotoItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens", salvarFotoItem, f);
}
export async function acaoEnviarItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens", enviarItem, f);
}
export async function acaoPublicarItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens", publicarItem, f);
}
export async function acaoDespublicarItem(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-itens", despublicarItem, f);
}

// Categorias (pedido do responsável) -------------------------------------------------------------------
export async function acaoSolicitarCategoria(_: EstadoFormulario, f: FormData) {
  return rodar("/solicitar-categoria", solicitarCategoria, f);
}

// Administrador ----------------------------------------------------------------------------------------
export async function acaoDecidirRevisao(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/revisao", decidirRevisao, f);
}
export async function acaoCriarCategoria(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/categorias", criarCategoria, f);
}
export async function acaoAlterarCategoria(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/categorias", alterarCategoria, f);
}
export async function acaoDecidirSolicitacao(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/categorias", decidirSolicitacao, f);
}
