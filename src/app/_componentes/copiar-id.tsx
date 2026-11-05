"use client";

import { useRef, useState } from "react";

/**
 * Identificador curto (8 caracteres) com botão "Copiar id" que copia o identificador completo (IM-061 a IM-073).
 * Aviso de confirmação em região aria-live. Sem área de transferência (navegador antigo, página sem HTTPS ou
 * permissão negada), mostra o id completo num campo somente leitura, já selecionado, para copiar à mão.
 * O id de conta é visível só ao administrador (D-027); nenhum dado pessoal passa por aqui.
 */
export function CopiarId({ id }: { id: string }) {
  const [aviso, setAviso] = useState("");
  const [manual, setManual] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  async function copiar() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sem-clipboard");
      await navigator.clipboard.writeText(id);
      setManual(false);
      setAviso("Id copiado.");
    } catch {
      setManual(true);
      setAviso("Não foi possível copiar sozinho. Selecione o id abaixo e copie.");
      setTimeout(() => campo.current?.setSelectionRange(0, id.length), 0);
    }
  }

  return (
    <span className="copiar-id">
      <span title={id}>{`${id.slice(0, 8)}…`}</span>{" "}
      <button
        type="button"
        className="botao-texto"
        style={{ minHeight: 44, minWidth: 44 }}
        onClick={copiar}
        aria-label={`Copiar id ${id.slice(0, 8)}`}
      >
        Copiar id
      </button>
      <span role="status" aria-live="polite" className="ajuda">
        {aviso}
      </span>
      {manual ? (
        <input
          ref={campo}
          readOnly
          value={id}
          aria-label="Id completo para copiar"
          onFocus={(e) => e.currentTarget.setSelectionRange(0, id.length)}
          style={{ width: "100%", minHeight: 44 }}
        />
      ) : null}
    </span>
  );
}
