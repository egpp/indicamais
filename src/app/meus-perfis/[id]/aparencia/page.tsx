import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hrefPerfilPublico } from "../../../_componentes/link-pagina-publica";
import { PainelPagina } from "../../../_componentes/painel";
import { ESTILO_PADRAO, LISTA_TEMAS, TEMAS } from "../../../_componentes/site/estilos";
import { MiniaturaEstilo } from "../../../_componentes/site/miniatura-estilo";
import { Aviso } from "../../../_componentes/ui";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Aparência | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * Aparência da página do negócio (D-016; IM-091). Mostra os 20 estilos; 5 liberados para ver em prévia, 15 "em
 * breve". NESTA ETAPA NADA É GRAVADO: a escolha do estilo depende de coluna nova no banco (próxima etapa). Perfil de
 * outra pessoa responde 404 (a leitura do módulo perfis já filtra pelo dono).
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

  return (
    <PainelPagina
      titulo="Aparência da página"
      subtitulo={`Estilos para a página de ${nome}.`}
      atual="aparencia"
    >
      <Aviso tipo="info">
        Por enquanto você pode ver como a página fica em cada estilo. Salvar a escolha ainda não
        está disponível; os visitantes continuam vendo o estilo {TEMAS[ESTILO_PADRAO].rotulo}. Os
        estilos marcados como &quot;Em breve&quot; chegam depois.
      </Aviso>
      <ul className="grade-estilos" aria-label="Estilos de página">
        {LISTA_TEMAS.map((t) => (
          <li key={t.id} className="cartao cartao-estilo">
            <MiniaturaEstilo tema={t} />
            <h2>{t.rotulo}</h2>
            <p className="ajuda">{t.descricao}</p>
            {t.liberado ? (
              <p className="acoes-linha">
                <Link
                  className="botao botao-secundario"
                  href={`/meus-perfis/${id}/previa?estilo=${t.id}`}
                >
                  Ver prévia<span className="sr-only"> do estilo {t.rotulo}</span>
                </Link>
                {p.estado.noAr ? (
                  <Link
                    className="botao-texto"
                    href={`${hrefPerfilPublico(p.slug)}?estilo=${t.id}`}
                  >
                    Ver na página publicada<span className="sr-only"> no estilo {t.rotulo}</span>
                  </Link>
                ) : null}
              </p>
            ) : (
              <p>
                <button type="button" className="botao botao-secundario" disabled>
                  Em breve<span className="sr-only">: estilo {t.rotulo}</span>
                </button>
              </p>
            )}
          </li>
        ))}
      </ul>
      <p>
        <button type="button" className="botao" disabled>
          Salvar estilo: disponível em breve
        </button>
      </p>
      <p>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para o perfil
        </Link>
      </p>
    </PainelPagina>
  );
}
