"use client";

import { useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
import { ESTADO_INICIAL, type EstadoFormulario } from "../_lib/estado-formulario";

type Acao = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
type Validador = (dados: Record<string, string>) => Record<string, string> | null;

/**
 * Formulário com Server Action. Valida no navegador com o mesmo schema do servidor,
 * trava o botão durante o envio (IM-028) e foca o primeiro campo com erro.
 */
export function useFormulario(acao: Acao, validar: Validador) {
  const [estado, action, enviando] = useActionState(acao, ESTADO_INICIAL);
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});
  const [form, registrarForm] = useState<HTMLFormElement | null>(null);

  const erros = useMemo(
    () => (Object.keys(errosLocais).length > 0 ? errosLocais : (estado.erros ?? {})),
    [errosLocais, estado.erros],
  );
  const temErros = Object.keys(erros).length > 0;

  useEffect(() => {
    if (!temErros) return;
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [erros, temErros, form]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (enviando) {
      e.preventDefault();
      return;
    }
    const dados: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      if (typeof v === "string") dados[k] = v;
    });
    const falhas = validar(dados);
    if (falhas) {
      e.preventDefault();
      setErrosLocais(falhas);
    } else {
      setErrosLocais({});
    }
  }

  /** Callback ref: passe em <form ref={f.registrarForm}>. */
  return { estado, action, enviando, erros, registrarForm, aoEnviar };
}
