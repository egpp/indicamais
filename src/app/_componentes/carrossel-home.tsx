"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CARDS_POR_LINHA_LARGA, CARDS_POR_LINHA_MEDIA } from "../_lib/home-layout";

/**
 * Carrossel de uma seção da home (IM-095, D-018). Cuida só da rolagem; os cards chegam prontos do servidor.
 * Acessível: região nomeada pelo título, botões Anterior/Próximo com rótulo, setas do teclado na região (que recebe
 * foco), rolagem horizontal com snap, sem rotação automática e sem animação com "reduzir movimento" (prefers-reduced-motion).
 */
export function CarrosselHome({ titulo, children }: { titulo: string; children: ReactNode }) {
  const idTitulo = useId();
  const faixa = useRef<HTMLDivElement>(null);
  const [anterior, setAnterior] = useState(false);
  const [proximo, setProximo] = useState(true);

  const atualizar = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    setAnterior(el.scrollLeft > 4);
    setProximo(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    atualizar();
    const el = faixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(atualizar);
    obs.observe(el);
    return () => obs.disconnect();
  }, [atualizar]);

  function rolar(sentido: 1 | -1) {
    const el = faixa.current;
    if (!el) return;
    const reduzir =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sentido * el.clientWidth * 0.9, behavior: reduzir ? "auto" : "smooth" });
  }

  return (
    <div className="secao-home">
      <div className="secao-home-topo">
        <h2 id={idTitulo}>{titulo}</h2>
        <div className="secao-home-botoes">
          <button
            type="button"
            className="botao-carrossel"
            aria-label={`${titulo}: ver anteriores`}
            aria-disabled={!anterior}
            onClick={() => anterior && rolar(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="botao-carrossel"
            aria-label={`${titulo}: ver próximos`}
            aria-disabled={!proximo}
            onClick={() => proximo && rolar(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div
        ref={faixa}
        className="carrossel-home"
        role="region"
        aria-roledescription="carrossel"
        aria-label={titulo}
        tabIndex={0}
        onScroll={atualizar}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            rolar(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            rolar(-1);
          }
        }}
        style={
          {
            "--cards-larga": CARDS_POR_LINHA_LARGA,
            "--cards-media": CARDS_POR_LINHA_MEDIA,
          } as React.CSSProperties
        }
      >
        <ul>{children}</ul>
      </div>
    </div>
  );
}
