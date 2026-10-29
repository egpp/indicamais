import { redirect } from "next/navigation";
import {
  criarServicoConsultaNegocios,
  type ServicoConsultaNegocios,
} from "@/modules/administracao";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoConsultaNegocios } from "./bancos-supabase";

/** Serviço da consulta de negócios (D-009) sobre a sessão do usuário; exige login. O papel é conferido de novo pela visão. */
export async function obterServicoConsultaNegocios(
  voltarPara: string,
): Promise<ServicoConsultaNegocios> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  return criarServicoConsultaNegocios(criarBancoConsultaNegocios(supabase));
}
