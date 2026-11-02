"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Permissao } from "@/modules/administracao";
import { sair } from "../acoes-conta";
import { LogoMarca } from "./marca";
import {
  HREF_POR_ATUAL,
  grupoDoHref,
  gruposDoMenu,
  hrefAtivo,
  type AtualMenu,
  type GrupoMenu,
} from "./menu-painel-dados";
import { SinoAvisos } from "./sino-avisos";
import { VerComoVisitante } from "./ver-como-visitante";

/**
 * Menu lateral do painel, com grupos que abrem em cascata (D-015; IM-005, IM-014, IM-047).
 * Desktop: barra fixa à esquerda. Celular: gaveta aberta pelo botão de menu; fecha ao navegar, ao tocar fora e com
 * Esc, e o foco volta para o botão. O sino fica sempre no cabeçalho. Os grupos usam <details>, que funcionam
 * também por teclado (Tab, Enter, Espaço) e aqui ganham setas, Home e End.
 */

type Acesso = { geral: boolean; permissoes: readonly Permissao[] };

const SEM_ASSINATURA = () => () => {};
const caminhoDoNavegador = () => window.location.pathname;
const caminhoNoServidor = () => null;

/** Elementos que recebem foco e estão visíveis (itens de grupos fechados ficam de fora). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>("summary, a[href], button:not([disabled])"),
  ).filter((el) => {
    if (getComputedStyle(el).display === "none") return false;
    const pai = el.parentElement?.closest("details");
    if (!pai) return true;
    if (pai.open) return true;
    return el.tagName === "SUMMARY" && el.parentElement === pai;
  });
}

function BotaoSair({ className }: { className: string }) {
  return (
    <form action={sair}>
      <button type="submit" className={className}>
        Sair
      </button>
    </form>
  );
}

export function MenuPainel({
  atual,
  admin,
  buscarAcesso = true,
  acessoInicial,
  identificacao,
  children,
}: {
  atual?: AtualMenu;
  /** Dica do servidor: a pessoa é administradora geral. As permissões individuais chegam depois, pelo navegador. */
  admin?: boolean;
  /** Desligado nos testes dos componentes. */
  buscarAcesso?: boolean;
  acessoInicial?: Acesso;
  /** Bloco com nome e e-mail da própria conta (montado no servidor), abaixo do logotipo do menu. */
  identificacao?: ReactNode;
  /** Conteúdo da página, ao lado do menu. */
  children: ReactNode;
}) {
  const idMenu = useId();
  const [aberto, setAberto] = useState(false);
  const [acesso, setAcesso] = useState<Acesso>(
    acessoInicial ?? { geral: admin === true, permissoes: [] },
  );
  const caminho = useSyncExternalStore(SEM_ASSINATURA, caminhoDoNavegador, caminhoNoServidor);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);

  const grupos = gruposDoMenu(acesso);
  const ativo =
    (caminho ? hrefAtivo(caminho, grupos) : null) ?? (atual ? HREF_POR_ATUAL[atual] : null);
  const grupoAtivo =
    grupoDoHref(ativo, grupos) ??
    (atual === "administracao" || caminho?.startsWith("/administracao") ? "administracao" : null);

  // O grupo da rota atual abre sozinho; o que a pessoa abrir ou fechar depois fica como ela deixou.
  const [manual, setManual] = useState<Partial<Record<GrupoMenu["id"], boolean>>>({});
  const estaAberto = (id: GrupoMenu["id"]) => manual[id] ?? id === grupoAtivo;

  useEffect(() => {
    if (!buscarAcesso) return;
    let vivo = true;
    fetch("/painel/acesso", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { logado?: boolean; geral?: boolean; permissoes?: Permissao[] } | null) => {
        if (vivo && j?.logado)
          setAcesso({ geral: j.geral === true, permissoes: j.permissoes ?? [] });
      })
      .catch(() => {
        // Sem resposta: fica o que o servidor já mostrou.
      });
    return () => {
      vivo = false;
    };
  }, [buscarAcesso]);

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botaoMenu.current?.focus();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    botaoFechar.current?.focus();
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") fechar(true);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);

  function aoTeclarNoMenu(e: KeyboardEvent<HTMLElement>) {
    const raiz = lateral.current;
    if (!raiz) return;
    const lista = focaveis(raiz);
    const i = lista.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Tab" && aberto) {
      const emTelaGrande =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(min-width: 56.25rem)").matches;
      if (emTelaGrande || lista.length === 0) return;
      const ultimo = lista.length - 1;
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        lista[ultimo]?.focus();
      } else if (!e.shiftKey && i === ultimo) {
        e.preventDefault();
        lista[0]?.focus();
      }
      return;
    }
    const alvo =
      e.key === "ArrowDown"
        ? lista[Math.min(i + 1, lista.length - 1)]
        : e.key === "ArrowUp"
          ? lista[Math.max(i - 1, 0)]
          : e.key === "Home"
            ? lista[0]
            : e.key === "End"
              ? lista[lista.length - 1]
              : null;
    if (alvo && i >= 0) {
      e.preventDefault();
      alvo.focus();
    }
  }

  return (
    <div className="painel">
      <header className="painel-topo">
        <button
          ref={botaoMenu}
          type="button"
          className="painel-botao-menu"
          aria-label="Abrir menu"
          aria-expanded={aberto}
          aria-controls={idMenu}
          onClick={() => setAberto(true)}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="painel-topo-marca">
          <LogoMarca />
        </div>
        <div className="painel-topo-acoes">
          <VerComoVisitante />
          <SinoAvisos />
          <div className="painel-topo-sair">
            <BotaoSair className="botao-texto painel-sair" />
          </div>
        </div>
      </header>

      {aberto ? (
        <div className="painel-fundo" aria-hidden="true" onClick={() => fechar(true)} />
      ) : null}

      <aside
        id={idMenu}
        ref={lateral}
        className="painel-lateral"
        data-aberto={aberto ? "true" : "false"}
        onKeyDown={aoTeclarNoMenu}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) fechar(false);
        }}
      >
        <div className="painel-lateral-topo">
          <LogoMarca />
          <button
            ref={botaoFechar}
            type="button"
            className="painel-botao-fechar"
            aria-label="Fechar menu"
            onClick={() => fechar(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {identificacao}
        <nav aria-label="Principal">
          {grupos.map((g) => (
            <details
              key={g.id}
              className="menu-grupo"
              open={estaAberto(g.id)}
              onToggle={(e) => {
                const aberto = e.currentTarget.open;
                setManual((m) => (m[g.id] === aberto ? m : { ...m, [g.id]: aberto }));
              }}
            >
              <summary>{g.titulo}</summary>
              <ul>
                {g.itens.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={i.href === ativo ? "page" : undefined}>
                      {i.texto}
                    </Link>
                  </li>
                ))}
                {g.id === "conta" ? (
                  <li>
                    <BotaoSair className="menu-sair" />
                  </li>
                ) : null}
              </ul>
            </details>
          ))}
        </nav>
      </aside>

      {children}
    </div>
  );
}
