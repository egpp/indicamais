"use client";

import { acaoDefinirParametro, acaoReenviarComoAdmin, acaoTratarAlerta } from "../acoes-indicacoes";
import type { EstadoLink } from "../_lib/estado-indicacoes";
import { validarMotivo, validarParametro } from "../_lib/validacao-indicacoes";
import { Campo } from "./campos";
import { CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Acao = (estado: EstadoLink, dados: FormData) => Promise<EstadoLink>;

function FormComMotivo({
  acao,
  pedidoId,
  rotuloCampo,
  rotuloBotao,
  rotuloEnviando,
  secundario,
}: {
  acao: Acao;
  pedidoId: string;
  rotuloCampo: string;
  rotuloBotao: string;
  rotuloEnviando: string;
  secundario?: boolean;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoLink>(
    acao,
    validarMotivo,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={rotuloCampo}
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda="Fica registrado na auditoria."
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={rotuloBotao}
        rotuloEnviando={rotuloEnviando}
        secundario={secundario}
      />
    </form>
  );
}

/** IM-028: o administrador força um novo envio do aviso, com motivo. */
export function FormReenviarAdmin({ pedidoId }: { pedidoId: string }) {
  return (
    <FormComMotivo
      acao={acaoReenviarComoAdmin}
      pedidoId={pedidoId}
      rotuloCampo="Motivo do reenvio"
      rotuloBotao="Reenviar"
      rotuloEnviando="Reenviando..."
      secundario
    />
  );
}

/** IM-028: o administrador marca o alerta como tratado, com motivo. */
export function FormTratarAlerta({ pedidoId }: { pedidoId: string }) {
  return (
    <FormComMotivo
      acao={acaoTratarAlerta}
      pedidoId={pedidoId}
      rotuloCampo="Motivo do tratamento do alerta"
      rotuloBotao="Tratar alerta"
      rotuloEnviando="Salvando..."
    />
  );
}

/** Parâmetro central: valor dentro da faixa, com motivo (auditado). */
export function FormParametro({
  chave,
  valor,
  minimo,
  maximo,
}: {
  chave: string;
  valor: number;
  minimo: number;
  maximo: number;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoLink>(
    acaoDefinirParametro,
    validarParametro,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="chave" value={chave} />
      <Campo
        nome="valor"
        rotulo="Novo valor"
        inputMode="numeric"
        valorInicial={estado.valores?.valor ?? String(valor)}
        erro={erros.valor}
        ajuda={`Entre ${minimo} e ${maximo}.`}
      />
      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo da alteração"
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda="Fica registrado na auditoria."
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar" rotuloEnviando="Salvando..." />
    </form>
  );
}
