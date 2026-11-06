import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { consultarAdmin } from "./bancos-supabase";

/**
 * Defesa em profundidade das Server Actions administrativas (RSA-06, IM-086, D-033). HELPER ÚNICO: toda ação que só
 * o administrador geral pode executar chama `exigirAdministrador` ANTES de montar o contexto do módulo ou de chamar
 * qualquer função de negócio do banco. O banco (RLS e RPCs) continua sendo a barreira final; isto garante que um
 * erro numa política ou RPC não deixe a ação utilizável por qualquer pessoa logada.
 *
 * - sem sessão: leva a /entrar (como as demais ações);
 * - logado sem o papel (ou erro ao conferir: falha fechado): 404, igual às páginas de /administracao.
 * A única chamada ao banco aqui é a leitura `administracao_eh_admin` (sessão do próprio usuário, sem service_role).
 */
export async function exigirAdministrador(voltarPara: string): Promise<void> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/entrar?aviso=sessao&proximo=${encodeURIComponent(voltarPara)}`);
  }
  if (!(await consultarAdmin(supabase))) notFound();
}
