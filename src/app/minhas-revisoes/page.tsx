import type { Metadata } from "next";
import Link from "next/link";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { formatarDataHora, motivoParaExibir } from "../_lib/apresentacao";
import { obterContexto } from "../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../_lib/pagina";
import { rotuloTipoItem } from "../_lib/tipo-item";

export const metadata: Metadata = { title: "Minhas revisões | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTULO_SITUACAO = {
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
} as const;

/** IM-023: situação, motivo da rejeição ou link publicado, e data de cada envio para aprovação. */
export default async function PaginaMinhasRevisoes() {
  const ctx = await obterContexto("/minhas-revisoes");
  const [admin, r] = await Promise.all([
    ctx.administracao.ehAdministrador(),
    ctx.administracao.listarMeusResultados(),
  ]);
  const meus = r.ok && r.valor.some((x) => x.alvo === "item") ? await ctx.itens.listarMeus() : null;
  const tipos = new Map((meus?.ok ? meus.valor : []).map((i) => [i.id, i.tipo] as const));
  return (
    <PainelPagina
      titulo="Minhas revisões"
      subtitulo="Resultado do que você enviou para aprovação."
      admin={admin}
      atual="revisoes"
    >
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : r.valor.length === 0 ? (
        <Aviso tipo="info">Você ainda não enviou nada para aprovação.</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {r.valor.map((x) => (
            <li key={x.versaoId} className="cartao">
              <h2>
                <Link
                  href={
                    x.alvo === "perfil" ? `/meus-perfis/${x.alvoId}` : `/meus-itens/${x.alvoId}`
                  }
                >
                  {x.nome ?? (x.alvo === "perfil" ? "Perfil sem nome" : "Item sem nome")}
                </Link>
              </h2>
              <p>
                <SeloEstado rotulo={ROTULO_SITUACAO[x.situacao]} />{" "}
                <span className="ajuda">
                  {x.alvo === "perfil" ? "Perfil" : rotuloTipoItem(tipos.get(x.alvoId))}
                </span>
              </p>
              <p>{x.mensagem}</p>
              {motivoParaExibir(x.motivo) ? (
                <p>
                  <strong>Motivo:</strong> {motivoParaExibir(x.motivo)}
                </p>
              ) : null}
              {x.linkPublicado ? (
                <p>
                  <Link href={x.linkPublicado}>Ver página publicada</Link>
                </p>
              ) : null}
              <p className="ajuda">
                Enviado em {formatarDataHora(x.enviadaEm)}
                {x.decididaEm ? ` · Decidido em ${formatarDataHora(x.decididaEm)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
