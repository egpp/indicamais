"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MENSAGENS_RELACIONAMENTO } from "@/modules/relacionamento";
import {
  obterContextoRelacionamento,
  type ContextoRelacionamento,
} from "./_lib/contexto-relacionamento";
import type { EstadoRelacionamento } from "./_lib/estado-relacionamento";
import {
  abrirAviso,
  curtirPerfil,
  descurtirPerfil,
  marcarAvisoLido,
  marcarTodosAvisosLidos,
  sairDaBasePerfil,
} from "./_lib/tratadores-relacionamento";

/**
 * Server Actions da Fase 5. Só ligam o formulário ao tratador: sessão do usuário, serviço do módulo e atualização
 * das telas. Sem regra de negócio e sem texto técnico para o usuário.
 */

type Rota = string | readonly [string, "page"];

const ehRedirecionamento = (e: unknown) =>
  e instanceof Error &&
  /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`);

async function executar(
  voltarPara: string,
  tratador: (ctx: ContextoRelacionamento, f: FormData) => Promise<EstadoRelacionamento>,
  f: FormData,
  revalidar: readonly Rota[],
): Promise<EstadoRelacionamento> {
  try {
    const estado = await tratador(await obterContextoRelacionamento(voltarPara), f);
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
    return { erro: MENSAGENS_RELACIONAMENTO.generica };
  }
}

const VITRINES: readonly Rota[] = [
  ["/perfil/[slug]", "page"],
  ["/item/[id]", "page"],
];
const PARTICIPACOES = "/minhas-participacoes";
const BASE = ["/meus-perfis/[id]/base", "page"] as const;

export async function acaoCurtirPerfil(_: EstadoRelacionamento, f: FormData) {
  return executar(PARTICIPACOES, curtirPerfil, f, [...VITRINES, PARTICIPACOES, BASE, "/avisos"]);
}
export async function acaoDescurtirPerfil(_: EstadoRelacionamento, f: FormData) {
  return executar(PARTICIPACOES, descurtirPerfil, f, [...VITRINES, PARTICIPACOES, BASE]);
}

/** Sai da base e volta à lista com o aviso de confirmação (a linha do perfil deixa de existir). */
export async function acaoSairDaBase(_: EstadoRelacionamento, f: FormData) {
  const estado = await executar(PARTICIPACOES, sairDaBasePerfil, f, [
    ...VITRINES,
    PARTICIPACOES,
    BASE,
    "/avisos",
    "/avisos/quem-me-indicou",
  ]);
  if (estado.sucesso) redirect(`${PARTICIPACOES}?aviso=saiu`);
  return estado;
}

export async function acaoMarcarAvisoLido(_: EstadoRelacionamento, f: FormData) {
  return executar("/avisos", marcarAvisoLido, f, ["/avisos"]);
}
export async function acaoMarcarTodosLidos(_: EstadoRelacionamento, f: FormData) {
  return executar("/avisos", (ctx) => marcarTodosAvisosLidos(ctx), f, ["/avisos"]);
}

/** Abre o item relacionado ao aviso: marca como lido e redireciona (funciona também sem JavaScript). */
export async function acaoAbrirAviso(f: FormData): Promise<void> {
  let destino = "/avisos";
  try {
    destino = await abrirAviso(await obterContextoRelacionamento("/avisos"), f);
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
  }
  revalidatePath("/avisos");
  redirect(destino);
}
