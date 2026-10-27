"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { mascararTelefoneBR } from "@/shared/formatacao/telefone";

type PropsCampo = {
  nome: string;
  rotulo: string;
  tipo?: "text" | "email" | "password" | "tel";
  erro?: string;
  ajuda?: ReactNode;
  valorInicial?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  opcional?: boolean;
};

/** Campo com rótulo visível, erro anunciado e ajuda ligada por aria-describedby. */
export function Campo({
  nome,
  rotulo,
  tipo = "text",
  erro,
  ajuda,
  valorInicial,
  autoComplete,
  inputMode,
  opcional,
}: PropsCampo) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const descrito = [erro ? idErro : null, ajuda ? idAjuda : null].filter(Boolean).join(" ");
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {opcional ? <span className="opcional"> (opcional)</span> : null}
      </label>
      <input
        id={id}
        name={nome}
        type={tipo}
        defaultValue={valorInicial}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito || undefined}
        autoCapitalize={tipo === "email" ? "none" : undefined}
        spellCheck={tipo === "email" || tipo === "password" ? false : undefined}
      />
      {ajuda ? (
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** Senha com botão de mostrar/ocultar (toque de 44px). */
export function CampoSenha({
  nome,
  rotulo,
  erro,
  ajuda,
  autoComplete,
}: Pick<PropsCampo, "nome" | "rotulo" | "erro" | "ajuda" | "autoComplete">) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const [visivel, setVisivel] = useState(false);
  const descrito = [erro ? idErro : null, ajuda ? idAjuda : null].filter(Boolean).join(" ");
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="linha-senha">
        <input
          id={id}
          name={nome}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
        />
        <button
          type="button"
          className="botao-texto"
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {ajuda ? (
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** WhatsApp com máscara brasileira (11) 99999-0001. A normalização para +55 é do módulo contas. */
export function CampoWhatsapp({
  nome = "whatsapp",
  rotulo = "WhatsApp",
  valorInicial = "",
  erro,
  ajuda,
}: {
  nome?: string;
  rotulo?: string;
  valorInicial?: string;
  erro?: string;
  ajuda?: ReactNode;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const [valor, setValor] = useState(valorInicial);
  const descrito = [erro ? idErro : null, ajuda ? idAjuda : null].filter(Boolean).join(" ");
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        name={nome}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 99999-0001"
        value={valor}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setValor(mascararTelefoneBR(e.target.value))
        }
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito || undefined}
      />
      {ajuda ? (
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
