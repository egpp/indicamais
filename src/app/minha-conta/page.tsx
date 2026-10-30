import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarServicoContas } from "@/modules/contas";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { formatarE164BR } from "@/shared/formatacao/telefone";
import { sair } from "../acoes-conta";
import { FormNome, FormRedefinirSenha, FormWhatsapp } from "../_componentes/formularios";
import { FormDesistirEncerramento, FormEncerrarConta } from "../_componentes/form-ciclo-vida";
import Link from "next/link";
import { NavAdministracao } from "../_componentes/nav-administracao";
import { Aviso, CartaoPagina } from "../_componentes/ui";
import { criarBancoContas } from "../_lib/banco-contas";
import { formatarDataSP } from "../_lib/apresentacao";
import { obterContextoCicloVida } from "../_lib/contexto-ciclo-vida";

export const metadata: Metadata = { title: "Minha conta | IndicaMais", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaginaMinhaConta({ searchParams }: PageProps<"/minha-conta">) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar?aviso=sessao&proximo=%2Fminha-conta");

  const params = await searchParams;
  const senhaAlterada = params.aviso === "senha";
  const ciclo = await obterContextoCicloVida("/minha-conta");
  const [resultado, estado, permissoes, geral] = await Promise.all([
    criarServicoContas(criarBancoContas(supabase)).obterMinhaConta(),
    ciclo.conta.obterMeuEstado(),
    ciclo.permissoes(),
    ciclo.ehAdministradorGeral(),
  ]);
  const encerramentoAte =
    estado.ok && estado.valor?.situacao === "encerramento_solicitado"
      ? formatarDataSP(estado.valor.encerramentoExecutarApos)
      : null;
  const temAdministracao = geral || permissoes.length > 0;

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

      <section aria-labelledby="titulo-painel">
        <h2 id="titulo-painel">Meu conteúdo</h2>
        <ul className="nav-painel">
          <li>
            <Link href="/meus-perfis">Meus perfis</Link>
          </li>
          <li>
            <Link href="/meus-itens">Meus itens</Link>
          </li>
          <li>
            <Link href="/meus-anuncios">Meus anúncios</Link>
          </li>
          <li>
            <Link href="/minhas-revisoes">Revisões</Link>
          </li>
        </ul>
      </section>

      {temAdministracao ? (
        <section aria-labelledby="titulo-administracao">
          <h2 id="titulo-administracao">Administração</h2>
          <NavAdministracao permissoes={permissoes} geral={geral} />
        </section>
      ) : null}

      <section aria-labelledby="titulo-senha">
        <h2 id="titulo-senha">Alterar senha</h2>
        <FormRedefinirSenha />
      </section>

      <section aria-labelledby="titulo-encerrar">
        <h2 id="titulo-encerrar">Encerrar conta</h2>
        {encerramentoAte ? (
          <>
            <Aviso tipo="atencao">
              Encerramento solicitado. Sua conta será encerrada em definitivo após {encerramentoAte}
              . Até lá, você pode desistir.
            </Aviso>
            <FormDesistirEncerramento />
          </>
        ) : (
          <>
            <p>
              Ao encerrar, há uma carência de 30 dias para você desistir. Enquanto isso e depois:
            </p>
            <ul>
              <li>Seus perfis ficam despublicados, sem transferência para outra pessoa.</li>
              <li>
                Ao fim da carência, seus dados pessoais (nome, telefone e e-mail) são anonimizados.
              </li>
              <li>
                Históricos necessários, como pontos e auditoria, são preservados sem identificar
                você.
              </li>
            </ul>
            <FormEncerrarConta />
          </>
        )}
      </section>

      <form action={sair}>
        <button type="submit" className="botao botao-secundario">
          Sair
        </button>
      </form>
    </CartaoPagina>
  );
}
