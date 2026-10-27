import type { Metadata } from "next";
import Link from "next/link";
import { ListaItens } from "../_componentes/lista-itens";
import { PainelPagina } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Meus itens | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Produtos e serviços dos perfis do responsável (IM-014). Anúncios particulares ficam em /meus-anuncios. */
export default async function PaginaMeusItens() {
  const ctx = await obterContexto("/meus-itens");
  const [admin, itens, perfis] = await Promise.all([
    ctx.administracao.ehAdministrador(),
    ctx.itens.listarMeus(),
    ctx.perfis.listarMeus(),
  ]);
  const nomes: Record<string, string> = {};
  if (perfis.ok)
    for (const p of perfis.valor) nomes[p.id] = p.conteudoEdicao.nome ?? "Perfil sem nome";
  const doPerfil = itens.ok ? itens.valor.filter((i) => !i.anuncioParticular) : [];
  return (
    <PainelPagina
      titulo="Meus itens"
      subtitulo="Produtos e serviços dos seus perfis."
      admin={admin}
      atual="itens"
    >
      <p>
        <Link className="botao" href="/meus-itens/novo">
          Criar produto ou serviço
        </Link>
      </p>
      {!itens.ok ? (
        <Aviso tipo="erro">{itens.erro.mensagem}</Aviso>
      ) : doPerfil.length === 0 ? (
        <Aviso tipo="info">Você ainda não tem produtos ou serviços cadastrados.</Aviso>
      ) : (
        <ListaItens itens={doPerfil} nomesDePerfil={nomes} />
      )}
    </PainelPagina>
  );
}
