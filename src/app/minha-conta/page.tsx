import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarServicoContas } from "@/modules/contas";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { formatarE164BR } from "@/shared/formatacao/telefone";
import { sair } from "../acoes-conta";
import { FormNome, FormWhatsapp } from "../_componentes/formularios";
import { Aviso, CartaoPagina } from "../_componentes/ui";
import { criarBancoContas } from "../_lib/banco-contas";

export const metadata: Metadata = { title: "Minha conta | IndicaMais", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaginaMinhaConta({ searchParams }: PageProps<"/minha-conta">) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar?aviso=sessao&proximo=%2Fminha-conta");

  const params = await searchParams;
  const senhaAlterada = params.aviso === "senha";
  const resultado = await criarServicoContas(criarBancoContas(supabase)).obterMinhaConta();

  return (
    <CartaoPagina titulo="Minha conta">
      {senhaAlterada ? <Aviso tipo="sucesso">Senha alterada com sucesso.</Aviso> : null}
      <p className="dado">
        <span className="dado-rotulo">E-mail</span>
        <span>{data.user.email}</span>
      </p>

      {resultado.ok ? (
        <>
          <section aria-labelledby="titulo-nome">
            <h2 id="titulo-nome">Nome</h2>
            <FormNome nomeAtual={resultado.valor.nomeExibicao ?? ""} />
          </section>

          <section aria-labelledby="titulo-whatsapp">
            <h2 id="titulo-whatsapp">WhatsApp</h2>
            {resultado.valor.podeIndicar ? null : (
              <Aviso tipo="info">
                Para indicar, você precisa informar seu WhatsApp. Pode ser feito agora ou depois.
              </Aviso>
            )}
            {resultado.valor.whatsappE164 ? (
              <p className="dado-situacao">
                Número atual: {formatarE164BR(resultado.valor.whatsappE164)}. Ainda não verificado.
              </p>
            ) : null}
            <FormWhatsapp
              whatsappAtual={
                resultado.valor.whatsappE164 ? formatarE164BR(resultado.valor.whatsappE164) : ""
              }
            />
            <p className="ajuda">
              Cada número só pode ser usado em uma conta. A verificação do número ainda não está
              disponível.
            </p>
          </section>
        </>
      ) : (
        <Aviso tipo="erro">{resultado.erro.mensagem}</Aviso>
      )}

      <form action={sair}>
        <button type="submit" className="botao botao-secundario">
          Sair
        </button>
      </form>
    </CartaoPagina>
  );
}
