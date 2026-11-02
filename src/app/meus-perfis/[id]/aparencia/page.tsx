import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormEstilo } from "../../../_componentes/form-aparencia";
import { PainelPagina } from "../../../_componentes/painel";
import { ESTILO_PADRAO, TEMAS, resolverEstilo } from "../../../_componentes/site/estilos";
import { MiniaturaEstilo } from "../../../_componentes/site/miniatura-estilo";
import { Aviso } from "../../../_componentes/ui";
import { obterContextoAparencia } from "../../../_lib/contexto-aparencia";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { estilosSelecionaveis } from "../../../_lib/estilo-da-pagina";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Aparência | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * Aparência da página do negócio (D-016; IM-091, IM-094). Mostra o estilo atual e os estilos habilitados; salvar
 * não passa por revisão. Perfil de outra pessoa responde 404 (a leitura do módulo perfis já filtra pelo dono).
 */
export default async function PaginaAparenciaDoPerfil({
  params,
}: PageProps<"/meus-perfis/[id]/aparencia">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-perfis/${id}/aparencia`);
  const r = await ctx.perfis.obter(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Aparência da página" atual="aparencia">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const p = r.valor;
  const nome = p.conteudoEdicao.nome ?? "Perfil sem nome";
  const { servico } = await obterContextoAparencia(`/meus-perfis/${id}/aparencia`);
  const [lista, atualR] = await Promise.all([
    servico.listarEstilos(),
    servico.estiloDoMeuPerfil(id),
  ]);
  if (!lista.ok || !atualR.ok) {
    return (
      <PainelPagina titulo="Aparência da página" atual="aparencia">
        <Aviso tipo="erro">
          {!lista.ok ? lista.erro.mensagem : !atualR.ok ? atualR.erro.mensagem : ""}
        </Aviso>
      </PainelPagina>
    );
  }
  const selecionaveis = estilosSelecionaveis(lista.valor);
  const salvo = atualR.valor.estilo;
  const salvoDisponivel = selecionaveis.some((t) => t.id === salvo);
  // Se o estilo salvo não está mais disponível, a página pública usa o padrão; a tela mostra o que o público vê.
  const atual = salvoDisponivel ? resolverEstilo(salvo) : ESTILO_PADRAO;

  return (
    <PainelPagina
      titulo="Aparência da página"
      subtitulo={`Escolha o estilo da página de ${nome}.`}
      atual="aparencia"
    >
      <p>
        Estilo atual: <strong>{TEMAS[atual].rotulo}</strong>
      </p>
      {salvoDisponivel ? null : (
        <Aviso tipo="info">
          O estilo que você tinha escolhido não está disponível agora. A página aparece em{" "}
          {TEMAS[ESTILO_PADRAO].rotulo} até você escolher outro.
        </Aviso>
      )}
      <p className="ajuda">
        As miniaturas usam um negócio de exemplo. Trocar o estilo muda só o visual da página, não o
        seu conteúdo, e vale na hora.
      </p>
      <FormEstilo
        perfilId={id}
        atual={atual}
        opcoes={selecionaveis.map((t) => ({
          id: t.id,
          rotulo: t.rotulo,
          descricao: t.descricao,
          miniatura: <MiniaturaEstilo tema={t} />,
          hrefPrevia: `/meus-perfis/${id}/previa?estilo=${t.id}`,
        }))}
      />
      <p className="ajuda">Mais estilos chegam em breve.</p>
      <p className="acoes-linha">
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}/banners`}>
          Banners da página
        </Link>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para o perfil
        </Link>
      </p>
    </PainelPagina>
  );
}
