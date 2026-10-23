import type { Metadata } from "next";
import Link from "next/link";
import { FormNovoPerfil } from "../../_componentes/form-perfil";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { obterContexto } from "../../_lib/contexto-sessao";
import { SEM_INDEXACAO, categoriasParaTela } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Novo perfil | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

export default async function PaginaNovoPerfil() {
  const ctx = await obterContexto("/meus-perfis/novo");
  const { categorias, erro } = await categoriasParaTela(ctx);
  return (
    <PainelPagina
      titulo="Novo perfil"
      subtitulo="Preencha os dados. Você poderá conferir a prévia antes de enviar para aprovação."
      atual="perfis"
    >
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <FormNovoPerfil categorias={categorias} />
      <p className="rodape-links">
        Não encontrou sua categoria? <Link href="/solicitar-categoria">Peça uma nova</Link>.
      </p>
    </PainelPagina>
  );
}
