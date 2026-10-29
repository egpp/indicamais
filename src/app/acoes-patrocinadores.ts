"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obterContextoPatrocinadores } from "./_lib/contexto-patrocinadores";
import type { ContextoPatrocinadores } from "./_lib/contexto-patrocinadores";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import type { Resposta } from "./_lib/resposta";
import {
  alterarPatrocinador,
  criarPatrocinador,
  definirPatrocinadorAtivo,
} from "./_lib/tratadores-patrocinadores";

/**
 * Server Actions de patrocinadores (administrador). Só ligam o formulário ao tratador: sessão do usuário (RLS),
 * serviço do módulo, redirecionamento e atualização da tela e da página inicial. Sem regra de negócio.
 */

type Tratador = (ctx: ContextoPatrocinadores, f: FormData) => Promise<Resposta>;

async function rodar(
  voltarPara: string,
  tratador: Tratador,
  f: FormData,
): Promise<EstadoFormulario> {
  const ctx = await obterContextoPatrocinadores(voltarPara);
  const { destino, ...estado } = await tratador(ctx, f);
  revalidatePath("/", "layout");
  if (destino) redirect(destino);
  return estado;
}

export async function acaoCriarPatrocinador(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/patrocinadores", criarPatrocinador, f);
}
export async function acaoAlterarPatrocinador(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/patrocinadores", alterarPatrocinador, f);
}
export async function acaoDefinirPatrocinadorAtivo(_: EstadoFormulario, f: FormData) {
  return rodar("/administracao/patrocinadores", definirPatrocinadorAtivo, f);
}
