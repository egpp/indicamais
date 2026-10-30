/**
 * Caracteres de controle e invisíveis (zero width, marcas bidi, separadores de linha, BOM). As faixas são
 * montadas por código numérico, para o arquivo-fonte ficar só em ASCII.
 */
type Faixa = readonly [number, number];

const hex = (n: number) => `\\u{${n.toString(16)}}`;
const classe = (faixas: readonly Faixa[]) =>
  `[${faixas.map(([a, b]) => (a === b ? hex(a) : `${hex(a)}-${hex(b)}`)).join("")}]`;

const COMUNS: readonly Faixa[] = [
  [0x7f, 0x9f], // DEL e C1
  [0x200b, 0x200f], // zero width, marcas de direção
  [0x2028, 0x202f], // separadores de linha/parágrafo, bidi, espaço estreito
  [0x2060, 0x206f], // word joiner e formatação invisível
  [0xfeff, 0xfeff], // BOM
];

/** Qualquer controle (inclui quebra de linha e tabulação) ou invisível. */
export const INVISIVEIS = new RegExp(classe([[0x00, 0x1f], ...COMUNS]), "u");
export const INVISIVEIS_GLOBAL = new RegExp(INVISIVEIS.source, "gu");
/** Igual, mas permite tabulação (9), quebra de linha (10) e retorno (13): texto multilinha. */
export const INVISIVEIS_MENSAGEM = new RegExp(
  classe([[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], ...COMUNS]),
  "u",
);
