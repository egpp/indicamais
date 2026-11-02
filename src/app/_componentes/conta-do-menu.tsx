import { criarClienteServidor } from "@/shared/supabase/servidor";
import { IdentificacaoConta } from "./identificacao-conta";

/**
 * Componente de servidor: lê e-mail (sessão do Supabase Auth) e nome (só a própria linha de contas_conta, por RLS,
 * coluna nomeada) na renderização. Qualquer falha ou ausência de sessão não mostra nada e não derruba a página.
 */
async function lerConta(): Promise<{ nome: string | null; email: string } | null> {
  try {
    const supabase = await criarClienteServidor();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!data.user || !email) return null;
    const { data: linha } = await supabase
      .from("contas_conta")
      .select("nome_exibicao")
      .eq("id", data.user.id)
      .maybeSingle<{ nome_exibicao: string | null }>();
    return { nome: linha?.nome_exibicao ?? null, email };
  } catch {
    return null;
  }
}

export async function ContaDoMenu() {
  const conta = await lerConta();
  return conta ? <IdentificacaoConta nome={conta.nome} email={conta.email} /> : null;
}
