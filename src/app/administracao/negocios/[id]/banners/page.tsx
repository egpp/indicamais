/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rotuloDestinoBanner } from "../../../../_componentes/banners-comum";
import { FormBannerAdmin, FormRemoverBannerAdmin } from "../../../../_componentes/form-aparencia";
import { PainelPagina, SeloEstado } from "../../../../_componentes/painel";
import { Aviso } from "../../../../_componentes/ui";
import { formatarDataHora } from "../../../../_lib/apresentacao";
import { obterContextoAparencia } from "../../../../_lib/contexto-aparencia";
import { exigirPermissao, obterContextoCicloVida } from "../../../../_lib/contexto-ciclo-vida";
import { obterContexto } from "../../../../_lib/contexto-sessao";
import { SEM_INDEXACAO, um } from "../../../../_lib/pagina";

export const metadata: Metadata = {
  title: "Banners da empresa (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const ROTULO_SITUACAO = {
  na_versao: "No site do responsável",
  aguardando_aceite: "Aguardando aceite",
  aceito: "Aceito",
  recusado: "Recusado",
  removido: "Retirado",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Banner na empresa (D-016; IM-093): quem tem a permissão aprovar envia uma imagem ao responsável, que precisa
 * aceitar antes de ela aparecer. O administrador só retira o que ele mesmo adicionou. Sem a permissão: 404.
 */
export default async function PaginaBannersEmpresaAdmin({
  params,
  searchParams,
}: PageProps<"/administracao/negocios/[id]/banners">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const nomeInformado = um((await searchParams).nome)?.slice(0, 80);
  const rota = `/administracao/negocios/${id}/banners`;
  const ciclo = await obterContextoCicloVida(rota);
  await exigirPermissao(ciclo, "aprovar");
  const geral = await ciclo.ehAdministradorGeral();
  const { servico } = await obterContextoAparencia(rota);
  const lista = await servico.bannersDaEmpresa(id);
  const sessao = await obterContexto(rota);
  const banners = lista.ok ? lista.valor : [];
  const urls = await sessao.assinarImagens(banners.map((b) => b.imagemPath));

  return (
    <PainelPagina
      titulo="Banners da empresa"
      subtitulo={
        nomeInformado
          ? `Empresa selecionada: ${nomeInformado}.`
          : "Envie uma imagem para a empresa selecionada."
      }
      admin={geral}
      atual="administracao"
    >
      <Aviso tipo="info">
        A imagem vai para o responsável e só aparece na página depois que ele aceitar. A empresa
        precisa estar publicada, e o limite é de 6 banners no total.
      </Aviso>
      <section aria-labelledby="titulo-novo-banner">
        <h2 id="titulo-novo-banner">Adicionar banner</h2>
        <FormBannerAdmin perfilId={id} />
      </section>
      <section aria-labelledby="titulo-banners-empresa">
        <h2 id="titulo-banners-empresa">Banners da empresa</h2>
        {!lista.ok ? (
          <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
        ) : banners.length === 0 ? (
          <p className="ajuda">Esta empresa ainda não tem banners.</p>
        ) : (
          <ul className="lista-cartoes">
            {banners.map((b) => (
              <li key={b.id} className="cartao banner-proposta">
                {urls[b.imagemPath] ? (
                  <img
                    className="banner-previa-admin"
                    src={urls[b.imagemPath]}
                    alt={b.textoAlternativo}
                  />
                ) : (
                  <span className="imagem-indisponivel">Imagem sem prévia</span>
                )}
                <p>
                  <SeloEstado rotulo={ROTULO_SITUACAO[b.situacao]} />
                </p>
                <p className="ajuda">
                  {b.origem === "administrador" ? "Adicionado por administrador" : "Do responsável"}
                  {" · "}Leva para: {rotuloDestinoBanner(b.destinoSecao)} · Criado em{" "}
                  {formatarDataHora(b.criadoEm)}
                </p>
                {b.motivoResposta ? (
                  <p className="ajuda">Motivo da resposta: {b.motivoResposta}</p>
                ) : null}
                {b.origem === "administrador" &&
                (b.situacao === "aguardando_aceite" || b.situacao === "aceito") ? (
                  <FormRemoverBannerAdmin bannerId={b.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        <Link className="botao botao-secundario" href="/administracao/negocios">
          Voltar para sites e itens
        </Link>
      </p>
    </PainelPagina>
  );
}
