import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acaoDespublicarPerfil, acaoEnviarPerfil, acaoPublicarPerfil } from "../../acoes-conteudo";
import { AvisoRascunhoNaoEnviado } from "../../_componentes/aviso-rascunho";
import { FormAcao } from "../../_componentes/form-acao";
import {
  FormEditarPerfil,
  FormEnderecoPerfil,
  FormImagensPerfil,
} from "../../_componentes/form-perfil";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora, motivoParaExibir } from "../../_lib/apresentacao";
import { obterContexto } from "../../_lib/contexto-sessao";
import {
  SEM_INDEXACAO,
  caminhosDoPerfil,
  categoriasParaTela,
  imagensDoCampo,
  um,
} from "../../_lib/pagina";
import { valoresIniciaisPerfil } from "../../_lib/valores-iniciais";

export const metadata: Metadata = { title: "Perfil | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

export default async function PaginaPerfil({
  params,
  searchParams,
}: PageProps<"/meus-perfis/[id]">) {
  const { id } = await params;
  const ctx = await obterContexto(`/meus-perfis/${id}`);
  const r = await ctx.perfis.obter(id);
  if (!r.ok) {
    if (r.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Perfil" atual="perfis">
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const p = r.valor;
  const c = p.conteudoEdicao;
  const aviso = um((await searchParams).aviso);
  const [{ categorias, erro: erroCategorias }, resultados, urls] = await Promise.all([
    categoriasParaTela(ctx),
    ctx.administracao.listarMeusResultados(),
    ctx.assinarImagens(caminhosDoPerfil(c)),
  ]);
  const rejeicao =
    p.estado.ultimaRejeitada && resultados.ok
      ? resultados.valor.find(
          (x) => x.alvo === "perfil" && x.alvoId === p.id && x.situacao === "rejeitado",
        )
      : undefined;
  const emAnalise = p.estado.aberta === "pendente";
  const rascunho = p.estado.aberta === "rascunho";

  return (
    <PainelPagina titulo={c.nome ?? "Perfil sem nome"} atual="perfis">
      <p>
        <SeloEstado rotulo={p.estado.rotulo} />
      </p>
      <p className="ajuda">Endereço da página: {p.slug}</p>

      {aviso === "criado" ? (
        <Aviso tipo="sucesso">
          Rascunho criado. Envie as imagens abaixo, confira a prévia e envie para aprovação.
        </Aviso>
      ) : null}
      {erroCategorias ? <Aviso tipo="erro">{erroCategorias}</Aviso> : null}
      {p.versaoAprovadaId && p.estado.aberta ? (
        <Aviso tipo="info">
          {p.estado.noAr
            ? "A versão aprovada continua no ar enquanto esta edição não for aprovada."
            : "A versão aprovada continua valendo, mas o perfil está despublicado. Aprovar a edição não o publica de novo."}
        </Aviso>
      ) : null}
      {rascunho ? (
        <AvisoRascunhoNaoEnviado>
          {p.pendencias.length === 0 ? (
            <FormAcao
              acao={acaoEnviarPerfil}
              campos={{ id: p.id }}
              rotulo="Enviar para aprovação"
              rotuloEnviando="Enviando..."
            />
          ) : (
            <p>Veja abaixo o que falta para enviar.</p>
          )}
        </AvisoRascunhoNaoEnviado>
      ) : null}
      {emAnalise ? (
        <Aviso tipo="info">Em análise. Você poderá editar depois da decisão.</Aviso>
      ) : null}
      {rejeicao ? (
        <Aviso tipo="erro">
          <p>Rejeitado em {formatarDataHora(rejeicao.decididaEm)}.</p>
          {motivoParaExibir(rejeicao.motivo) ? (
            <p className="motivo-rejeicao">
              <strong>Motivo:</strong> {motivoParaExibir(rejeicao.motivo)}
            </p>
          ) : null}
          <p>Ajuste e envie novamente.</p>
        </Aviso>
      ) : null}

      <section aria-labelledby="titulo-acoes">
        <h2 id="titulo-acoes">Ações</h2>
        <p>
          <Link className="botao botao-secundario" href={`/meus-perfis/${p.id}/previa`}>
            Ver prévia
          </Link>
        </p>
        {rascunho && p.pendencias.length > 0 ? (
          <Aviso tipo="info">
            Para enviar para aprovação, falta:
            <ul>
              {p.pendencias.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {p.versaoAprovadaId && !p.publicado ? (
          <FormAcao
            acao={acaoPublicarPerfil}
            campos={{ id: p.id }}
            rotulo="Publicar perfil"
            rotuloEnviando="Publicando..."
          />
        ) : null}
        {p.publicado ? (
          <>
            <p className="ajuda">
              Despublicar tira o perfil e seus itens do ar imediatamente. Você pode publicar de novo
              quando quiser.
            </p>
            <FormAcao
              acao={acaoDespublicarPerfil}
              campos={{ id: p.id }}
              rotulo="Despublicar perfil"
              rotuloEnviando="Despublicando..."
              secundario
            />
          </>
        ) : null}
        <p>
          <Link className="botao botao-secundario" href={`/meus-itens/novo?perfil=${p.id}`}>
            Adicionar produto ou serviço
          </Link>
        </p>
      </section>

      {emAnalise ? null : (
        <>
          <section aria-labelledby="titulo-dados">
            <h2 id="titulo-dados">Dados do perfil</h2>
            {p.versaoAprovadaId && !rascunho ? (
              <p className="ajuda">
                Ao salvar, criamos um rascunho. Depois clique em Enviar para aprovação. A versão
                aprovada continua no ar.
              </p>
            ) : null}
            <FormEditarPerfil
              perfilId={p.id}
              inicial={valoresIniciaisPerfil(c)}
              categorias={categorias}
            />
            <p className="rodape-links">
              Não encontrou sua categoria? <Link href="/solicitar-categoria">Peça uma nova</Link>.
            </p>
          </section>

          <section aria-labelledby="titulo-imagens">
            <h2 id="titulo-imagens">Imagens</h2>
            <FormImagensPerfil
              perfilId={p.id}
              imagem={imagensDoCampo(c.imagemPath ? [c.imagemPath] : [], urls)}
              banners={imagensDoCampo(c.bannersPaths, urls)}
              fotos={imagensDoCampo(c.fotosPaths, urls)}
            />
          </section>

          {p.slugEditavel ? (
            <section aria-labelledby="titulo-endereco">
              <h2 id="titulo-endereco">Endereço da página</h2>
              <FormEnderecoPerfil perfilId={p.id} slug={p.slug} />
            </section>
          ) : null}
        </>
      )}
    </PainelPagina>
  );
}
