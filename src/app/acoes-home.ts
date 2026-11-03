"use server";

import { revalidatePath } from "next/cache";
import { revalidarSecoesDaHome } from "./_lib/cache-home";
import { obterContextoHomeAdmin } from "./_lib/contexto-home";
import type { EstadoFormulario } from "./_lib/estado-formulario";
import { alterarSecaoHome } from "./_lib/tratadores-home";

/** Server Action da edição das seções da home (administrador geral, IM-096). Revalida o cache da home ao salvar. */
export async function acaoAlterarSecaoHome(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const ctx = await obterContextoHomeAdmin("/administracao/home");
  const { destino, ...estado } = await alterarSecaoHome(ctx, f);
  void destino;
  if (estado.sucesso) {
    revalidarSecoesDaHome();
    revalidatePath("/");
    revalidatePath("/administracao/home");
  }
  return estado;
}
