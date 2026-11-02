"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

/**
 * Banner de topo rotativo (IM-093, IM-092). Padrão de carrossel acessível (WAI-ARIA):
 * - região "carrossel" com slides "N de M"; só o slide atual é lido e recebe foco (`inert` nos outros);
 * - setas, indicadores e botão Pausar/Retomar, todos com alvo de toque de 44px;
 * - rotação automática SUAVE: a cada 8 s, para sozinha depois de uma volta completa, para ao passar o mouse ou focar
 *   dentro, e nunca começa com "reduzir movimento" ligado (prefers-reduced-motion);
 * - proporção fixa (sem salto de layout); a primeira imagem carrega com prioridade, as demais sob demanda.
 */
export type ImagemBanner = {
  src: string;
  alt: string;
  /** Âncora de uma seção da própria página (ex.: "#sobre"). Nunca link externo (IM-012). */
  href?: string;
};

function Figura({ img, prioridade }: { img: ImagemBanner; prioridade: boolean }) {
  const imagem = (
    <img
      src={img.src}
      alt={img.alt}
      className="st-banner-img"
      loading={prioridade ? "eager" : "lazy"}
      fetchPriority={prioridade ? "high" : "auto"}
      decoding="async"
    />
  );
  return img.href ? (
    <a className="st-banner-link" href={img.href}>
      {imagem}
    </a>
  ) : (
    imagem
  );
}

const INTERVALO_MS = 8000;
const CONSULTA = "(prefers-reduced-motion: reduce)";

const semSuporte = () => typeof window.matchMedia !== "function";
const assinarMovimento = (cb: () => void) => {
  if (semSuporte()) return () => {};
  const m = window.matchMedia(CONSULTA);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const reduzirMovimento = () => semSuporte() || window.matchMedia(CONSULTA).matches;
/** No servidor assume "reduzir": a rotação só começa depois de hidratar e conferir a preferência. */
const reduzirNoServidor = () => true;

export function CarrosselBanner({ imagens, rotulo }: { imagens: ImagemBanner[]; rotulo: string }) {
  const idRegiao = useId();
  const total = imagens.length;
  const [atual, setAtual] = useState(0);
  const [pausadoPelaPessoa, setPausadoPelaPessoa] = useState(false);
  const [suspenso, setSuspenso] = useState(false);
  const [voltas, setVoltas] = useState(0);
  const reduzido = useSyncExternalStore(assinarMovimento, reduzirMovimento, reduzirNoServidor);

  const rodando = total > 1 && !reduzido && !pausadoPelaPessoa && voltas < 1;
  const andando = rodando && !suspenso;

  const ir = useCallback(
    (i: number) => {
      setAtual(((i % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (!andando) return;
    const t = setTimeout(() => {
      setAtual((a) => {
        const prox = (a + 1) % total;
        if (prox === 0) setVoltas((v) => v + 1);
        return prox;
      });
    }, INTERVALO_MS);
    return () => clearTimeout(t);
  }, [andando, atual, total]);

  if (total === 0) return null;

  if (total === 1) {
    return (
      <div className="st-banner" role="region" aria-label={rotulo}>
        <div className="st-banner-quadro">
          <Figura img={imagens[0]} prioridade />
        </div>
      </div>
    );
  }

  const pausado = !rodando;
  return (
    <div
      className="st-banner"
      role="region"
      aria-roledescription="carrossel"
      aria-label={rotulo}
      id={idRegiao}
      onMouseEnter={() => setSuspenso(true)}
      onMouseLeave={() => setSuspenso(false)}
      onFocus={() => setSuspenso(true)}
      onBlur={() => setSuspenso(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") ir(atual - 1);
        else if (e.key === "ArrowRight") ir(atual + 1);
      }}
    >
      <div className="st-banner-quadro" aria-live={pausado ? "polite" : "off"} aria-atomic="false">
        {imagens.map((img, i) => (
          <div
            key={img.src}
            className={`st-slide${i === atual ? " st-slide-ativo" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            aria-hidden={i === atual ? undefined : true}
            inert={i === atual ? undefined : true}
          >
            <Figura img={img} prioridade={i === 0} />
          </div>
        ))}
      </div>
      <div className="st-banner-controles">
        <button
          type="button"
          className="st-ctl"
          aria-label="Banner anterior"
          onClick={() => ir(atual - 1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        {reduzido ? null : (
          <button
            type="button"
            className="st-ctl"
            aria-label={pausado ? "Retomar rotação do banner" : "Pausar rotação do banner"}
            onClick={() => {
              if (pausado) {
                setVoltas(0);
                setPausadoPelaPessoa(false);
              } else setPausadoPelaPessoa(true);
            }}
          >
            <span aria-hidden="true">{pausado ? "▶" : "❚❚"}</span>
          </button>
        )}
        <span className="st-contador" aria-hidden="true">
          {atual + 1}/{total}
        </span>
        <ul className="st-pontos">
          {imagens.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                className="st-ponto"
                aria-label={`Ir para o banner ${i + 1} de ${total}`}
                aria-current={i === atual ? "true" : undefined}
                onClick={() => ir(i)}
              >
                <span aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="st-ctl"
          aria-label="Próximo banner"
          onClick={() => ir(atual + 1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
