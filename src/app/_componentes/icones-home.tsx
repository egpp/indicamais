import type { ReactNode } from "react";

/**
 * Ícones da página inicial (arte própria em SVG, traço de 1,8px, herdam a cor do texto). Sempre decorativos
 * (aria-hidden): o sentido está no texto ao lado. Sem imagens nem fontes de terceiros.
 */
export type NomeIconeHome =
  | "busca"
  | "local"
  | "usuario"
  | "menu"
  | "fechar"
  | "seta-baixo"
  | "seta-direita"
  | "seta-esquerda"
  | "escudo"
  | "pessoas"
  | "presente"
  | "conversa"
  | "megafone"
  | "coracao"
  | "tendencia"
  | "destaque"
  | "empresa"
  | "sacola"
  | "ferramentas"
  | "talheres"
  | "saude"
  | "casa"
  | "carro"
  | "beleza"
  | "grade"
  | "etiqueta"
  | "notebook"
  | "livro"
  | "pata"
  | "camisa"
  | "enviar"
  | "bola"
  | "musica";

const CAMINHOS: Record<NomeIconeHome, ReactNode> = {
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </>
  ),
  local: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  "seta-baixo": <path d="m6 9 6 6 6-6" />,
  "seta-direita": <path d="M5 12h14M13 6l6 6-6 6" />,
  "seta-esquerda": <path d="m15 6-6 6 6 6" />,
  escudo: (
    <>
      <path d="M12 3l8 3v5.5c0 4.6-3.2 8.2-8 9.5-4.8-1.3-8-4.9-8-9.5V6l8-3z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.7 2.9-6 6.5-6s6.5 2.3 6.5 6" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.4c2 .7 3.5 2.4 3.5 5.6" />
    </>
  ),
  presente: (
    <>
      <path d="M4 11h16v9H4z" />
      <path d="M3 7h18v4H3z" />
      <path d="M12 7v13" />
      <path d="M12 7c-1.5-3.5-5.5-3-4.5 0M12 7c1.5-3.5 5.5-3 4.5 0" />
    </>
  ),
  conversa: <path d="M4 5h16v11H9.5L4 20.5V5z" />,
  megafone: (
    <>
      <path d="M3 10v4h3l8 4V6L6 10H3z" />
      <path d="M17.5 9a4 4 0 0 1 0 6M7 14.5l1.2 5h2.6l-1-4.2" />
    </>
  ),
  coracao: (
    <path d="M12 20.5C5 15.3 3 12 3 8.8A4.8 4.8 0 0 1 7.8 4c1.8 0 3.3.9 4.2 2.4C12.900 4.900 14.400 4 16.200 4A4.800 4.800 0 0 1 21 8.800c0 3.200-2 6.500-9 11.700z" />
  ),
  tendencia: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  destaque: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5 7 21l5-2.800L17 21l-1.500-7.500" />
    </>
  ),
  empresa: (
    <>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-5h6v5M8.500 10h1M14.500 10h1M8.500 13h1M14.500 13h1" />
    </>
  ),
  sacola: (
    <>
      <path d="M6 8h12l1 12H5L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  ferramentas: (
    <>
      <path d="M14.500 6.500a4 4 0 0 0 4.800 4.800L21 9.500 18 6.500l-1.200-1.200a4 4 0 0 0-2.300 1.200z" />
      <path d="M13.500 11.500 4 21l-1-1 9.500-9.500" />
    </>
  ),
  talheres: (
    <>
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
      <path d="M17 21V3c-2.500 1.500-3.500 4.500-3.500 8H17" />
    </>
  ),
  saude: (
    <path d="M12 20.500C5 15.300 3 12 3 8.800A4.800 4.800 0 0 1 7.800 4c1.800 0 3.300.9 4.200 2.400C12.900 4.900 14.400 4 16.200 4A4.800 4.800 0 0 1 21 8.800c0 3.200-2 6.500-9 11.700zM6 11h3l1.500-3 3 6 1.500-3h3" />
  ),
  casa: (
    <>
      <path d="M3 11.500 12 4l9 7.500" />
      <path d="M5.500 10v10h13V10M10 20v-5h4v5" />
    </>
  ),
  carro: (
    <>
      <path d="M4 16V12l2-5h12l2 5v4M3 16h18v3H3z" />
      <circle cx="7.500" cy="16" r="0.8" fill="currentColor" />
      <circle cx="16.500" cy="16" r="0.8" fill="currentColor" />
    </>
  ),
  beleza: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c-4 0-6-2.500-6-6 3.500 0 6 2 6 6zM12 13c4 0 6-2.500 6-6-3.500 0-6 2-6 6z" />
      <path d="M12 8.500c-1-1.500-1-3.500 0-5 1 1.500 1 3.500 0 5z" />
    </>
  ),
  grade: (
    <>
      <rect x="4" y="4" width="6.500" height="6.500" rx="1.500" />
      <rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500" />
      <rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500" />
      <rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3 12l9-9h8v8l-9 9-8-8z" />
      <circle cx="16" cy="8" r="1.200" fill="currentColor" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="5" width="14" height="10" rx="1.500" />
      <path d="M2.500 19h19" />
    </>
  ),
  livro: (
    <>
      <path d="M4 5.500C6.500 4.500 9.500 4.500 12 6c2.500-1.500 5.500-1.500 8-.5V19c-2.500-1-5.500-1-8 .5-2.500-1.500-5.500-1.500-8-.5V5.500z" />
      <path d="M12 6v13.500" />
    </>
  ),
  pata: (
    <>
      <circle cx="6.500" cy="11" r="1.800" />
      <circle cx="10" cy="6.500" r="1.800" />
      <circle cx="14" cy="6.500" r="1.800" />
      <circle cx="17.500" cy="11" r="1.800" />
      <path d="M8 17c0-2.500 2-4.500 4-4.500s4 2 4 4.500c0 1.800-1.500 2.500-4 2.500S8 18.800 8 17z" />
    </>
  ),
  camisa: (
    <path d="M8 4 3 7l2 4 2-1v10h10V10l2 1 2-4-5-3c-.5 1.500-2 2.500-4 2.500S8.500 5.500 8 4z" />
  ),
  enviar: <path d="M21 3 3 10.500l7 2.500 2.500 7L21 3zM10 13l5-5" />,
  bola: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-3 3-3 15 0 18M3 12h18" />
    </>
  ),
  musica: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.500" cy="18" r="2.500" />
      <circle cx="17.500" cy="16" r="2.500" />
    </>
  ),
};

export function IconeHome({
  nome,
  tamanho = 24,
  className,
}: {
  nome: NomeIconeHome;
  tamanho?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
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

const semAcento = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavras que escolhem o ícone de uma categoria. A primeira regra que combinar vence. */
const REGRAS: ReadonlyArray<readonly [RegExp, NomeIconeHome]> = [
  [/aliment|restaur|lanche|padaria|comida|bebida|gastron|pizz|bar\b|cafe/, "talheres"],
  [/saude|bem-estar|bem estar|clinica|medic|odont|farmac|fisio/, "saude"],
  [/imove|imobil|casa|aluguel|apartamento/, "casa"],
  [/veicul|auto|carro|moto|oficina|mecanic/, "carro"],
  [/beleza|estetic|salao|barbear|cabelo|spa|unha/, "beleza"],
  [/constru|reform|obra|eletric|encanad|pintur|material/, "ferramentas"],
  [/tecnolog|informat|celular|eletron|computad|software|internet/, "notebook"],
  [/educa|curso|escola|aula|ensino|idioma/, "livro"],
  [/pet|animal|veterin|racao/, "pata"],
  [/moda|roupa|vestu|calcad|acessori/, "camisa"],
  [/esporte|fitness|academia|lazer/, "bola"],
  [/music|festa|evento|show|entreten/, "musica"],
  [/servic|profission|consult|assess/, "empresa"],
  [/produto|loja|comercio|varejo/, "sacola"],
];

const RESERVA: readonly NomeIconeHome[] = ["etiqueta", "destaque", "sacola", "empresa", "pessoas"];

/**
 * Ícone estável de uma categoria: vem das palavras do nome/slug; sem correspondência, de um número calculado
 * do slug (sempre o mesmo para a mesma categoria, em qualquer tela e a cada visita).
 */
export function iconeDaCategoria(slug: string | null | undefined, nome: string): NomeIconeHome {
  const chave = `${semAcento(slug ?? "")} ${semAcento(nome)}`;
  for (const [regra, icone] of REGRAS) if (regra.test(chave)) return icone;
  let h = 0;
  for (const c of slug || nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return RESERVA[h % RESERVA.length]!;
}
