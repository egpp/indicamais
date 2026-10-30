import type { Metadata } from "next";
import Link from "next/link";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import { CurtirPerfil, SairDaBase } from "../_componentes/form-relacionamento";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { formatarDataCivil } from "../_lib/apresentacao";
import { obterContextoRelacionamento } from "../_lib/contexto-relacionamento";
import { SEM_INDEXACAO, um } from "../_lib/pagina";

export const metadata: Metadata = { title: "Minhas participações | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/**
 * IM-043, IM-045: bases de relacionamento em que a pessoa está, por perfil. "Sair da base" (com confirmação do
 * efeito) é por perfil: some da base da empresa e encerra os avisos dela; fica só o histórico agregado e anônimo.
 */
export default async function PaginaMinhasParticipacoes({
  searchParams,
}: PageProps<"/minhas-participacoes">) {
  const aviso = um((await searchParams).aviso);
  const ctx = await obterContextoRelacionamento("/minhas-participacoes");
  const [admin, participacoes] = await Promise.all([
    ctx.ehAdministrador(),
    ctx.relacionamento.minhasParticipacoes(),
  ]);
  return (
    <PainelPagina
      titulo="Minhas participações"
      subtitulo="Perfis em que você curtiu ou cujas indicações geraram contato."
      admin={admin}
      atual="participacoes"
    >
      {aviso === "saiu" ? <Aviso tipo="sucesso">Você saiu da base deste perfil.</Aviso> : null}
      {!participacoes.ok ? (
        <Aviso tipo="erro">{participacoes.erro.mensagem}</Aviso>
      ) : participacoes.valor.length === 0 ? (
        <p className="ajuda">
          Você ainda não participa da base de nenhum perfil.{" "}
          <Link href="/">Ir para a página inicial</Link>
        </p>
      ) : (
        <ul className="lista-cartoes">
          {participacoes.valor.map((p) => (
            <li key={p.perfilId} className="cartao">
              <h2>
                <Link href={ROTAS_PUBLICAS.perfil(p.perfilSlug)}>{p.perfilNome || "Perfil"}</Link>
              </h2>
              <p>
                {p.curtiu ? <SeloEstado rotulo="Curtiu" /> : null}{" "}
                {p.indicou ? <SeloEstado rotulo="Indicou" /> : null}
              </p>
              <p className="ajuda">
                Na base desde {formatarDataCivil(p.entrouEm)}.
                {p.curtiu && p.curtidaEm ? ` Curtiu em ${formatarDataCivil(p.curtidaEm)}.` : ""}
                {p.indicou
                  ? ` ${p.indicacoesValidas} ${p.indicacoesValidas === 1 ? "indicação gerou contato" : "indicações geraram contato"}.`
                  : ""}
              </p>
              {p.curtiu ? (
                <CurtirPerfil perfilId={p.perfilId} logado curtiu retorno="/minhas-participacoes" />
              ) : null}
              <SairDaBase perfilId={p.perfilId} perfilNome={p.perfilNome || "este perfil"} />
            </li>
          ))}
        </ul>
      )}
    </PainelPagina>
  );
}
