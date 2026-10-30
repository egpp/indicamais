/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import { AcoesDoDestino } from "../../_componentes/acoes-destino";
import { CurtirPerfil } from "../../_componentes/form-relacionamento";
import { CabecalhoPublico, localTexto } from "../../_componentes/publico";
import { nomeDaCategoria } from "../../_lib/apresentacao";
import { lerEstadoCurtida } from "../../_lib/contexto-relacionamento";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";
import { carregarItemPublico } from "../../_lib/paginas-publicas";
import { metadadosPublicos, resumir } from "../../_lib/metadados-publicos";

/**
 * Produto, serviço ou anúncio particular público (IM-014, IM-015, IM-079). Renderizado no servidor, com Open
 * Graph e Twitter para a prévia no WhatsApp. Só o que está aprovado, publicado e disponível; o resto é 404
 * genérico. Sem dados do dono (conta, WhatsApp, e-mail) no HTML. Ações da Fase 3 (IM-013): contato e indicar;
 * curtir o perfil de origem só para logado (IM-043). ?ind=<codigo> (IM-025) vai só ao formulário de contato deste item.
 */
export const dynamic = "force-dynamic";

const rotuloDoTipo = (anuncio: boolean, tipo: "produto" | "servico") =>
  anuncio ? "Anúncio particular" : tipo === "produto" ? "Produto" : "Serviço";

export async function generateMetadata({ params }: PageProps<"/item/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await carregarItemPublico(id);
  if (!d) return { title: "Página não encontrada | IndicaMais", ...SEM_INDEXACAO };
  const { item } = d;
  const nome = item.nome ?? "Item";
  const local = localTexto(item.cidade, item.uf);
  const partes = [item.precoTexto, local].filter(Boolean).join(" · ");
  return metadadosPublicos({
    titulo: `${nome} | IndicaMais`,
    descricao:
      resumir(item.descricao) ??
      resumir(partes ? `${nome}. ${partes}.` : `${nome} no IndicaMais.`) ??
      nome,
    caminho: ROTAS_PUBLICAS.item(item.id),
    caminhoImagem: item.fotoPath ? ROTAS_PUBLICAS.ogItem(item.id) : null,
    imagemAlt: `Foto de ${nome}`,
  });
}

export default async function PaginaItemPublico({ params, searchParams }: PageProps<"/item/[id]">) {
  const { id } = await params;
  const ind = um((await searchParams).ind);
  const d = await carregarItemPublico(id);
  if (!d) notFound();
  const { item, perfil, categorias, urls } = d;
  const nome = item.nome ?? "Item sem nome";
  const local = localTexto(item.cidade, item.uf);
  const foto = item.fotoPath ? urls[item.fotoPath] : undefined;
  const curtida = perfil ? await lerEstadoCurtida(perfil.id) : null;
  const nomesCategorias = [item.categoriaPrincipalId, ...item.categoriasSecundariasIds]
    .filter((c): c is string => Boolean(c))
    .map((c) => nomeDaCategoria(c, categorias));

  return (
    <main className="pagina pagina-publica">
      <CabecalhoPublico />
      <article className="visao-publica" aria-labelledby="titulo-item">
        {foto ? (
          <div className="imagem-principal">
            <img src={foto} alt={`Foto de ${nome}`} />
          </div>
        ) : null}
        <p className="card-tipo">{rotuloDoTipo(item.anuncioParticular, item.tipo)}</p>
        <h1 id="titulo-item">{nome}</h1>
        {item.precoTexto ? <p className="preco">{item.precoTexto}</p> : null}
        {nomesCategorias.length > 0 ? (
          <p className="categorias">
            <strong>{nomesCategorias[0]}</strong>
            {nomesCategorias.slice(1).map((c) => (
              <span key={c}> · {c}</span>
            ))}
          </p>
        ) : null}
        {local ? <p>{local}</p> : null}
        {item.descricao ? <p className="texto-corrido">{item.descricao}</p> : null}
        {perfil ? (
          <p>
            Oferecido por{" "}
            <Link href={ROTAS_PUBLICAS.perfil(perfil.slug)}>{perfil.nome ?? "ver perfil"}</Link>
          </p>
        ) : null}
      </article>

      <AcoesDoDestino
        tipo="item"
        id={item.id}
        rotuloIndicar={
          item.anuncioParticular ? "Indique este anúncio" : "Indique este produto/serviço"
        }
        retorno={ROTAS_PUBLICAS.item(item.id)}
        ind={ind}
      />
      {perfil && curtida ? (
        <CurtirPerfil
          perfilId={perfil.id}
          logado={curtida.logado}
          curtiu={curtida.curtiu}
          retorno={ROTAS_PUBLICAS.item(item.id)}
        />
      ) : null}
      <p className="rodape-links">
        <Link href="/">Voltar para a página inicial</Link>
      </p>
    </main>
  );
}
