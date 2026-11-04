import type { ReactNode } from "react";
import type { EstiloId } from "./estilos";

/**
 * Ícones e decorações da página do negócio (D-016). Tudo em SVG local, decorativo (aria-hidden): o sentido
 * está sempre no texto ao lado. Sem imagens de terceiros e sem fotos de pessoas.
 */
export type NomeIcone =
  "sobre" | "produtos" | "beneficios" | "local" | "contato" | "categoria" | "areas" | "check";

const CAMINHOS: Record<NomeIcone, ReactNode> = {
  sobre: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
    </>
  ),
  produtos: (
    <>
      <path d="M6 8h12l1 12H5L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  beneficios: (
    <>
      <path d="M4 11h16v9H4z" />
      <path d="M3 7h18v4H3z" />
      <path d="M12 7v13" />
      <path d="M12 7c-1.5-3.5-5.5-3-4.5 0M12 7c1.5-3.5 5.5-3 4.5 0" />
    </>
  ),
  local: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  contato: <path d="M4 5h16v11H9.5L4 20.5V5z" />,
  categoria: (
    <>
      <path d="M3 12l9-9h8v8l-9 9-8-8z" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" />
    </>
  ),
  areas: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg
      className="st-svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}

/** Formas decorativas do fundo do banner quando não há imagem: nunca uma caixa vazia. */
export function Decoracao({ estilo }: { estilo: EstiloId }) {
  return (
    <svg
      className="st-decor"
      viewBox="0 0 800 480"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {FORMAS[estilo] ?? FORMAS.minimalista}
    </svg>
  );
}

const FORMAS: Partial<Record<EstiloId, ReactNode>> = {
  minimalista: (
    <g fill="none" stroke="#111111" strokeOpacity="0.16" strokeWidth="1.5">
      <circle cx="610" cy="250" r="210" />
      <circle cx="610" cy="250" r="150" />
      <circle cx="610" cy="250" r="90" />
      <path d="M0 440h800" />
      <path d="M400 0v480" strokeDasharray="2 10" />
    </g>
  ),
  gastronomia: (
    <g fill="none" stroke="#c8963e" strokeWidth="2">
      <circle cx="620" cy="240" r="220" strokeOpacity="0.5" />
      <circle cx="620" cy="240" r="180" strokeOpacity="0.35" />
      <circle cx="620" cy="240" r="130" strokeOpacity="0.6" strokeDasharray="4 10" />
      <circle cx="620" cy="240" r="70" strokeOpacity="0.45" />
      <path d="M620 150l14 14-14 14-14-14z" fill="#c8963e" fillOpacity="0.5" stroke="none" />
      <path d="M0 420h800" strokeOpacity="0.35" />
    </g>
  ),
  saude_bem_estar: (
    <g stroke="none">
      <circle cx="640" cy="170" r="190" fill="#ffffff" fillOpacity="0.07" />
      <circle cx="560" cy="380" r="120" fill="#ffffff" fillOpacity="0.07" />
      <circle cx="730" cy="400" r="70" fill="#9ed2e6" fillOpacity="0.25" />
      <path
        d="M600 330c0-90 70-150 150-150 0 90-60 150-150 150z"
        fill="#9ed2e6"
        fillOpacity="0.28"
      />
      <path d="M600 330c40-40 80-80 150-150" fill="none" stroke="#ffffff" strokeOpacity="0.4" />
    </g>
  ),
  beleza_estetica: (
    <g fill="none" stroke="#e0b865" strokeWidth="1.5">
      <path d="M520 480V250a110 110 0 0 1 220 0v230" strokeOpacity="0.7" />
      <path d="M552 480V252a78 78 0 0 1 156 0v228" strokeOpacity="0.5" />
      <path d="M584 480V254a46 46 0 0 1 92 0v226" strokeOpacity="0.4" />
      <circle cx="350" cy="110" r="28" strokeOpacity="0.5" />
      <circle cx="350" cy="110" r="46" strokeOpacity="0.25" />
    </g>
  ),
  construcao_reformas: (
    <g stroke="none">
      <path d="M520 480l140-300h140v300z" fill="#f5b800" fillOpacity="0.9" />
      <path d="M470 480l140-300h40l-140 300z" fill="#f5b800" fillOpacity="0.45" />
      <path d="M0 450h800v30H0z" fill="#f5b800" fillOpacity="0.9" />
      <rect x="610" y="250" width="110" height="14" fill="#1c2025" />
      <rect x="610" y="290" width="110" height="14" fill="#1c2025" />
      <rect x="610" y="330" width="110" height="14" fill="#1c2025" />
    </g>
  ),
  cafe_padaria: aneis("#1d3f94"),
  automotivo: listras("#ff5a1f"),
  juridico_contabil: arcos("#e0aa6f"),
  educacao_cursos: aneis("#4c1d95"),
  pet: aneis("#f4896b"),
  moda_lojas: arcos("#1d3dd6"),
  fitness_esportes: listras("#d4ff1f"),
  imobiliario: arcos("#e8c9a0"),
  tecnologia_assistencia: aneis("#ffffff"),
  casa_decoracao: arcos("#9a3f25"),
  eventos_fotografia: aneis("#6a3fa0"),
  servicos_rapidos: listras("#ff8a2a"),
  agro_campo: arcos("#e8c98a"),
  turismo_hospedagem: aneis("#f1e3c8"),
  premium: arcos("#d9a566"),
  moto_bike: listras("#c8102e"),
};

/** Formas simples (uma cor) para os estilos novos: círculos concêntricos, listras diagonais e arcos. */
function aneis(cor: string): ReactNode {
  return (
    <g fill="none" stroke={cor} strokeWidth="2">
      <circle cx="620" cy="240" r="200" strokeOpacity="0.35" />
      <circle cx="620" cy="240" r="140" strokeOpacity="0.45" />
      <circle cx="620" cy="240" r="80" strokeOpacity="0.55" />
    </g>
  );
}
function listras(cor: string): ReactNode {
  return (
    <g stroke="none" fill={cor} fillOpacity="0.85">
      <path d="M520 480 640 120h60L580 480z" />
      <path d="M620 480 740 120h30L650 480z" fillOpacity="0.5" />
    </g>
  );
}
function arcos(cor: string): ReactNode {
  return (
    <g fill="none" stroke={cor} strokeWidth="1.5">
      <path d="M520 480V250a110 110 0 0 1 220 0v230" strokeOpacity="0.7" />
      <path d="M560 480V252a70 70 0 0 1 140 0v228" strokeOpacity="0.5" />
    </g>
  );
}

/** Faixa decorativa fina entre o banner e o conteúdo (estilos que a usam). */
export function FaixaDecorativa() {
  return <div className="st-faixa-deco" aria-hidden="true" />;
}
