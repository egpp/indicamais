"use server";

import { revalidatePath } from "next/cache";
import { MENSAGENS_PERFIS } from "@/modules/perfis";
import { exigirAdministrador } from "./_lib/exigir-administrador";
import { obterContextoAparencia } from "./_lib/contexto-aparencia";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import type { Resposta } from "./_lib/resposta";
import type { ServicoAparencia } from "@/modules/perfis";
import {
  adicionarBannerAdmin,
  definirBannerAtivo,
  habilitarEstilo,
  removerBannerAdmin,
  responderBanner,
  salvarBanners,
  salvarEstilo,
} from "./_lib/tratadores-aparencia";

/**
 * Server Actions da aparência da página (D-016; IM-091, IM-093). Só ligam o formulário ao tratador: sessão do
 * usuário (RLS e funções do banco decidem quem pode), serviço do módulo e atualização das telas.
 */
type Tratador = (servico: ServicoAparencia, f: FormData) => Promise<Resposta>;

const ehRedirecionamento = (e: unknown) =>
  e instanceof Error &&
  /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`);

async function rodar(
  voltarPara: string,
  tratador: Tratador,
  f: FormData,
  revalidar: readonly string[],
): Promise<EstadoFormulario> {
  try {
    const ctx = await obterContextoAparencia(voltarPara);
    const estado = await tratador(ctx.servico, f);
    if (estado.sucesso) for (const r of revalidar) revalidatePath(r, "layout");
    return estado;
  } catch (e) {
    if (ehRedirecionamento(e)) throw e;
    return { erro: MENSAGENS_PERFIS.generica };
  }
}

/** RSA-06: papel de administrador conferido no servidor antes de qualquer chamada de negócio ao banco. */
async function rodarAdmin(...args: Parameters<typeof rodar>): Promise<EstadoFormulario> {
  await exigirAdministrador(args[0]);
  return rodar(...args);
}

export async function acaoSalvarEstilo(_: EstadoFormulario, f: FormData) {
  return rodar("/aparencia", salvarEstilo, f, ["/"]);
}
export async function acaoHabilitarEstilo(_: EstadoFormulario, f: FormData) {
  return rodarAdmin("/administracao/estilos", habilitarEstilo, f, ["/"]);
}
export async function acaoSalvarBanners(_: EstadoFormulario, f: FormData) {
  return rodar("/aparencia", salvarBanners, f, ["/"]);
}
export async function acaoResponderBanner(_: EstadoFormulario, f: FormData) {
  return rodar("/aparencia", responderBanner, f, ["/"]);
}
export async function acaoBannerAtivo(_: EstadoFormulario, f: FormData) {
  return rodar("/aparencia", definirBannerAtivo, f, ["/"]);
}
export async function acaoAdicionarBannerAdmin(_: EstadoFormulario, f: FormData) {
  return rodarAdmin("/administracao/negocios", adicionarBannerAdmin, f, ["/"]);
}
export async function acaoRemoverBannerAdmin(_: EstadoFormulario, f: FormData) {
  return rodarAdmin("/administracao/negocios", removerBannerAdmin, f, ["/"]);
}
