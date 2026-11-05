import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AVISO_SEM_AUTOMATICO } from "../../_componentes/comissoes";
import { FormComissoes } from "../../_componentes/form-comissoes";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataCivil } from "../../_lib/apresentacao";
import {
  exigirAdministradorComissoes,
  obterContextoComissoes,
} from "../../_lib/contexto-comissoes";
import { SEM_INDEXACAO } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Comissões (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

const dia = (iso: string) => formatarDataCivil(iso.slice(0, 10));

function Acao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="cartao">
      <h2 id={id}>{titulo}</h2>
      <p className="ajuda">{descricao}</p>
      <details>
        <summary className="botao-texto">Abrir formulário</summary>
        {children}
      </details>
    </section>
  );
}

/**
 * IM-061 a IM-073: área do administrador geral para o módulo de comissões. Tudo é manual: habilitar o módulo por
 * negócio, registrar vínculo e assinatura, confirmar cada mensalidade, estornar, reverter, avançar o repasse e
 * encerrar vínculos vencidos. Toda ação pede motivo (auditoria) e ações sem volta pedem confirmação. A plataforma
 * não cobra nem repassa dinheiro (IM-070, IM-090). O cliente e o indicador aparecem só como referência opaca
 * (IM-029, IM-041, IM-050). Quem não é administrador recebe o 404 padrão.
 */
export default async function PaginaComissoesAdmin() {
  const ctx = await obterContextoComissoes("/administracao/comissoes");
  await exigirAdministradorComissoes(ctx);
  const vencidos = await ctx.servico.listarVinculosVencidos();
  return (
    <PainelPagina
      titulo="Comissões"
      subtitulo="Registro e confirmação manual de assinaturas, pagamentos e repasses."
      admin
      atual="administracao"
    >
      <Aviso tipo="info">{AVISO_SEM_AUTOMATICO}</Aviso>

      <section aria-labelledby="titulo-vencidos">
        <h2 id="titulo-vencidos">Vínculos com prazo vencido</h2>
        <p className="ajuda">
          São vínculos cujo indicador ficou em atraso além do prazo de inadimplência. Nada é
          encerrado sozinho: você decide, um a um. Ao encerrar, o cliente não passa para outro
          indicador e o vínculo não volta sozinho se o indicador regularizar.
        </p>
        {!vencidos.ok ? (
          <Aviso tipo="erro">{vencidos.erro.mensagem}</Aviso>
        ) : vencidos.valor.length === 0 ? (
          <p className="ajuda">Nenhum vínculo vencido no momento.</p>
        ) : (
          <ul className="lista-cartoes">
            {vencidos.valor.map((v) => (
              <li key={v.vinculoId} className="cartao">
                <h3>Indicador (referência): {v.indicadorRef.slice(0, 12)}…</h3>
                <p className="ajuda quebra-total">
                  Negócio {v.negocioId} · vínculo {v.vinculoId}
                </p>
                <p className="ajuda">
                  Em atraso desde {dia(v.inadimplenteDesde)} · prazo de {v.prazoDias} dias · venceu
                  em {dia(v.venceEm)}
                </p>
                <details>
                  <summary className="botao-texto">Encerrar este vínculo</summary>
                  <FormComissoes
                    chave="encerrarVinculo"
                    ocultos={{ vinculoId: v.vinculoId }}
                    rotuloBotao="Encerrar vínculo"
                    rotuloEnviando="Encerrando..."
                    perigo
                    textoConfirmacao="Confirmo encerrar este vínculo. Não há restauração automática."
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Acao
        id="titulo-habilitar"
        titulo="Habilitar ou desabilitar o módulo"
        descricao="O módulo é ligado por negócio, pelo administrador. Desabilitar preserva saldos e histórico e só bloqueia comissões novas."
      >
        <FormComissoes chave="habilitacao" rotuloBotao="Registrar" rotuloEnviando="Salvando..." />
      </Acao>

      <Acao
        id="titulo-vinculo"
        titulo="Registrar vínculo indicador e cliente"
        descricao="Liga a conta de quem indicou à conta do cliente, dentro de um negócio. Sem níveis: só clientes diretos."
      >
        <FormComissoes
          chave="vinculo"
          rotuloBotao="Registrar vínculo"
          rotuloEnviando="Salvando..."
        />
      </Acao>

      <Acao
        id="titulo-assinatura"
        titulo="Registrar assinatura"
        descricao="Registra a assinatura mensal que o cliente combinou com o negócio. A plataforma não cobra: você só anota."
      >
        <FormComissoes
          chave="assinatura"
          rotuloBotao="Registrar assinatura"
          rotuloEnviando="Salvando..."
        />
      </Acao>

      <Acao
        id="titulo-pagamento"
        titulo="Confirmar pagamento mensal"
        descricao="Confirme só depois de conferir o recebimento fora da plataforma. A comissão nasce aqui, se o indicador estiver em dia. Repetir a mesma competência não duplica."
      >
        <FormComissoes
          chave="pagamento"
          rotuloBotao="Confirmar pagamento"
          rotuloEnviando="Confirmando..."
          textoConfirmacao="Confirmo que o pagamento deste mês foi recebido. O registro não pode ser apagado."
        />
      </Acao>

      <Acao
        id="titulo-estorno"
        titulo="Estornar pagamento"
        descricao="O pagamento é estornado e a comissão gerada por ele é revertida por um lançamento novo. O histórico é preservado. Se a comissão já foi paga, será pedida uma segunda confirmação."
      >
        <FormComissoes
          chave="estorno"
          rotuloBotao="Estornar pagamento"
          rotuloEnviando="Estornando..."
          perigo
        />
      </Acao>

      <Acao
        id="titulo-reverter"
        titulo="Reverter comissão"
        descricao="Reverte uma comissão por cancelamento, estorno ou correção. Nada é apagado: a reversão é um lançamento novo. Se a comissão já foi paga, será pedida uma segunda confirmação."
      >
        <FormComissoes
          chave="reversao"
          rotuloBotao="Reverter comissão"
          rotuloEnviando="Revertendo..."
          perigo
        />
      </Acao>

      <Acao
        id="titulo-repasse"
        titulo="Avançar repasse"
        descricao="Registra o andamento do repasse que você faz fora da plataforma: gerada, pendente de repasse, paga. A ordem é fixa."
      >
        <FormComissoes
          chave="repasse"
          rotuloBotao="Atualizar repasse"
          rotuloEnviando="Salvando..."
        />
      </Acao>

      <Acao
        id="titulo-cancelar"
        titulo="Cancelar assinatura"
        descricao="Bloqueia só comissões futuras. Comissões já geradas, inclusive a do último mês, continuam como estão; para revertê-las use a reversão."
      >
        <FormComissoes
          chave="cancelarAssinatura"
          rotuloBotao="Cancelar assinatura"
          rotuloEnviando="Cancelando..."
          perigo
        />
      </Acao>

      <Acao
        id="titulo-prazo"
        titulo="Prazo de inadimplência"
        descricao="Dias de atraso do indicador antes de o vínculo poder ser encerrado (padrão 60). Só o administrador muda."
      >
        <FormComissoes chave="parametro" rotuloBotao="Salvar prazo" rotuloEnviando="Salvando..." />
      </Acao>
    </PainelPagina>
  );
}
