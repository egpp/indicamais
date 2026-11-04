import localFont from "next/font/local";
import type { EstiloId } from "./estilos";

/**
 * Fontes gratuitas dos temas (D-016, OFL), hospedadas no próprio projeto em src/app/fonts (woff2, subconjunto
 * latin, que cobre os acentos do português). Sem pedido de rede no build nem no navegador a terceiros.
 * Licenças em public/fonts/LICENSES. Todas, menos a do estilo padrão, usam `preload: false`: o navegador só baixa
 * a fonte quando o tema que a usa está na tela.
 * As variáveis --f-* são aplicadas pela classe do estilo (ver `classeDeFontes`) e lidas em site.css.
 */
// O carregador do Next exige opções literais (sem espalhar objeto).
const inter = localFont({
  src: "../../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--f-inter",
});
const nunito = localFont({
  src: "../../fonts/nunito-latin-wght-normal.woff2",
  weight: "200 1000",
  display: "swap",
  variable: "--f-nunito",
  preload: false,
});
const jost = localFont({
  src: "../../fonts/jost-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--f-jost",
  preload: false,
});
const cormorant = localFont({
  src: [
    { path: "../../fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500" },
    { path: "../../fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600" },
    { path: "../../fonts/cormorant-garamond-latin-700-normal.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--f-cormorant",
  preload: false,
});
const playfair = localFont({
  src: "../../fonts/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  display: "swap",
  variable: "--f-playfair",
  preload: false,
});
const lato = localFont({
  src: [
    { path: "../../fonts/lato-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/lato-latin-700-normal.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--f-lato",
  preload: false,
});
const barlow = localFont({
  src: [
    { path: "../../fonts/barlow-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/barlow-latin-500-normal.woff2", weight: "500" },
    { path: "../../fonts/barlow-latin-600-normal.woff2", weight: "600" },
  ],
  display: "swap",
  variable: "--f-barlow",
  preload: false,
});
const barlowCondensed = localFont({
  src: [
    { path: "../../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
    { path: "../../fonts/barlow-condensed-latin-800-normal.woff2", weight: "800" },
  ],
  display: "swap",
  variable: "--f-barlow-cond",
  preload: false,
});

const jakarta = localFont({
  src: "../../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--f-jakarta",
  preload: false,
});

/** Classes (variáveis de fonte) a aplicar ao redor da página, por estilo. Estilos sem fonte própria usam a do padrão. */
const FONTES: Partial<Record<EstiloId, string>> = {
  minimalista: inter.variable,
  saude_bem_estar: nunito.variable,
  beleza_estetica: `${cormorant.variable} ${jost.variable}`,
  gastronomia: `${playfair.variable} ${lato.variable}`,
  construcao_reformas: `${barlowCondensed.variable} ${barlow.variable}`,
  cafe_padaria: nunito.variable,
  automotivo: `${barlowCondensed.variable} ${barlow.variable}`,
  juridico_contabil: `${playfair.variable} ${inter.variable}`,
  educacao_cursos: jakarta.variable,
  pet: nunito.variable,
  moda_lojas: `${playfair.variable} ${inter.variable}`,
  fitness_esportes: `${barlowCondensed.variable} ${barlow.variable}`,
  imobiliario: `${playfair.variable} ${inter.variable}`,
  tecnologia_assistencia: `${jakarta.variable} ${inter.variable}`,
  casa_decoracao: `${cormorant.variable} ${jost.variable}`,
  eventos_fotografia: `${playfair.variable} ${inter.variable}`,
  servicos_rapidos: jakarta.variable,
  agro_campo: lato.variable,
  turismo_hospedagem: `${playfair.variable} ${lato.variable}`,
  premium: `${cormorant.variable} ${jost.variable}`,
};

export const classeDeFontes = (id: EstiloId): string => FONTES[id] ?? inter.variable;
