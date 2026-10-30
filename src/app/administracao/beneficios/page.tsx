import type { Metadata } from "next";
import Link from "next/link";
import { acaoDecidirBeneficio } from "../../acoes-pontos";
import { FormAcao } from "../../_componentes/form-acao";
import { FormBeneficio, FormMotivoDecisao } from "../../_componentes/form-pontos";
import { PainelPagina, SeloEstado } from "../../_componentes/painel";
import { DadosBeneficio } from "../../_componentes/pontos";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirAdministradorPontos, obterContextoPontos } from "../../_lib/contexto-pontos";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Benefícios (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

/**
 * IM-036, IM-079: fila de benefícios propostos pelos responsáveis (aprovar ou rejeitar com motivo), propostas do
 * administrador aguardando aceite, cadastro de benefício para um perfil (nasce aguardando aceite) e edição da
 * proposta do responsável (gera contraproposta). Sem resgate, cupom ou sorteio (IM-037, IM-038). Quem não é
 * administrador recebe o 404 padrão.
 */
export default async function PaginaBeneficiosAdmin({
  searchParams,
}: PageProps<"/administracao/beneficios">) {
  const ctx = await obterContextoPontos("/administracao/beneficios");
  await exigirAdministradorPontos(ctx);
  const perfilInicial = um((await searchParams).perfil) ?? "";
  const [fila, aguardando] = await Promise.all([
    ctx.servico.filaBeneficios(),
    ctx.servico.listarAguardandoAceite(),
  ]);
  // Detalhes das versões pendentes (para mostrar os dados e preencher a contraproposta).
  const perfis = fila.ok ? [...new Set(fila.valor.map((b) => b.perfilId))] : [];
  const detalhes = await Promise.all(
    perfis.map(async (perfilId) => {
      const r = await ctx.servico.listarBeneficiosDoPerfil({ perfilId });
      return [perfilId, r.ok ? r.valor : []] as const;
    }),
  );
  const versaoPorId = new Map(
    detalhes.flatMap(([, bs]) => bs.flatMap((b) => b.versoes.map((v) => [v.id, v] as const))),
  );

  return (
    <PainelPagina
      titulo="Benefícios"
      subtitulo="Propostas dos responsáveis, propostas suas aguardando aceite e novo cadastro."
      admin
      atual="administracao"
    >
      <p>
        <Link className="botao botao-secundario" href="/administracao/revisao">
          Voltar para a fila de revisão
        </Link>{" "}
        <Link className="botao botao-secundario" href="/administracao/pontos">
          Pontos
        </Link>
      </p>
      <Aviso tipo="info">
        O resgate de benefícios ainda não existe. Aqui só se cadastra e publica o que será oferecido
        no futuro.
      </Aviso>

      <section aria-labelledby="titulo-fila">
        <h2 id="titulo-fila">Aguardando sua análise</h2>
        {!fila.ok ? (
          <Aviso tipo="erro">{fila.erro.mensagem}</Aviso>
        ) : fila.valor.length === 0 ? (
          <p className="ajuda">Nenhum benefício aguardando análise.</p>
        ) : (
          <ul className="lista-cartoes">
            {fila.valor.map((b) => {
              const v = versaoPorId.get(b.versaoId);
              return (
                <li key={b.versaoId} className="cartao">
                  <h3>{b.nome || "Benefício sem nome"}</h3>
                  <p>
                    <SeloEstado
                      rotulo={b.ehEdicao ? "Edição de benefício no ar" : "Novo benefício"}
                    />
                  </p>
                  <p className="ajuda">
                    Enviado em {formatarDataHora(b.enviadaEm)} · Perfil {b.perfilId}
                  </p>
                  {v ? (
                    <>
                      {v.descricao ? <p className="texto-corrido">{v.descricao}</p> : null}
                      <DadosBeneficio b={v} />
                    </>
                  ) : null}
                  <FormAcao
                    acao={acaoDecidirBeneficio}
                    campos={{ versaoId: b.versaoId, decisao: "aprovar" }}
                    rotulo="Aprovar"
                    rotuloEnviando="Aprovando..."
                  />
                  <details>
                    <summary className="botao-texto">Rejeitar</summary>
                    <FormMotivoDecisao
                      acao={acaoDecidirBeneficio}
                      versaoId={b.versaoId}
                      campo="decisao"
                      valor="rejeitar"
                      rotuloCampo="Motivo da rejeição"
                      rotuloBotao="Rejeitar"
                    />
                  </details>
                  {v ? (
                    <details>
                      <summary className="botao-texto">Editar a proposta (contraproposta)</summary>
                      <p className="ajuda">
                        Ao salvar, o responsável precisa aceitar a sua versão antes de ela valer.
                      </p>
                      <FormBeneficio
                        modo="admin-editar"
                        ocultos={{ versaoId: v.id }}
                        inicial={v}
                        rotuloBotao="Enviar contraproposta"
                        rotuloEnviando="Enviando..."
                      />
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-aceite">
        <h2 id="titulo-aceite">Aguardando aceite do responsável</h2>
        {!aguardando.ok ? (
          <Aviso tipo="erro">{aguardando.erro.mensagem}</Aviso>
        ) : aguardando.valor.length === 0 ? (
          <p className="ajuda">Nenhuma proposta sua aguardando aceite.</p>
        ) : (
          <ul className="lista-cartoes">
            {aguardando.valor.map((b) => (
              <li key={b.versaoId} className="cartao">
                <h3>{b.nome || "Benefício sem nome"}</h3>
                <p className="ajuda">
                  Enviada em {formatarDataHora(b.enviadaEm)} · Perfil {b.perfilId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-cadastrar">
        <h2 id="titulo-cadastrar">Cadastrar benefício para um perfil</h2>
        <p className="ajuda">
          O benefício nasce desligado e só vale depois que o responsável do perfil aceitar.
        </p>
        <FormBeneficio
          modo="admin-cadastrar"
          perfilInicial={perfilInicial}
          rotuloBotao="Enviar proposta ao responsável"
          rotuloEnviando="Enviando..."
        />
      </section>
    </PainelPagina>
  );
}
