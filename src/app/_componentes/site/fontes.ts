import {
  Barlow,
  Barlow_Condensed,
  Cormorant_Garamond,
  Inter,
  Jost,
  Lato,
  Nunito,
  Playfair_Display,
} from "next/font/google";
import type { EstiloId } from "./estilos";

/**
 * Fontes gratuitas dos temas (D-016), servidas pelo próprio site. Todas, menos a do estilo padrão, usam
 * `preload: false`: o navegador só baixa a fonte quando o tema que a usa está na tela.
 * As variáveis --f-* são aplicadas pela classe do estilo (ver `classeDeFontes`) e lidas em site.css.
 */
// O carregador do Next exige opções literais (sem espalhar objeto).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--f-inter" });
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-nunito",
  preload: false,
});
const jost = Jost({ subsets: ["latin"], display: "swap", variable: "--f-jost", preload: false });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-cormorant",
  weight: ["500", "600", "700"],
  preload: false,
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-playfair",
  preload: false,
});
const lato = Lato({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-lato",
  weight: ["400", "700"],
  preload: false,
});
const barlow = Barlow({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-barlow",
  weight: ["400", "500", "600"],
  preload: false,
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--f-barlow-cond",
  weight: ["600", "700", "800"],
  preload: false,
});

/** Classes (variáveis de fonte) a aplicar ao redor da página, por estilo. Estilos sem fonte própria usam a do padrão. */
const FONTES: Partial<Record<EstiloId, string>> = {
  minimalista: inter.variable,
  saude_bem_estar: nunito.variable,
  beleza_estetica: `${cormorant.variable} ${jost.variable}`,
  gastronomia: `${playfair.variable} ${lato.variable}`,
  construcao_reformas: `${barlowCondensed.variable} ${barlow.variable}`,
};

export const classeDeFontes = (id: EstiloId): string => FONTES[id] ?? inter.variable;
