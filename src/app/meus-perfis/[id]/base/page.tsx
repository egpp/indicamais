import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PainelPagina, SeloEstado } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { formatarDataCivil } from "../../../_lib/apresentacao";
import { obterContextoRelacionamento } from "../../../_lib/contexto-relacionamento";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = {
  title: "Base de relacionamento | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const LIMITE_LISTA = 100;

/**
 * IM-039 a IM-042, IM-045: Base de Relacionamento de UM perfil do responsável. Mostra resumo e membros só por
 * nome reduzido, datas e contagens; NUNCA WhatsApp, e-mail ou nome completo. Perfil alheio ou inexistente: 404.
 * A base não pontua nem gera comissão.
 */
export default async function PaginaBaseDoPerfil({ params }: PageProps<"/meus-perfis/[id]/base">) {
  const { id } = await params;
  const caminho = `/meus-perfis/${id}/base`;
  const sessao = await obterContexto(caminho);
  const perfil = await sessao.perfis.obter(id);
  if (!perfil.ok) {
    if (perfil.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Base de relacionamento" atual="perfis">
        <Aviso tipo="erro">{perfil.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const ctx = await obterContextoRelacionamento(caminho);
  const [resumos, membros] = await Promise.all([
    ctx.relacionamento.resumo(),
    ctx.relacionamento.listarMembros(),
  ]);
  const resumo = resumos.ok ? resumos.valor.find((r) => r.perfilId === id) : undefined;
  const lista = membros.ok ? membros.valor.filter((m) => m.perfilId === id) : [];
  const nome = perfil.valor.conteudoEdicao.nome ?? "Perfil sem nome";
  const totais = [
    ["Pessoas na base", resumo?.membros ?? 0],
    ["Curtidas", resumo?.curtidasAtivas ?? 0],
    ["Indicadores", resumo?.indicadores ?? 0],
    ["Contatos por indicação", resumo?.interacoes ?? 0],
    ["Saídas", resumo?.saidas ?? 0],
  ] as const;

  return (
    <PainelPagina titulo="Base de relacionamento" subtitulo={nome} atual="perfis">
      <p>
        <Link href={`/meus-perfis/${id}`}>Voltar ao perfil</Link>
      </p>
      <Aviso tipo="info">
        Por privacidade, aparece só o nome reduzido de cada pessoa. Não mostramos WhatsApp, e-mail
        nem nome completo. A base não gera pontos nem comissão.
      </Aviso>
      {!resumos.ok ? <Aviso tipo="erro">{resumos.erro.mensagem}</Aviso> : null}
      <section aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">Resumo</h2>
        <dl className="resumo-base">
          {totais.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="ajuda">
          Quem sai da base deixa de aparecer nesta lista e passa a contar só em Saídas, sem nome.
        </p>
      </section>
      <section aria-labelledby="titulo-membros">
        <h2 id="titulo-membros">Pessoas na base</h2>
        {!membros.ok ? (
          <Aviso tipo="erro">{membros.erro.mensagem}</Aviso>
        ) : lista.length === 0 ? (
          <p className="ajuda">Ainda não há pessoas na base deste perfil.</p>
        ) : (
          <>
            <ul className="lista-cartoes">
              {lista.slice(0, LIMITE_LISTA).map((m) => (
                <li key={m.id} className="cartao">
                  <h3>{m.pessoaNome}</h3>
                  <p>
                    {m.curtiu ? <SeloEstado rotulo="Curtiu" /> : null}{" "}
                    {m.indicou ? <SeloEstado rotulo="Indicou" /> : null}
                  </p>
                  <p className="ajuda">
                    Na base desde {formatarDataCivil(m.entrouEm)}.
                    {m.curtiu && m.curtidaEm ? ` Curtiu em ${formatarDataCivil(m.curtidaEm)}.` : ""}
                    {m.primeiraIndicacaoEm
                      ? ` Primeira indicação em ${formatarDataCivil(m.primeiraIndicacaoEm)}.`
                      : ""}
                    {m.ultimaIndicacaoEm && m.ultimaIndicacaoEm !== m.primeiraIndicacaoEm
                      ? ` Última em ${formatarDataCivil(m.ultimaIndicacaoEm)}.`
                      : ""}
                  </p>
                  <p>
                    Contatos por indicação: <strong>{m.interacoes}</strong>
                  </p>
                </li>
              ))}
            </ul>
            {lista.length > LIMITE_LISTA ? (
              <p className="ajuda">
                Mostrando as {LIMITE_LISTA} pessoas mais recentes de {lista.length}.
              </p>
            ) : null}
          </>
        )}
      </section>
    </PainelPagina>
  );
}
