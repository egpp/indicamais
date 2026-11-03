import { redirect } from "next/navigation";
import { criarServicoHomeAdmin, type ServicoHomeAdmin } from "@/modules/administracao";
import {
  escolherLocalizacaoHome,
  validarLocalizacaoHome,
  type LocalizacaoHome,
} from "@/modules/busca";
import { criarServicoPerfis } from "@/modules/perfis";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoHomeAdmin } from "./banco-home";
import { criarBancoPerfis } from "./bancos-supabase";

/**
 * Cidade e UF para "Na sua cidade" (D-018): 1) a busca, se válida; 2) com login, a cidade da versão no ar do primeiro
 * perfil comercial PUBLICADO da própria pessoa (lido com a sessão dela, RLS); 3) null (a seção some). Só cidade e UF
 * saem daqui. Visitante sem busca não toca no banco. Falha ao ler o perfil = null.
 */
export async function obterLocalizacaoDaHome(
  busca?: { cidade?: unknown; uf?: unknown } | null,
): Promise<LocalizacaoHome | null> {
  const daBusca = validarLocalizacaoHome(busca);
  if (daBusca) return daBusca;
  try {
    const supabase = await criarClienteServidor();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const r = await criarServicoPerfis(criarBancoPerfis(supabase)).listarMeus();
    return r.ok ? escolherLocalizacaoHome(null, r.valor) : null;
  } catch {
    return null;
  }
}

export type ContextoHomeAdmin = { home: ServicoHomeAdmin };

/** Painel das seções da home: exige login (senão leva a /entrar). O papel de administrador geral é conferido no serviço e no banco. */
export async function obterContextoHomeAdmin(voltarPara: string): Promise<ContextoHomeAdmin> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return { home: criarServicoHomeAdmin(criarBancoHomeAdmin(supabase)) };
}
