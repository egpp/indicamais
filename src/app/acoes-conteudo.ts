"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obterServicoLocalizacao } from "./_lib/contexto-localizacao";
import { obterContexto } from "./_lib/contexto-sessao";
import { impressaoEndereco, localizarSeguro } from "./_lib/tratadores-localizacao";
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
/**
 * IM-018: depois de salvar/enviar, localiza a versão no mapa (OpenStreetMap). Falha nunca quebra o salvar.
 * Ao editar, só quando endereço, cidade ou UF mudaram (`antes` = impressão anterior; null = sempre).
 */
async function localizarDepois(perfilId: string, antes: string | null) {
  try {
    const voltarPara = `/meus-perfis/${perfilId}`;
    const ctx = await obterContexto(voltarPara);
    if (antes !== null && (await impressaoEndereco(ctx, perfilId)) === antes) return;
    await localizarSeguro(ctx, await obterServicoLocalizacao(voltarPara), perfilId);
    revalidatePath("/", "layout");
  } catch {
    /* o mapa só não aparece */
  }
}
export async function acaoEditarPerfil(_: EstadoFormulario, f: FormData) {
  const id = String(f.get("id") ?? "");
  const antes = id ? await impressaoEndereco(await obterContexto(`/meus-perfis/${id}`), id) : "";
  const r = await rodar("/meus-perfis", editarPerfil, f);
  if (id && r.sucesso) await localizarDepois(id, antes);
  return r;
}
export async function acaoSalvarImagensPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", salvarImagensPerfil, f);
}
export async function acaoAlterarEnderecoPerfil(_: EstadoFormulario, f: FormData) {
  return rodar("/meus-perfis", alterarEnderecoPerfil, f);
}
export async function acaoEnviarPerfil(_: EstadoFormulario, f: FormData) {
  const id = String(f.get("id") ?? "");
  const r = await rodar("/meus-perfis", enviarPerfil, f);
  if (id && r.sucesso) await localizarDepois(id, null);
  return r;
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
