import { redirect } from "next/navigation";
import {
  criarServicoPatrocinadores,
  type ClienteBancoPatrocinadores,
  type ServicoPatrocinadores,
} from "@/modules/administracao";
import { criarServicoBusca, type ClienteBancoBusca, type ServicoBusca } from "@/modules/busca";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoBusca, criarBancoPatrocinadores } from "./bancos-supabase";
import { criarAssinadorImagens } from "./imagens-servidor";

export type DependenciasPatrocinadores = {
  bancoPatrocinadores: ClienteBancoPatrocinadores;
  bancoBusca: ClienteBancoBusca;
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

export type ContextoPatrocinadores = {
  patrocinadores: ServicoPatrocinadores;
  /** Para escolher o perfil de destino entre os perfis publicados. */
  busca: ServicoBusca;
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

export function criarContextoPatrocinadores(d: DependenciasPatrocinadores): ContextoPatrocinadores {
  return {
    patrocinadores: criarServicoPatrocinadores(d.bancoPatrocinadores),
    busca: criarServicoBusca(d.bancoBusca),
    assinarImagens: async (c) => {
      try {
        return await d.assinarImagens(c);
      } catch {
        return {};
      }
    },
  };
}

/**
 * Contexto da administração de patrocinadores: exige usuário logado (senão leva a /entrar) e usa a sessão dele.
 * O papel de administrador é conferido pelo serviço e de novo pelo banco em cada função.
 */
export async function obterContextoPatrocinadores(
  voltarPara: string,
): Promise<ContextoPatrocinadores> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return criarContextoPatrocinadores({
    bancoPatrocinadores: criarBancoPatrocinadores(supabase),
    bancoBusca: criarBancoBusca(supabase),
    assinarImagens: criarAssinadorImagens(supabase),
  });
}
