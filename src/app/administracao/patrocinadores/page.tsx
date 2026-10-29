/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { FormNovoPatrocinador } from "../../_componentes/form-patrocinador";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { obterContextoPatrocinadores } from "../../_lib/contexto-patrocinadores";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";
import { perfisParaDestino } from "../../_lib/perfis-destino";
import { ROTULO_SITUACAO } from "../../_lib/situacao-patrocinador";

export const metadata: Metadata = { title: "Patrocinadores | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * Patrocinadores do carrossel (IM-020, D-008): listar com situação, criar e abrir para alterar. Quem não é
 * administrador recebe o 404 padrão (a rota não se revela). Sem preço, cobrança nem URL externa.
 */
export default async function PaginaPatrocinadores({
  searchParams,
}: PageProps<"/administracao/patrocinadores">) {
  const ctx = await obterContextoPatrocinadores("/administracao/patrocinadores");
  const lista = await ctx.patrocinadores.listarPatrocinadoresAdmin();
  if (!lista.ok && lista.erro.codigo === "SEM_PERMISSAO") notFound();
  const aviso = um((await searchParams).aviso);
  const perfis = await perfisParaDestino(ctx);
  const nomes = new Map(perfis.map((p) => [p.id, p.nome]));
  const patrocinadores = lista.ok ? lista.valor : [];
  const urls = await ctx.assinarImagens(patrocinadores.map((p) => p.imagemPath));

  return (
    <PainelPagina
      titulo="Patrocinadores"
      subtitulo="Carrossel da página inicial. Sempre identificado como Patrocinado, sem preço nem cobrança."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>
      </p>
      {aviso === "criado" ? <Aviso tipo="sucesso">Patrocinador criado.</Aviso> : null}

      <section aria-labelledby="titulo-lista">
        <h2 id="titulo-lista">Patrocinadores cadastrados</h2>
        {!lista.ok ? (
          <Aviso tipo="erro">{lista.erro.mensagem}</Aviso>
        ) : patrocinadores.length === 0 ? (
          <p className="ajuda">Nenhum patrocinador cadastrado.</p>
        ) : (
          <ul className="lista-cartoes">
            {patrocinadores.map((p) => (
              <li key={p.id} className="cartao">
                <h3>
                  <Link href={`/administracao/patrocinadores/${p.id}`}>{p.titulo}</Link>
                </h3>
                <p>
                  <SeloEstado rotulo={ROTULO_SITUACAO[p.situacao]} />
                </p>
                {urls[p.imagemPath] ? (
                  <p>
                    <img
                      src={urls[p.imagemPath]}
                      alt={`Imagem de ${p.titulo}`}
                      width={160}
                      loading="lazy"
                    />
                  </p>
                ) : null}
                <p>
                  Destino:{" "}
                  {p.perfilDestinoId
                    ? `perfil ${nomes.get(p.perfilDestinoId) ?? "publicado"}`
                    : `texto "${p.textoDestino ?? ""}"`}
                </p>
                <p className="ajuda">
                  Ordem {p.ordem}. Início: {p.inicioEm ? formatarDataHora(p.inicioEm) : "sem data"}.
                  Fim: {p.fimEm ? formatarDataHora(p.fimEm) : "sem data"}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-novo">
        <h2 id="titulo-novo">Novo patrocinador</h2>
        <FormNovoPatrocinador novoId={randomUUID()} perfis={perfis} />
      </section>
    </PainelPagina>
  );
}
