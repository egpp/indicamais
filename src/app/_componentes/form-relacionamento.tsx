"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  acaoAbrirAviso,
  acaoCurtirPerfil,
  acaoDescurtirPerfil,
  acaoMarcarAvisoLido,
  acaoMarcarTodosLidos,
  acaoSairDaBase,
} from "../acoes-relacionamento";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import type { EstadoRelacionamento } from "../_lib/estado-relacionamento";
import { EVENTO_AVISOS } from "./sino-avisos";
import { Aviso, BotaoEnviar } from "./ui";

/** Formulários da Fase 5. Botão travado durante o envio (IM-028); mensagens neutras vindas do servidor. */

function Mensagens({ estado }: { estado: EstadoRelacionamento }) {
  return (
    <>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
    </>
  );
}

/**
 * Curtir/Descurtir um perfil (IM-043). Visitante sem login vê só o convite a entrar. O texto nunca promete pontos,
 * benefício ou ganho (IM-042).
 */
export function CurtirPerfil({
  perfilId,
  logado,
  curtiu,
  retorno,
}: {
  perfilId: string;
  logado: boolean;
  curtiu: boolean;
  /** Caminho da página, para voltar depois de entrar. */
  retorno: string;
}) {
  const [estado, action, enviando] = useActionState<EstadoRelacionamento, FormData>(
    curtiu ? acaoDescurtirPerfil : acaoCurtirPerfil,
    ESTADO_INICIAL,
  );
  const idTitulo = `curtir-${perfilId}`;
  if (!logado) {
    return (
      <section className="secao-curtir" aria-labelledby={idTitulo}>
        <h2 id={idTitulo} className="titulo-curtir">
          Gostou deste perfil?
        </h2>
        <p className="ajuda">Entre na sua conta para curtir.</p>
        <p className="acoes-linha">
          <Link
            className="botao botao-secundario"
            href={`/entrar?proximo=${encodeURIComponent(retorno)}`}
          >
            Entrar para curtir
          </Link>
        </p>
      </section>
    );
  }
  return (
    <section className="secao-curtir" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="titulo-curtir">
        {curtiu ? "Você curtiu este perfil" : "Gostou deste perfil?"}
      </h2>
      <form action={action}>
        <Mensagens estado={estado} />
        <input type="hidden" name="perfilId" value={perfilId} />
        <BotaoEnviar
          enviando={enviando}
          rotulo={curtiu ? "Descurtir" : "Curtir"}
          rotuloEnviando={curtiu ? "Removendo..." : "Curtindo..."}
          secundario
        />
      </form>
      <p className="ajuda">
        O responsável vê só seu nome reduzido (por exemplo, Maria S.) e a data. Você pode descurtir
        quando quiser.
      </p>
    </section>
  );
}

/** Saída da base com confirmação do efeito (IM-045). */
export function SairDaBase({ perfilId, perfilNome }: { perfilId: string; perfilNome: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, action, enviando] = useActionState<EstadoRelacionamento, FormData>(
    acaoSairDaBase,
    ESTADO_INICIAL,
  );
  if (!aberto) {
    return (
      <button
        type="button"
        className="botao botao-secundario"
        onClick={() => setAberto(true)}
        aria-label={`Sair da base de ${perfilNome}`}
      >
        Sair da base
      </button>
    );
  }
  return (
    <form
      action={action}
      className="confirmacao-saida"
      aria-label={`Confirmar saída da base de ${perfilNome}`}
    >
      <Mensagens estado={estado} />
      <input type="hidden" name="perfilId" value={perfilId} />
      <p>
        <strong>Sair da base de {perfilNome}?</strong>
      </p>
      <ul>
        <li>Você deixa de aparecer na base de relacionamento da empresa.</li>
        <li>Você deixa de gerar avisos para ela.</li>
        <li>Fica apenas um histórico agregado e anônimo, sem seu nome.</li>
      </ul>
      <div className="acoes-linha">
        <BotaoEnviar
          enviando={enviando}
          rotulo="Confirmar saída"
          rotuloEnviando="Saindo..."
          perigo
        />
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => setAberto(false)}
          disabled={enviando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function useAvisarSino(estado: EstadoRelacionamento) {
  useEffect(() => {
    if (estado.sucesso) window.dispatchEvent(new Event(EVENTO_AVISOS));
  }, [estado.sucesso]);
}

export function MarcarTodosLidos() {
  const [estado, action, enviando] = useActionState<EstadoRelacionamento, FormData>(
    acaoMarcarTodosLidos,
    ESTADO_INICIAL,
  );
  useAvisarSino(estado);
  return (
    <form action={action}>
      <Mensagens estado={estado} />
      <BotaoEnviar
        enviando={enviando}
        rotulo="Marcar todos como lidos"
        rotuloEnviando="Marcando..."
        secundario
      />
    </form>
  );
}

/** Ações de um aviso: abrir o item relacionado (marca como lido) e marcar como lido. */
export function AcoesDoAviso({
  origem,
  origemId,
  lida,
  temDestino,
}: {
  origem: string;
  origemId: string;
  lida: boolean;
  temDestino: boolean;
}) {
  const [estado, action, enviando] = useActionState<EstadoRelacionamento, FormData>(
    acaoMarcarAvisoLido,
    ESTADO_INICIAL,
  );
  useAvisarSino(estado);
  return (
    <div className="acoes-linha acoes-linha-larga">
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {temDestino ? (
        <form action={acaoAbrirAviso}>
          <input type="hidden" name="origem" value={origem} />
          <input type="hidden" name="origemId" value={origemId} />
          <button type="submit" className="botao">
            Abrir
          </button>
        </form>
      ) : null}
      {!lida ? (
        <form action={action}>
          <input type="hidden" name="origem" value={origem} />
          <input type="hidden" name="origemId" value={origemId} />
          <BotaoEnviar
            enviando={enviando}
            rotulo="Marcar como lida"
            rotuloEnviando="Marcando..."
            secundario
          />
        </form>
      ) : null}
    </div>
  );
}
