"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Barra de navegação da página do negócio (IM-092). Fica colada ao topo (sticky) logo abaixo do cabeçalho da
 * plataforma, que rola junto com a página: assim não há duas barras fixas disputando a tela.
 * - Âncoras para as seções (funcionam até sem JavaScript); rolagem suave só sem "reduzir movimento" (CSS).
 * - Destaca a seção atual (IntersectionObserver) com aria-current="location".
 * - Celular: botão "Menu" (aria-expanded/aria-controls), fecha ao escolher, com Esc e ao tocar fora; o foco volta ao botão.
 */
export type ItemMenuSite = { id: string; rotulo: string };

export function MenuSite({ nome, itens }: { nome: string; itens: ItemMenuSite[] }) {
  const idLista = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState<string>(itens[0]?.id ?? "");
  const botao = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLElement>(null);

  useEffect(() => {
    const secoes = itens
      .map((i) => document.getElementById(i.id))
      .filter((e): e is HTMLElement => e !== null);
    if (secoes.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visiveis = new Set<string>();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) visiveis.add(e.target.id);
          else visiveis.delete(e.target.id);
        }
        // A primeira seção (na ordem do menu) que cruza a faixa de leitura vence.
        const primeira = itens.find((i) => visiveis.has(i.id));
        if (primeira) setAtivo(primeira.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    secoes.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [itens]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    };
    const aoTocarFora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoTocarFora);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoTocarFora);
    };
  }, [aberto]);

  return (
    <nav className="st-menu" aria-label={`Seções de ${nome}`} ref={raiz}>
      <div className="st-menu-barra">
        <a className="st-menu-nome" href="#inicio">
          {nome}
        </a>
        <button
          ref={botao}
          type="button"
          className="st-menu-botao"
          aria-expanded={aberto}
          aria-controls={idLista}
          onClick={() => setAberto((a) => !a)}
        >
          <span className="st-menu-icone" aria-hidden="true" />
          Menu
        </button>
        <ul id={idLista} className={`st-menu-lista${aberto ? " st-menu-lista-aberta" : ""}`}>
          {itens.map((i) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={ativo === i.id ? "location" : undefined}
                onClick={() => {
                  setAtivo(i.id);
                  setAberto(false);
                }}
              >
                {i.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
