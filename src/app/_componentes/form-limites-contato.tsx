"use client";

import { useId } from "react";
import { acaoDefinirParametroContato } from "../acoes-indicacoes";
import type { EstadoLink } from "../_lib/estado-indicacoes";
import { validarInterruptorContato, validarLimiteContato } from "../_lib/validacao-indicacoes";
import { Campo } from "./campos";
import { CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

const AJUDA_MOTIVO = "De 10 a 500 caracteres. Fica registrado na auditoria.";

/** Limite por hora (D-034 item 1): valor dentro da faixa e motivo obrigatório. A regra final é do servidor e do banco. */
export function FormLimiteContato({
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
    acaoDefinirParametroContato,
    (d) => validarLimiteContato(d, { minimo, maximo }),
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="chave" value={chave} />
      <Campo
        nome="valor"
        rotulo="Novo limite por hora"
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
        ajuda={AJUDA_MOTIVO}
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar limite" rotuloEnviando="Salvando..." />
    </form>
  );
}

/** Interruptor da recusa de excesso: ligar exige confirmação explícita; desligar só pede o motivo. */
export function FormRecusaExcesso({ ligada }: { ligada: boolean }) {
  const idConfirmo = useId();
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoLink>(
    acaoDefinirParametroContato,
    validarInterruptorContato,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="chave" value="contato_recusar_excesso" />
      <input type="hidden" name="valor" value={ligada ? "0" : "1"} />
      {ligada ? null : (
        <div className="campo-marcar">
          <label htmlFor={idConfirmo}>
            <input
              id={idConfirmo}
              type="checkbox"
              name="confirmo"
              value="sim"
              aria-invalid={erros.confirmo ? true : undefined}
              aria-describedby={erros.confirmo ? `${idConfirmo}-erro` : undefined}
            />
            Confirmo que o Turnstile está no ar e quero ligar a recusa de excesso.
          </label>
          {erros.confirmo ? (
            <p id={`${idConfirmo}-erro`} className="erro-campo">
              {erros.confirmo}
            </p>
          ) : null}
        </div>
      )}
      <CampoTextoLongo
        nome="motivo"
        rotulo={ligada ? "Motivo para desligar" : "Motivo para ligar"}
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda={AJUDA_MOTIVO}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={ligada ? "Desligar recusa de excesso" : "Ligar recusa de excesso"}
        rotuloEnviando="Salvando..."
        perigo={!ligada}
      />
    </form>
  );
}
