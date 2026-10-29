import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FormAtivarPatrocinador,
  FormEditarPatrocinador,
} from "../../../_componentes/form-patrocinador";
import { PainelPagina, SeloEstado } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { obterContextoPatrocinadores } from "../../../_lib/contexto-patrocinadores";
import { isoUtcParaBrasilia } from "../../../_lib/data-fuso";
import { SEM_INDEXACAO, imagensDoCampo } from "../../../_lib/pagina";
import { perfisParaDestino } from "../../../_lib/perfis-destino";
import { ROTULO_SITUACAO } from "../../../_lib/situacao-patrocinador";

export const metadata: Metadata = { title: "Patrocinador | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Alterar (motivo obrigatório) e ativar/desativar (motivo obrigatório). Não administrador: 404. */
export default async function PaginaPatrocinador({
  params,
}: PageProps<"/administracao/patrocinadores/[id]">) {
  const { id } = await params;
  const ctx = await obterContextoPatrocinadores(`/administracao/patrocinadores/${id}`);
  const lista = await ctx.patrocinadores.listarPatrocinadoresAdmin();
  if (!lista.ok) {
    if (lista.erro.codigo === "SEM_PERMISSAO") notFound();
    return (
      <PainelPagina titulo="Patrocinador" admin atual="administracao">
        <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const p = lista.valor.find((x) => x.id === id);
  if (!p) notFound();

  const [perfis, urls] = await Promise.all([
    perfisParaDestino(ctx),
    ctx.assinarImagens([p.imagemPath]),
  ]);
  // O destino atual sempre aparece como opção, mesmo fora dos 50 primeiros perfis.
  const opcoes =
    p.perfilDestinoId && !perfis.some((x) => x.id === p.perfilDestinoId)
      ? [...perfis, { id: p.perfilDestinoId, nome: "Perfil atual" }]
      : perfis;

  return (
    <PainelPagina titulo={p.titulo} admin atual="administracao">
      <p>
        <SeloEstado rotulo={ROTULO_SITUACAO[p.situacao]} />
      </p>
      <section aria-labelledby="titulo-situacao">
        <h2 id="titulo-situacao">{p.ativo ? "Desativar" : "Ativar"}</h2>
        <p className="ajuda">
          {p.ativo
            ? "Desativar tira do carrossel. O histórico fica guardado; não existe exclusão."
            : "Ativar coloca no carrossel dentro do período definido."}
        </p>
        <FormAtivarPatrocinador id={p.id} ativo={p.ativo} />
      </section>
      <section aria-labelledby="titulo-dados">
        <h2 id="titulo-dados">Dados</h2>
        <FormEditarPatrocinador
          id={p.id}
          inicial={{
            titulo: p.titulo,
            perfilDestinoId: p.perfilDestinoId ?? "",
            textoDestino: p.textoDestino ?? "",
            ordem: String(p.ordem),
            inicioEm: isoUtcParaBrasilia(p.inicioEm),
            fimEm: isoUtcParaBrasilia(p.fimEm),
          }}
          imagem={imagensDoCampo([p.imagemPath], urls)}
          perfis={opcoes}
        />
      </section>
      <p className="rodape-links">
        <Link href="/administracao/patrocinadores">Voltar para a lista</Link>
      </p>
    </PainelPagina>
  );
}
