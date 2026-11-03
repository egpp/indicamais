"use server";

import { revalidatePath } from "next/cache";
import { obterServicoLocalizacao } from "./_lib/contexto-localizacao";
import { obterContexto } from "./_lib/contexto-sessao";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import {
  definirMostrarMapaTela,
  informarCoordenadasMapa,
  localizarNoMapa,
  removerCoordenadasMapa,
} from "./_lib/tratadores-localizacao";

/** Server Actions do mapa (D-016; IM-018, IM-092). Só ligam formulário, sessão do usuário (RLS) e módulo perfis. */
async function preparar(f: FormData) {
  const id = String(f.get("id") ?? "");
  const voltarPara = `/meus-perfis/${id}`;
  return { ctx: await obterContexto(voltarPara), loc: await obterServicoLocalizacao(voltarPara) };
}

export async function acaoLocalizarNoMapa(_: EstadoFormulario, f: FormData) {
  const { ctx, loc } = await preparar(f);
  const r = await localizarNoMapa(ctx, loc, f);
  revalidatePath("/", "layout");
  return r;
}
export async function acaoInformarCoordenadas(_: EstadoFormulario, f: FormData) {
  const { ctx, loc } = await preparar(f);
  const r = await informarCoordenadasMapa(ctx, loc, f);
  revalidatePath("/", "layout");
  return r;
}
export async function acaoRemoverCoordenadas(_: EstadoFormulario, f: FormData) {
  const { ctx, loc } = await preparar(f);
  const r = await removerCoordenadasMapa(ctx, loc, f);
  revalidatePath("/", "layout");
  return r;
}
export async function acaoDefinirMostrarMapa(_: EstadoFormulario, f: FormData) {
  const { loc } = await preparar(f);
  const r = await definirMostrarMapaTela(loc, f);
  revalidatePath("/", "layout");
  return r;
}
