import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Revisão | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Fila de pendências. Quem não é administrador recebe o 404 padrão (a rota não se revela). */
export default async function PaginaFilaRevisao({
  searchParams,
}: PageProps<"/administracao/revisao">) {
  const ctx = await obterContexto("/administracao/revisao");
  if (!(await ctx.administracao.ehAdministrador())) notFound();
  const decidido = um((await searchParams).decidido);
  const fila = await ctx.administracao.listarFila();
  return (
    <PainelPagina
      titulo="Fila de revisão"
      subtitulo="Perfis, produtos e serviços aguardando aprovação, do mais antigo ao mais novo."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/categorias">
          Categorias e pedidos
        </Link>{" "}
        <Link className="botao botao-secundario" href="/administracao/patrocinadores">
          Patrocinadores
        </Link>{" "}
        <Link className="botao botao-secundario" href="/administracao/negocios">
          Perfis e itens
        </Link>
      </p>
      {decidido === "aprovada" ? <Aviso tipo="sucesso">Aprovado.</Aviso> : null}
      {decidido === "rejeitada" ? <Aviso tipo="sucesso">Rejeitado.</Aviso> : null}
      {!fila.ok ? (
        <Aviso tipo="erro">{fila.erro.mensagem}</Aviso>
      ) : fila.valor.length === 0 ? (
        <Aviso tipo="info">Nada aguardando revisão.</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {fila.valor.map((i) => (
            <li key={i.versaoId} className="cartao">
              <h2>
                <Link href={`/administracao/revisao/${i.alvo}/${i.versaoId}`}>
                  {i.nome ?? (i.alvo === "perfil" ? "Perfil sem nome" : "Item sem nome")}
                </Link>
              </h2>
              <p>
                <SeloEstado rotulo={i.alvo === "perfil" ? "Perfil" : "Produto ou serviço"} />{" "}
                {i.ehEdicao ? <SeloEstado rotulo="Edição de conteúdo aprovado" /> : null}{" "}
                {i.proprio ? <SeloEstado rotulo="Seu conteúdo" /> : null}
              </p>
              <p className="ajuda">Enviado em {formatarDataHora(i.enviadaEm)}</p>
            </li>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
