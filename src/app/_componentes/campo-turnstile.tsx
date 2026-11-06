"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LIMITES } from "@/shared/config/limites";
import { CAMPO_TURNSTILE } from "@/shared/turnstile/campo";

type ApiTurnstile = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const ID_SCRIPT = "turnstile-api";
let carregando: Promise<void> | null = null;

/** Carrega o script oficial UMA vez, da URL exata da Cloudflare (a doc proíbe copiar ou cachear). */
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.id = ID_SCRIPT;
    s.src = `${LIMITES.turnstile.urlScript}?render=explicit`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      carregando = null;
      s.remove();
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

/**
 * Verificação de segurança (Turnstile da Cloudflare) dos formulários públicos (RSA-05, IM-076). Só coloca o token
 * num campo oculto do formulário; QUEM VALE é a verificação no servidor. O token é de uso único: a cada resposta
 * do servidor (`reiniciar` muda) o widget é reiniciado e o campo esvaziado.
 *
 * Acessível: o widget é nativo da Cloudflare (iframe com nome e foco por teclado), em grupo rotulado, com mensagens
 * em `role="alert"`/`status`, idioma pt-BR e tema automático. Sem chave do site: em desenvolvimento não mostra
 * nada (o servidor dispensa a verificação); em produção avisa que está indisponível (o servidor recusa o envio).
 */
export function CampoTurnstile({
  reiniciar,
  chaveDoSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined,
}: {
  /** Muda a cada resposta do servidor (ex.: o estado do formulário): reinicia o widget. */
  reiniciar?: unknown;
  chaveDoSite?: string;
}) {
  const rotuloId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const primeira = useRef(true);
  const [token, setToken] = useState("");
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!chaveDoSite) return;
    let cancelado = false;
    carregarScript()
      .then(() => {
        const el = caixa.current;
        if (cancelado || !el || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(el, {
          sitekey: chaveDoSite,
          language: "pt-br",
          theme: "auto",
          callback: (t: string) => {
            setToken(t);
            setFalhou(false);
          },
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setFalhou(true);
          },
        });
      })
      .catch(() => setFalhou(true));
    return () => {
      cancelado = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [chaveDoSite]);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    // Token já consumido pelo servidor (sucesso ou erro): pede outro.
    setToken("");
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [reiniciar]);

  if (!chaveDoSite) {
    if (process.env.NODE_ENV !== "production") return null;
    return (
      <p className="aviso aviso-atencao" role="status">
        A verificação de segurança está indisponível agora. Tente novamente mais tarde.
      </p>
    );
  }

  return (
    <div className="campo-turnstile" role="group" aria-labelledby={rotuloId}>
      <p id={rotuloId} className="ajuda">
        Verificação de segurança (confirme que você não é um robô)
      </p>
      <div ref={caixa} />
      <input type="hidden" name={CAMPO_TURNSTILE} value={token} readOnly />
      {falhou ? (
        <p className="aviso aviso-erro" role="alert">
          Não foi possível carregar a verificação de segurança. Recarregue a página e tente de novo.
        </p>
      ) : null}
      <noscript>
        <p className="aviso aviso-atencao">
          Ative o JavaScript para concluir a verificação de segurança.
        </p>
      </noscript>
    </div>
  );
}
