import { redirect } from "next/navigation";
import { criarServicoLocalizacao, type ServicoLocalizacao } from "@/modules/perfis";
import { geocodificarEndereco } from "@/shared/geocodificacao";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoLocalizacao } from "./banco-localizacao";

/**
 * Localização/mapa (D-016; IM-018, IM-092) nas telas: serviço do módulo perfis sobre a SESSÃO do usuário, com
 * a geocodificação do servidor (Nominatim). Nunca usa service_role.
 */
export async function obterServicoLocalizacao(voltarPara: string): Promise<ServicoLocalizacao> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return criarServicoLocalizacao(criarBancoLocalizacao(supabase), {
    geocodificar: geocodificarEndereco,
  });
}

/** Vitrine pública: sessão anônima, sem cookies. */
export function obterServicoLocalizacaoPublico(): ServicoLocalizacao {
  return criarServicoLocalizacao(criarBancoLocalizacao(criarClientePublico()), {
    geocodificar: geocodificarEndereco,
  });
}
