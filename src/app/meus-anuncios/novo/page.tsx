import type { Metadata } from "next";
import Link from "next/link";
import { FormNovoItem } from "../../_componentes/form-item";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO, categoriasParaTela } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Novo anúncio | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

export default async function PaginaNovoAnuncio() {
  const ctx = await obterContexto("/meus-anuncios/novo");
  const { categorias, erro } = await categoriasParaTela(ctx);
  return (
    <PainelPagina
      titulo="Novo anúncio"
      subtitulo="Anúncio particular, sem perfil comercial. Passa por aprovação antes de aparecer."
      atual="anuncios"
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <FormNovoItem origem="anuncio" categorias={categorias} />
      <p className="rodape-links">
        Não encontrou a categoria? <Link href="/solicitar-categoria">Peça uma nova</Link>.
      </p>
    </PainelPagina>
  );
}
