"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Sino de avisos (IM-047, IM-052). Aparece só para quem está logado. O contador vem de /avisos/contador (só um
 * número, sem conteúdo) e é relido ao abrir cada tela (o cabeçalho é montado de novo), ao voltar para a aba e quando uma ação de leitura avisa.
 * Acessível: link com rótulo que diz a quantidade, foco visível, alvo de 44px e anúncio por leitor de tela.
 */
export const EVENTO_AVISOS = "indicamais:avisos-atualizados";

type Estado = { logado: boolean; naoLidas: number } | null;

function useContador(): Estado {
  const [estado, setEstado] = useState<Estado>(null);
  useEffect(() => {
    let ativo = true;
    async function ler() {
      try {
        const r = await fetch("/avisos/contador", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { logado?: boolean; naoLidas?: number };
        if (ativo) setEstado({ logado: j.logado === true, naoLidas: Math.max(0, j.naoLidas ?? 0) });
      } catch {
        // Sem rede ou sem resposta: o sino simplesmente não aparece/atualiza.
      }
    }
    void ler();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void ler();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_AVISOS, ler);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_AVISOS, ler);
    };
  }, []);
  return estado;
}

const rotulo = (n: number) =>
  n === 0
    ? "Avisos, nenhum aviso novo"
    : n === 1
      ? "Avisos, 1 aviso não lido"
      : `Avisos, ${n} avisos não lidos`;

function Sino({ naoLidas }: { naoLidas: number }) {
  return (
    <>
      <Link className="sino" href="/avisos" aria-label={rotulo(naoLidas)}>
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {naoLidas > 0 ? (
          <span className="sino-contador" aria-hidden="true">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        ) : null}
      </Link>
      <span className="so-leitor" role="status">
        {naoLidas > 0 ? rotulo(naoLidas) : ""}
      </span>
    </>
  );
}

/** Sino do cabeçalho das telas logadas. Não renderiza nada até saber que há login. */
export function SinoAvisos() {
  const estado = useContador();
  if (!estado?.logado) return null;
  return <Sino naoLidas={estado.naoLidas} />;
}

/**
 * Links de conta do cabeçalho público: "Entrar" e "Criar conta" para visitantes (renderizados no servidor, sem
 * piscar); para quem está logado, sino e "Minha conta".
 */
export function LinksConta() {
  const estado = useContador();
  if (estado?.logado) {
    return (
      <ul>
        <li>
          <Sino naoLidas={estado.naoLidas} />
        </li>
        <li>
          <Link href="/minha-conta">Minha conta</Link>
        </li>
      </ul>
    );
  }
  return (
    <ul>
      <li>
        <Link href="/entrar">Entrar</Link>
      </li>
      <li>
        <Link href="/cadastro">Criar conta</Link>
      </li>
    </ul>
  );
}
