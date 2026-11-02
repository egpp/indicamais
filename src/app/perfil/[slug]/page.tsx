import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BeneficioPublico } from "@/modules/pontos";
import { AcoesDoDestino } from "../../_componentes/acoes-destino";
import { CabecalhoPublico, localTexto } from "../../_componentes/publico";
import { Aviso } from "../../_componentes/ui";
import { SiteNegocio } from "../../_componentes/site/site-negocio";
import { TEMAS } from "../../_componentes/site/estilos";
import { FormDenunciar } from "../../_componentes/form-ciclo-vida";
import { CurtirPerfil } from "../../_componentes/form-relacionamento";
import { lerEstadoCurtida } from "../../_lib/contexto-relacionamento";
import { obterServicoPontosPublico } from "../../_lib/contexto-pontos";
import { estiloDaPaginaPublica } from "../../_lib/estilo-da-pagina";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";
import { carregarPerfilPublico } from "../../_lib/paginas-publicas";
import { DESCRICAO_PADRAO, metadadosPublicos, resumir } from "../../_lib/metadados-publicos";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";

/**
 * Perfil comercial público (IM-011, IM-012, IM-014, IM-079). Renderizado no servidor, com Open Graph e Twitter
 * para a prévia no WhatsApp. Só aparece o que está aprovado, publicado e disponível; o resto é 404 genérico.
 * Sem WhatsApp, responsável nem e-mail no HTML. Ações: contato e indicar (IM-013) e curtir só para quem está logado (IM-043).
 * ?ind=<codigo> (IM-025) vai só ao formulário de contato desta página.
 * A página é um site de uma página (D-016; IM-091 a IM-093). ?estilo=<id> é só prévia para o responsável/administrador.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/perfil/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = await carregarPerfilPublico(slug);
  if (!d) return { title: "Página não encontrada | IndicaMais", ...SEM_INDEXACAO };
  const p = d.perfil;
  const nome = p.nome ?? "Perfil";
  const local = localTexto(p.cidade, p.uf);
  return metadadosPublicos({
    titulo: `${nome} | IndicaMais`,
    descricao:
      resumir(p.descricaoBreve) ??
      resumir(local ? `${nome} em ${local}. Veja no IndicaMais.` : DESCRICAO_PADRAO) ??
      DESCRICAO_PADRAO,
    caminho: ROTAS_PUBLICAS.perfil(p.slug),
    caminhoImagem: p.imagemPath ? ROTAS_PUBLICAS.ogPerfil(p.slug) : null,
    imagemAlt: `Imagem de ${nome}`,
  });
}

export default async function PaginaPerfilPublico({
  params,
  searchParams,
}: PageProps<"/perfil/[slug]">) {
  const { slug } = await params;
  const consulta = await searchParams;
  const ind = um(consulta.ind);
  const d = await carregarPerfilPublico(slug);
  if (!d) notFound();
  const { perfil, itens, categorias, urls } = d;
  // IM-036: vitrine informativa; falha na leitura não derruba a página do perfil.
  let beneficios: BeneficioPublico[] = [];
  try {
    const lista = await obterServicoPontosPublico().listarBeneficiosPublicos();
    if (lista.ok) beneficios = lista.valor.filter((b) => b.perfilId === perfil.id);
  } catch {
    beneficios = [];
  }
  const curtida = await lerEstadoCurtida(perfil.id);
  const { estilo, previa } = await estiloDaPaginaPublica(perfil.id, um(consulta.estilo));
  const retorno = ROTAS_PUBLICAS.perfil(perfil.slug);

  return (
    <>
      <div className="pagina-publica cabecalho-site">
        <CabecalhoPublico />
        {previa ? (
          <Aviso tipo="info">
            Prévia do estilo {TEMAS[estilo].rotulo}: só você vê. Os visitantes continuam vendo o
            estilo padrão.
          </Aviso>
        ) : null}
      </div>
      <SiteNegocio
        estilo={estilo}
        perfil={perfil}
        itens={itens}
        categorias={categorias}
        urls={urls}
        beneficios={beneficios}
        contato={
          <>
            <AcoesDoDestino
              tipo="perfil"
              slug={perfil.slug}
              rotuloIndicar="Indique esta empresa"
              retorno={retorno}
              ind={ind}
            />
            {curtida.proprio ? null : (
              <CurtirPerfil
                perfilId={perfil.id}
                logado={curtida.logado}
                curtiu={curtida.curtiu}
                retorno={retorno}
              />
            )}
          </>
        }
        denunciar={<FormDenunciar alvoTipo="perfil" alvoId={perfil.id} />}
      />
    </>
  );
}
