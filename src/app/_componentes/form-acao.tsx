"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL, type EstadoFormulario } from "../_lib/estado-formulario";
import { Aviso, BotaoEnviar } from "./ui";

type Acao = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;

/**
 * Botão de ação única (enviar, publicar, despublicar...). Trava durante o envio (IM-028) e mostra o
 * resultado. `campos` viram campos escondidos (id do perfil ou item).
 */
export function FormAcao({
  acao,
  campos,
  rotulo,
  rotuloEnviando = "Enviando...",
  secundario,
}: {
  acao: Acao;
  campos: Record<string, string>;
  rotulo: string;
  rotuloEnviando?: string;
  secundario?: boolean;
}) {
  const [estado, action, enviando] = useActionState(acao, ESTADO_INICIAL);
  return (
    <form action={action}>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <BotaoEnviar
        enviando={enviando}
        rotulo={rotulo}
        rotuloEnviando={rotuloEnviando}
        secundario={secundario}
      />
    </form>
  );
}
