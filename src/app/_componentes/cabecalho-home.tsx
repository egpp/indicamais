"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconeHome, iconeDaCategoria } from "./icones-home";
import { AcoesContaHome } from "./sino-avisos";

/**
 * Cabeçalho da página inicial: logotipo, menu (Início, Categorias com lista, Como funciona, Indique e Ganhe, Ajuda),
 * sino e "Minha conta". Celular: o menu vira gaveta aberta pelo botão de menu. Teclado: Esc fecha a gaveta e a lista
 * de categorias; o foco volta ao botão que abriu. A lista de categorias é a das categorias ativas (só leitura).
 */
export type CategoriaMenu = { id: string; nome: string; slug: string };

export function CabecalhoHome({
  categorias,
  atual = "inicio",
}: {
  categorias: readonly CategoriaMenu[];
  atual?: "inicio" | "como-funciona" | "indique" | "ajuda" | "categorias" | null;
}) {
  const idMenu = useId();
  const idCategorias = useId();
  const [gaveta, setGaveta] = useState(false);
  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const botaoCategorias = useRef<HTMLButtonElement>(null);
  const caixaCategorias = useRef<HTMLLIElement>(null);

  const fechar = useCallback((devolverFoco: boolean) => {
    setCategoriasAbertas((aberta) => {
      if (aberta && devolverFoco) botaoCategorias.current?.focus();
      return false;
    });
    setGaveta((aberta) => {
      if (aberta && devolverFoco) botaoMenu.current?.focus();
      return false;
    });
  }, []);

  useEffect(() => {
    if (!gaveta && !categoriasAbertas) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar(true);
    };
    const aoClicar = (e: MouseEvent) => {
      if (!categoriasAbertas) return;
      if (caixaCategorias.current && !caixaCategorias.current.contains(e.target as Node)) {
        setCategoriasAbertas(false);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicar);
    };
  }, [gaveta, categoriasAbertas, fechar]);

  const aoNavegar = () => fechar(false);
  const atualDe = (id: string) => (atual === id ? ("page" as const) : undefined);

  return (
    <header className="home-topo">
      <a className="pular-conteudo" href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <div className="home-topo-faixa">
        <Link className="home-logo" href="/" aria-label="IndicaMais, página inicial">
          <Image src="/marca/logo-claro.png" alt="" width={560} height={94} priority unoptimized />
        </Link>

        <nav
          id={idMenu}
          className="home-menu"
          aria-label="Principal"
          data-aberto={gaveta ? "true" : "false"}
        >
          <ul>
            <li>
              <Link href="/" aria-current={atualDe("inicio")} onClick={aoNavegar}>
                Início
              </Link>
            </li>
            <li ref={caixaCategorias} className="home-menu-categorias">
              <button
                ref={botaoCategorias}
                type="button"
                aria-expanded={categoriasAbertas}
                aria-controls={idCategorias}
                onClick={() => setCategoriasAbertas((v) => !v)}
              >
                Categorias
                <IconeHome nome="seta-baixo" tamanho={16} className="home-menu-seta" />
              </button>
              <ul id={idCategorias} hidden={!categoriasAbertas} className="home-submenu">
                {categorias.map((c) => (
                  <li key={c.id}>
                    <Link href={`/?categoriaId=${encodeURIComponent(c.id)}`} onClick={aoNavegar}>
                      <IconeHome nome={iconeDaCategoria(c.slug, c.nome)} tamanho={18} />
                      {c.nome}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/categorias" onClick={aoNavegar} className="home-submenu-todas">
                    Ver todas as categorias
                  </Link>
                </li>
              </ul>
            </li>
            <li>
              <Link
                href="/como-funciona"
                aria-current={atualDe("como-funciona")}
                onClick={aoNavegar}
              >
                Como funciona
              </Link>
            </li>
            <li>
              <Link href="/indique-e-ganhe" aria-current={atualDe("indique")} onClick={aoNavegar}>
                Indique e Ganhe
              </Link>
            </li>
            <li>
              <Link href="/ajuda" aria-current={atualDe("ajuda")} onClick={aoNavegar}>
                Ajuda
              </Link>
            </li>
          </ul>
        </nav>

        <div className="home-topo-acoes">
          <AcoesContaHome />
          <button
            ref={botaoMenu}
            type="button"
            className="home-botao-menu"
            aria-expanded={gaveta}
            aria-controls={idMenu}
            aria-label={gaveta ? "Fechar menu" : "Abrir menu"}
            onClick={() => setGaveta((v) => !v)}
          >
            <IconeHome nome={gaveta ? "fechar" : "menu"} />
          </button>
        </div>
      </div>
      {gaveta ? (
        <button
          type="button"
          className="home-fundo-gaveta"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => fechar(true)}
        />
      ) : null}
    </header>
  );
}
