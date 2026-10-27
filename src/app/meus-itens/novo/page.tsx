import type { Metadata } from "next";
import Link from "next/link";
import { FormNovoItem } from "../../_componentes/form-item";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO, categoriasParaTela, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Novo produto ou serviço | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

export default async function PaginaNovoItem({ searchParams }: PageProps<"/meus-itens/novo">) {
  const ctx = await obterContexto("/meus-itens/novo");
  const perfilInicial = um((await searchParams).perfil);
  const [{ categorias, erro }, perfis] = await Promise.all([
    categoriasParaTela(ctx),
    ctx.perfis.listarMeus(),
  ]);
  const lista = perfis.ok
    ? perfis.valor.map((p) => ({ id: p.id, nome: p.conteudoEdicao.nome ?? "Perfil sem nome" }))
    : [];
  return (
    <PainelPagina
      titulo="Novo produto ou serviço"
      subtitulo="Vinculado a um dos seus perfis. Passa por aprovação antes de aparecer."
      atual="itens"
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {!perfis.ok ? <Aviso tipo="erro">{perfis.erro.mensagem}</Aviso> : null}
      {perfis.ok && lista.length === 0 ? (
        <Aviso tipo="info">
          Para cadastrar produtos ou serviços, crie primeiro um perfil.{" "}
          <Link href="/meus-perfis/novo">Criar perfil</Link>. Se quer apenas anunciar um produto,
          use <Link href="/meus-anuncios/novo">Meus anúncios</Link>.
        </Aviso>
      ) : (
        <FormNovoItem
          origem="perfil"
          categorias={categorias}
          perfis={lista}
          perfilInicial={perfilInicial}
        />
      )}
      <p className="rodape-links">
        Não encontrou a categoria? <Link href="/solicitar-categoria">Peça uma nova</Link>.
      </p>
    </PainelPagina>
  );
}
