"use client";

import { useId, useState } from "react";
import {
  acaoAlterarPercentual,
  acaoAvancarRepasse,
  acaoCancelarAssinatura,
  acaoConfirmarPagamento,
  acaoCriarOferta,
  acaoDefinirAntecedenciaAviso,
  acaoDefinirHabilitacao,
  acaoDefinirOfertaAtiva,
  acaoDefinirPrazoInadimplencia,
  acaoEncerrarVinculo,
  acaoEstornarPagamento,
  acaoRegistrarAssinatura,
  acaoRegistrarVinculo,
  acaoReverterComissao,
} from "../acoes-comissoes";
import {
  DEFINICOES_COMISSOES,
  errosDoFormulario,
  type CampoSpec,
  type ChaveComissoes,
} from "../_lib/definicoes-comissoes";
import { formatarReais, valorDivergente } from "../_lib/dinheiro-comissoes";
import { lerDeRegistro } from "../_lib/entrada-conteudo";
import type { EstadoComissoes } from "../_lib/estado-comissoes";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

/**
 * Formulários da Fase 7 (IM-061 a IM-073). Validação no navegador com os mesmos schemas do servidor, botão travado
 * durante o envio (IM-028), motivo obrigatório nas ações do administrador e confirmação explícita nas ações sem volta.
 * Os textos deixam claro que nada é cobrado nem repassado automaticamente: o administrador confirma manualmente.
 */

type Acao = (estado: EstadoComissoes, dados: FormData) => Promise<EstadoComissoes>;

const ACOES: Record<ChaveComissoes, Acao | null> = {
  parametro: acaoDefinirPrazoInadimplencia,
  antecedenciaAviso: acaoDefinirAntecedenciaAviso,
  habilitacao: acaoDefinirHabilitacao,
  vinculo: acaoRegistrarVinculo,
  assinatura: acaoRegistrarAssinatura,
  cancelarAssinatura: acaoCancelarAssinatura,
  pagamento: acaoConfirmarPagamento,
  estorno: acaoEstornarPagamento,
  reversao: acaoReverterComissao,
  repasse: acaoAvancarRepasse,
  encerrarVinculo: acaoEncerrarVinculo,
  oferta: acaoCriarOferta,
  percentual: acaoAlterarPercentual,
  ofertaAtiva: acaoDefinirOfertaAtiva,
};

function CaixaMarcar({
  nome,
  rotulo,
  erro,
}: {
  nome: string;
  rotulo: string;
  erro?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="campo-marcar">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name={nome}
          value="sim"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
        {rotulo}
      </label>
      {erro ? (
        <p id={`${id}-erro`} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function CampoDe({
  c,
  erro,
  valor,
  opcoes,
}: {
  c: CampoSpec;
  erro: string | undefined;
  valor: string | undefined;
  opcoes?: readonly { valor: string; rotulo: string }[] | undefined;
}) {
  if (c.tipo === "motivo") {
    return (
      <CampoTextoLongo
        nome={c.nome}
        rotulo={c.rotulo}
        linhas={3}
        valorInicial={valor}
        erro={erro}
        ajuda={c.ajuda}
      />
    );
  }
  if (c.tipo === "select") {
    return (
      <CampoSelect
        nome={c.nome}
        rotulo={c.rotulo}
        opcoes={opcoes ?? c.opcoes ?? []}
        valorInicial={valor ?? ""}
        erro={erro}
        ajuda={c.ajuda}
      />
    );
  }
  const numerico = c.tipo === "reais" || c.tipo === "percentual" || c.tipo === "inteiro";
  return (
    <Campo
      nome={c.nome}
      rotulo={c.rotulo}
      tipo={c.tipo === "data" ? "date" : "text"}
      valorInicial={valor}
      erro={erro}
      ajuda={c.ajuda}
      opcional={c.opcional}
      inputMode={c.tipo === "competencia" || numerico ? "numeric" : "text"}
      autoComplete="off"
    />
  );
}

/**
 * Formulário genérico de uma ação de comissões. `ocultos` leva os valores fixos da linha (ids, estado do repasse...):
 * o campo correspondente não é mostrado de novo. `opcoes` preenche selects cujas opções vêm da tela (ex.: itens do
 * negócio). `iniciais` sugere valores de partida. `valorCombinadoCentavos` (confirmação de pagamento) avisa, ao
 * digitar, que o valor recebido difere do combinado e pede a explicação no motivo.
 */
export function FormComissoes({
  chave,
  rotuloBotao,
  rotuloEnviando = "Enviando...",
  ocultos,
  opcoes,
  iniciais,
  valorCombinadoCentavos,
  perigo,
  secundario,
  textoConfirmacao = "Confirmo que esta ação fica registrada e não pode ser desfeita.",
}: {
  chave: ChaveComissoes;
  rotuloBotao: string;
  rotuloEnviando?: string;
  ocultos?: Record<string, string>;
  opcoes?: Record<string, readonly { valor: string; rotulo: string }[]>;
  iniciais?: Record<string, string>;
  valorCombinadoCentavos?: number;
  perigo?: boolean;
  secundario?: boolean;
  textoConfirmacao?: string;
}) {
  const def = DEFINICOES_COMISSOES[chave];
  const acao = ACOES[chave] as Acao;
  const { estado, action, enviando, erros, registrarForm, aoEnviar } =
    useFormulario<EstadoComissoes>(acao, (dados) =>
      errosDoFormulario(chave, lerDeRegistro({ ...(ocultos ?? {}), ...dados })),
    );
  const [digitado, setDigitado] = useState(iniciais?.valorCentavos ?? "");
  const campos: readonly CampoSpec[] = def.campos.filter((c) => !(c.nome in (ocultos ?? {})));
  const divergente =
    valorCombinadoCentavos !== undefined && valorDivergente(digitado, valorCombinadoCentavos);
  const confirmar = "confirmar" in def && def.confirmar === true;
  return (
    <form
      ref={registrarForm}
      action={action}
      onSubmit={aoEnviar}
      onInput={(e) => {
        const alvo = e.target as HTMLInputElement;
        if (alvo.name === "valorCentavos") setDigitado(alvo.value);
      }}
      noValidate
    >
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      {Object.entries(ocultos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {campos.map((c) => (
        <CampoDe
          key={c.nome}
          c={c}
          erro={erros[c.nome]}
          valor={estado.valores?.[c.nome] ?? iniciais?.[c.nome]}
          opcoes={opcoes?.[c.nome]}
        />
      ))}
      {divergente && valorCombinadoCentavos !== undefined ? (
        <Aviso tipo="atencao">
          O valor informado é diferente do combinado na assinatura (
          {formatarReais(valorCombinadoCentavos)}). Explique a diferença no motivo, com pelo menos
          10 caracteres.
        </Aviso>
      ) : null}
      {estado.pedirConfirmacaoPaga ? (
        <CaixaMarcar
          nome="confirmarJaPaga"
          rotulo="Confirmo: a comissão já foi paga e quero registrar a reversão mesmo assim"
        />
      ) : null}
      {confirmar ? (
        <CaixaMarcar nome="confirmo" rotulo={textoConfirmacao} erro={erros.confirmo} />
      ) : null}
      <BotaoEnviar
        enviando={enviando}
        rotulo={estado.pedirConfirmacaoPaga ? "Confirmar e registrar reversão" : rotuloBotao}
        rotuloEnviando={rotuloEnviando}
        secundario={secundario}
        perigo={perigo}
      />
    </form>
  );
}

/** Ativar ou desativar uma oferta: botão único, sem campos. A desativação bloqueia só comissões futuras. */
export function FormOfertaAtiva({ ofertaId, ativa }: { ofertaId: string; ativa: boolean }) {
  const { estado, action, enviando, registrarForm, aoEnviar } = useFormulario<EstadoComissoes>(
    acaoDefinirOfertaAtiva,
    () => null,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="ofertaId" value={ofertaId} />
      <input type="hidden" name="ativa" value={ativa ? "nao" : "sim"} />
      <BotaoEnviar
        enviando={enviando}
        rotulo={ativa ? "Desativar oferta" : "Ativar oferta"}
        rotuloEnviando="Salvando..."
        secundario
      />
    </form>
  );
}
