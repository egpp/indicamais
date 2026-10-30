import type { Metadata } from "next";
import Link from "next/link";
import { ROTULOS_TIPO_DENUNCIA, type SituacaoDenuncia } from "@/modules/administracao";
import { FormDecidirDenuncia } from "../../_componentes/form-ciclo-vida";
import { NavAdministracao } from "../../_componentes/nav-administracao";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirPermissao, obterContextoCicloVida } from "../../_lib/contexto-ciclo-vida";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Denúncias (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const ROTULO_SITUACAO: Record<SituacaoDenuncia, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  procedente: "Procedente",
  improcedente: "Improcedente",
};
const ROTULO_ALVO = {
  perfil: "Perfil",
  item: "Item",
  conta: "Conta",
  pedido: "Pedido",
  indicacao: "Indicação",
} as const;

/**
 * IM-076: fila de denúncias para quem tem a permissão analisar_denuncias (404 para os demais). O denunciante
 * aparece só como tipo e referência opaca; nunca conta, e-mail ou WhatsApp. Decidir exige motivo, é auditado e NÃO
 * suspende nada: a suspensão é uma ação separada, em Contas (permissão suspender).
 */
export default async function PaginaDenunciasAdmin() {
  const ctx = await obterContextoCicloVida("/administracao/denuncias");
  const permissoes = await exigirPermissao(ctx, "analisar_denuncias");
  const [fila, geral] = await Promise.all([
    ctx.admin.listarFilaDenuncias(),
    ctx.ehAdministradorGeral(),
  ]);
  return (
    <PainelPagina
      titulo="Denúncias"
      subtitulo="Abertas e em análise primeiro. Decidir uma denúncia não suspende nenhuma conta."
      admin
      atual="administracao"
    >
      <NavAdministracao permissoes={permissoes} geral={geral} atual="denuncias" />
      {!fila.ok ? (
        <Aviso tipo="erro">{fila.erro.mensagem}</Aviso>
      ) : fila.valor.length === 0 ? (
        <Aviso tipo="info">Nenhuma denúncia por enquanto.</Aviso>
      ) : (
        <ul className="lista-cartoes">
          {fila.valor.map((d) => {
            const decidida = d.situacao === "procedente" || d.situacao === "improcedente";
            return (
              <li key={d.id} className="cartao">
                <h3>{ROTULOS_TIPO_DENUNCIA[d.tipo]}</h3>
                <p>
                  <SeloEstado rotulo={ROTULO_SITUACAO[d.situacao]} />{" "}
                  <span className="ajuda">
                    {ROTULO_ALVO[d.alvoTipo]}
                    {d.alvoNome ? `: ${d.alvoNome}` : ""}
                  </span>
                </p>
                {d.texto ? <p className="texto-corrido quebra-total">{d.texto}</p> : null}
                <p className="ajuda quebra-total">
                  Denunciante: {d.denuncianteTipo === "conta" ? "pessoa logada" : "visitante"}{" "}
                  (referência {d.denuncianteRef})
                </p>
                <p className="ajuda">
                  {d.totalNoAlvo} {d.totalNoAlvo === 1 ? "denúncia" : "denúncias"} neste alvo · Em{" "}
                  {formatarDataHora(d.criadoEm)}
                </p>
                {decidida ? null : (
                  <details>
                    <summary className="botao-texto">Decidir</summary>
                    <FormDecidirDenuncia denunciaId={d.id} />
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {permissoes.includes("suspender") ? (
        <p className="ajuda">
          Para suspender uma conta, use a ação separada em{" "}
          <Link href="/administracao/contas">Contas</Link>, com motivo próprio.
        </p>
      ) : null}
    </PainelPagina>
  );
}
