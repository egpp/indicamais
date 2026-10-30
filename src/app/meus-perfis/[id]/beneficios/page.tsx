import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BeneficioDoPerfil, VersaoBeneficio } from "@/modules/pontos";
import {
  acaoEnviarVersao,
  acaoLigarDesligarBeneficio,
  acaoResponderProposta,
} from "../../../acoes-pontos";
import { FormAcao } from "../../../_componentes/form-acao";
import { FormBeneficio, FormMotivoDecisao } from "../../../_componentes/form-pontos";
import { PainelPagina, SeloEstado } from "../../../_componentes/painel";
import { DadosBeneficio, ROTULO_SITUACAO_VERSAO } from "../../../_componentes/pontos";
import { Aviso } from "../../../_componentes/ui";
import { formatarDataHora, motivoParaExibir } from "../../../_lib/apresentacao";
import { obterContextoPontos } from "../../../_lib/contexto-pontos";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Benefícios do perfil | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

/** Versão que alimenta o formulário: rascunho, senão a aprovada, senão a mais recente. */
function versaoParaEditar(b: BeneficioDoPerfil): VersaoBeneficio | undefined {
  return (
    b.versoes.find((v) => v.situacao === "rascunho") ??
    b.versoes.find((v) => v.id === b.versaoAprovadaId) ??
    b.versoes.find((v) => v.situacao !== "substituida")
  );
}

/**
 * IM-036, IM-079: benefícios do perfil. O responsável propõe (rascunho, envio para análise), liga e desliga o
 * benefício aprovado e responde às propostas do administrador (aceitar já ativa; recusar exige motivo). Sem resgate,
 * cupom ou sorteio (IM-037, IM-038). Só o dono do perfil vê esta tela; os demais recebem o 404 padrão.
 */
export default async function PaginaBeneficiosDoPerfil({
  params,
}: PageProps<"/meus-perfis/[id]/beneficios">) {
  const { id } = await params;
  const voltar = `/meus-perfis/${id}/beneficios`;
  const base = await obterContexto(voltar);
  const perfil = await base.perfis.obter(id);
  if (!perfil.ok) {
    if (perfil.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Benefícios" atual="perfis">
        <Aviso tipo="erro">{perfil.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const ctx = await obterContextoPontos(voltar);
  const [beneficios, propostas] = await Promise.all([
    ctx.servico.listarBeneficiosDoPerfil({ perfilId: id }),
    ctx.servico.propostasAguardandoAceite({ perfilId: id }),
  ]);
  const nome = perfil.valor.conteudoEdicao.nome ?? "Perfil sem nome";

  return (
    <PainelPagina
      titulo="Benefícios"
      subtitulo={`Benefícios que ${nome} oferece em troca de pontos.`}
      atual="perfis"
    >
      <p>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para o perfil
        </Link>
      </p>
      <Aviso tipo="info">
        O resgate de benefícios ainda não está disponível. Você pode cadastrar e deixar tudo pronto;
        todo benefício passa pela análise da administração antes de aparecer.
      </Aviso>

      {propostas.ok && propostas.valor.length > 0 ? (
        <section aria-labelledby="titulo-propostas">
          <h2 id="titulo-propostas">Propostas da administração</h2>
          <p className="ajuda">
            A administração sugeriu estes benefícios. Aceitando, o benefício já fica ativo.
          </p>
          <ul className="lista-cartoes">
            {propostas.valor.map((p) => (
              <li key={p.versao.id} className="cartao">
                <h3>{p.versao.nome ?? "Benefício sem nome"}</h3>
                {p.versao.descricao ? <p className="texto-corrido">{p.versao.descricao}</p> : null}
                <DadosBeneficio b={p.versao} />
                <FormAcao
                  acao={acaoResponderProposta}
                  campos={{ versaoId: p.versao.id, resposta: "aceitar" }}
                  rotulo="Aceitar"
                  rotuloEnviando="Aceitando..."
                />
                <details>
                  <summary className="botao-texto">Recusar</summary>
                  <FormMotivoDecisao
                    acao={acaoResponderProposta}
                    versaoId={p.versao.id}
                    campo="resposta"
                    valor="recusar"
                    rotuloCampo="Motivo da recusa"
                    rotuloBotao="Recusar proposta"
                  />
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!propostas.ok ? <Aviso tipo="erro">{propostas.erro.mensagem}</Aviso> : null}

      <section aria-labelledby="titulo-beneficios">
        <h2 id="titulo-beneficios">Seus benefícios</h2>
        {!beneficios.ok ? (
          <Aviso tipo="erro">{beneficios.erro.mensagem}</Aviso>
        ) : beneficios.valor.length === 0 ? (
          <p className="ajuda">Nenhum benefício cadastrado ainda.</p>
        ) : (
          <ul className="lista-cartoes">
            {beneficios.valor.map((b) => {
              const editavel = versaoParaEditar(b);
              const rascunho = b.versoes.find((v) => v.situacao === "rascunho");
              const travada = b.versoes.some(
                (v) => v.situacao === "pendente" || v.situacao === "aguardando_aceite",
              );
              const aprovada = b.versoes.find((v) => v.id === b.versaoAprovadaId);
              const rejeitada = b.versoes.find((v) => v.situacao === "rejeitada");
              return (
                <li key={b.id} className="cartao">
                  <h3>{editavel?.nome ?? "Benefício sem nome"}</h3>
                  <p>
                    <SeloEstado rotulo={b.ativo ? "Ligado" : "Desligado"} />{" "}
                    {b.versoes
                      .filter((v) => v.situacao !== "substituida")
                      .map((v) => (
                        <SeloEstado key={v.id} rotulo={ROTULO_SITUACAO_VERSAO[v.situacao]} />
                      ))}
                  </p>
                  {aprovada ? <DadosBeneficio b={aprovada} /> : null}
                  {rejeitada?.motivoRejeicao && !rascunho ? (
                    <Aviso tipo="info">
                      Uma alteração foi rejeitada: {motivoParaExibir(rejeitada.motivoRejeicao)}
                    </Aviso>
                  ) : null}
                  {b.versaoAprovadaId ? (
                    <FormAcao
                      acao={acaoLigarDesligarBeneficio}
                      campos={{ beneficioId: b.id, ativo: b.ativo ? "nao" : "sim" }}
                      rotulo={b.ativo ? "Desligar" : "Ligar"}
                      rotuloEnviando="Salvando..."
                      secundario={b.ativo}
                    />
                  ) : null}
                  {rascunho ? (
                    <FormAcao
                      acao={acaoEnviarVersao}
                      campos={{ versaoId: rascunho.id }}
                      rotulo="Enviar para análise"
                      rotuloEnviando="Enviando..."
                    />
                  ) : null}
                  {travada ? (
                    <p className="ajuda">
                      Há uma versão em análise ou aguardando resposta. Edições ficam disponíveis
                      depois.
                    </p>
                  ) : editavel ? (
                    <details>
                      <summary className="botao-texto">
                        {rascunho ? "Editar rascunho" : "Editar benefício"}
                      </summary>
                      <FormBeneficio
                        key={editavel.id}
                        modo="salvar"
                        ocultos={{ beneficioId: b.id }}
                        inicial={editavel}
                        rotuloBotao="Salvar"
                      />
                    </details>
                  ) : null}
                  <p className="ajuda">
                    Última versão em{" "}
                    {formatarDataHora(b.versoes[0]?.enviadaEm ?? b.versoes[0]?.criadoEm)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-novo">
        <h2 id="titulo-novo">Novo benefício</h2>
        <FormBeneficio modo="criar" ocultos={{ perfilId: id }} rotuloBotao="Salvar rascunho" />
      </section>
    </PainelPagina>
  );
}
