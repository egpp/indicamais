"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "./_lib/exigir-administrador";
import { obterContextoLojaAdmin } from "./_lib/contexto-loja";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import { definirLiberacaoLoja } from "./_lib/tratadores-loja";

/**
 * Server Action da liberação da Loja por perfil (administrador geral, IM-097, IM-099, D-020). O formulário traz
 * perfilId, liberada (true/false) e motivo. Ao salvar, revalida o painel, as páginas públicas de perfil e de item
 * e as áreas do dono que mostram ou escondem a Loja.
 */
export async function acaoDefinirLiberacaoLoja(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  // RSA-06: papel de administrador conferido no servidor antes de qualquer chamada de negócio ao banco.
  await exigirAdministrador("/administracao/loja");
  const ctx = await obterContextoLojaAdmin("/administracao/loja");
  const { destino, ...estado } = await definirLiberacaoLoja(ctx, f);
  void destino;
  if (estado.sucesso) {
    revalidatePath("/administracao/loja");
    revalidatePath("/perfil/[slug]", "page");
    revalidatePath("/item/[id]", "page");
    revalidatePath("/meus-perfis");
    revalidatePath("/meus-itens");
  }
  return estado;
}
