"use client";

import { useId, useState } from "react";
import { acaoDescartarNotificacoes } from "../acoes-indicacoes";
import type { EstadoLink } from "../_lib/estado-indicacoes";
import { validarDescarteNotificacoes } from "../_lib/validacao-indicacoes";
import { CampoTextoLongo } from "./campos-conteudo";
import { SeloEstado } from "./painel";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

export type ItemDescarte = {
  id: string;
  /** Data já formatada em pt-BR, fuso America/Sao_Paulo. */
  criadoEmTexto: string;
  estado: "pendente" | "falhou";
  tentativas: number;
  destinoNome: string;
};

const ROTULO_ESTADO = { pendente: "Pendente", falhou: "Falhou" } as const;
const AJUDA_MOTIVO = "De 10 a 500 caracteres. Fica registrado na auditoria.";

/**
 * Descarte em lote (IM-103, IM-027, IM-028): escolha as notificações pendentes ou com falha, informe o motivo e confirme.
 * Mostra só o destino, a data, o estado e as tentativas; nada do visitante. A regra final é do servidor e do banco.
 */
export function FormDescartarNotificacoes({ itens }: { itens: ItemDescarte[] }) {
  const idConfirmo = useId();
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoLink>(
    acaoDescartarNotificacoes,
    validarDescarteNotificacoes,
  );
  // Só vale o que ainda está na lista: depois do descarte e da atualização da tela, as escolhas somem sozinhas.
  const presentes = new Set(itens.map((i) => i.id));
  const efetivos = [...marcados].filter((id) => presentes.has(id));
  const todos = itens.length > 0 && efetivos.length === itens.length;

  function alternar(id: string, ligado: boolean) {
    const novo = new Set(marcados);
    if (ligado) novo.add(id);
    else novo.delete(id);
    setMarcados(novo);
  }

  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}

      <fieldset className="campo">
        <legend>Notificações a descartar</legend>
        <div className="campo-marcar">
          <label>
            <input
              type="checkbox"
              checked={todos}
              onChange={(e) => setMarcados(new Set(e.target.checked ? itens.map((i) => i.id) : []))}
            />
            Selecionar todas desta página
          </label>
        </div>
        <ul className="lista-cartoes">
          {itens.map((i) => (
            <li key={i.id} className="cartao">
              <label>
                <input
                  type="checkbox"
                  name="pedidoIds"
                  value={i.id}
                  checked={marcados.has(i.id)}
                  onChange={(e) => alternar(i.id, e.target.checked)}
                  aria-invalid={erros.pedidoIds ? true : undefined}
                />{" "}
                <strong>{i.destinoNome || "Destino sem nome"}</strong>
                <span className="sr-only"> criada em {i.criadoEmTexto}</span>
              </label>
              <p>
                <SeloEstado rotulo={ROTULO_ESTADO[i.estado]} />
              </p>
              <dl className="lista-dados">
                <dt>Criada em</dt>
                <dd>{i.criadoEmTexto}</dd>
                <dt>Tentativas</dt>
                <dd>{i.tentativas}</dd>
                <dt>Pedido</dt>
                <dd>{i.id.slice(0, 8)}</dd>
              </dl>
            </li>
          ))}
        </ul>
        {erros.pedidoIds ? (
          <p className="erro-campo" role="alert">
            {erros.pedidoIds}
          </p>
        ) : null}
        <p className="ajuda" aria-live="polite">
          {efetivos.length === 1
            ? "1 notificação selecionada."
            : `${efetivos.length} notificações selecionadas.`}
        </p>
      </fieldset>

      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo do descarte"
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda={AJUDA_MOTIVO}
      />
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
          Confirmo que quero descartar as notificações selecionadas. Elas não voltam à fila.
        </label>
        {erros.confirmo ? (
          <p id={`${idConfirmo}-erro`} className="erro-campo">
            {erros.confirmo}
          </p>
        ) : null}
      </div>
      <BotaoEnviar
        enviando={enviando}
        rotulo="Descartar selecionadas"
        rotuloEnviando="Descartando..."
        perigo
      />
    </form>
  );
}
