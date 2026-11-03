import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { formatoDeCaminhoValido } from "@/shared/conteudo/imagens";
import { semControle } from "@/shared/conteudo/zod-util";
import { formatarCentavos, type Preco } from "./preco";

/**
 * Campos do imóvel da Loja (IM-098, D-020). Espelham os CHECKs de catalogo_item_versao. Preço em centavos (BRL);
 * no aluguel, o valor "fixo" é MENSAL. Não existe endereço exato: só bairro, cidade e UF (privacidade, IM-029).
 */

export const TIPOS_IMOVEL = [
  "casa",
  "apartamento",
  "terreno",
  "comercial",
  "rural",
  "outro",
] as const;
export type TipoImovel = (typeof TIPOS_IMOVEL)[number];

export const FINALIDADES_IMOVEL = ["venda", "aluguel"] as const;
export type FinalidadeImovel = (typeof FINALIDADES_IMOVEL)[number];

export const ROTULOS_TIPO_IMOVEL: Record<TipoImovel, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  comercial: "Comercial",
  rural: "Rural",
  outro: "Outro",
};
export const ROTULOS_FINALIDADE_IMOVEL: Record<FinalidadeImovel, string> = {
  venda: "Venda",
  aluguel: "Aluguel",
};

const L = LIMITES.imovel;

/** Texto vazio vira null (limpar o campo). */
const vazioParaNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** "120", "120.5" e "120,5" viram número; o resto passa como veio e o Zod recusa. */
const numeroDeTexto = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t === "") return null;
  return /^\d{1,12}([.,]\d{1,2})?$/.test(t) ? Number(t.replace(",", ".")) : v;
};
const inteiroDeTexto = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t === "") return null;
  return /^\d{1,12}$/.test(t) ? Number(t) : v;
};

const MSG_AREA = `Informe a área em m² (maior que zero, no máximo 2 casas decimais).`;
const MSG_CONTAGEM = `Informe um número de 0 a ${L.contagemMax}.`;
const MSG_EXTRA = `Informe um valor entre R$ 0,00 e ${formatarCentavos(L.extraMaxCentavos)}.`;
const MSG_BAIRRO = `O bairro deve ter de ${L.bairroMin} a ${L.bairroMax} caracteres.`;

const contagem = () =>
  z
    .preprocess(
      inteiroDeTexto,
      z
        .number({ error: MSG_CONTAGEM })
        .int({ error: MSG_CONTAGEM })
        .min(0, { error: MSG_CONTAGEM })
        .max(L.contagemMax, { error: MSG_CONTAGEM })
        .nullable(),
    )
    .optional();

const centavosExtra = () =>
  z
    .preprocess(
      inteiroDeTexto,
      z
        .number({ error: MSG_EXTRA })
        .int({ error: MSG_EXTRA })
        .min(0, { error: MSG_EXTRA })
        .max(L.extraMaxCentavos, { error: MSG_EXTRA })
        .nullable(),
    )
    .optional();

const booleanoOpcional = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim().toLowerCase();
      if (t === "") return null;
      if (["true", "on", "1", "sim"].includes(t)) return true;
      if (["false", "off", "0", "nao", "não"].includes(t)) return false;
      return v;
    },
    z.boolean({ error: "Informe sim ou não." }).nullable(),
  )
  .optional();

/** Campos do imóvel em modo patch: undefined = não mexe; null = limpa. */
export const camposImovelShape = {
  imovelTipo: z
    .preprocess(
      vazioParaNulo,
      z.enum(TIPOS_IMOVEL, { error: "Escolha o tipo do imóvel." }).nullable(),
    )
    .optional(),
  finalidade: z
    .preprocess(
      vazioParaNulo,
      z.enum(FINALIDADES_IMOVEL, { error: "Escolha venda ou aluguel." }).nullable(),
    )
    .optional(),
  areaM2: z
    .preprocess(
      numeroDeTexto,
      z
        .number({ error: MSG_AREA })
        .gt(0, { error: MSG_AREA })
        .max(L.areaMaxM2, { error: MSG_AREA })
        .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { error: MSG_AREA })
        .nullable(),
    )
    .optional(),
  quartos: contagem(),
  banheiros: contagem(),
  vagas: contagem(),
  bairro: z
    .preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
      z
        .string({ error: MSG_BAIRRO })
        .min(L.bairroMin, { error: MSG_BAIRRO })
        .max(L.bairroMax, { error: MSG_BAIRRO })
        .refine(semControle, { error: "O texto tem caracteres inválidos." })
        .nullable(),
    )
    .optional(),
  condominioCentavos: centavosExtra(),
  iptuCentavos: centavosExtra(),
  aceitaFinanciamento: booleanoOpcional,
};

/** Até 8 fotos adicionais em item/<id>/, sem repetição (o dono da pasta é conferido em validarConteudoItem). */
export const fotosExtrasPathsSchema = z
  .array(
    z
      .string({ error: "Imagem inválida." })
      .refine((c) => formatoDeCaminhoValido(c, "item"), { error: "Imagem inválida." }),
    { error: "Imagens inválidas." },
  )
  .max(L.fotosExtrasMax, {
    error: `Envie no máximo ${L.fotosExtrasMax} fotos adicionais.`,
  })
  .refine((a) => new Set(a).size === a.length, { error: "Não repita a mesma foto." })
  .optional();

/** Campos do imóvel no conteúdo de uma versão (todos opcionais; ausente = null). */
export type CamposImovelConteudo = {
  imovelTipo?: TipoImovel | null;
  finalidade?: FinalidadeImovel | null;
  areaM2?: number | null;
  quartos?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  bairro?: string | null;
  condominioCentavos?: number | null;
  iptuCentavos?: number | null;
  aceitaFinanciamento?: boolean | null;
};

export const CHAVES_CAMPOS_IMOVEL = [
  "imovelTipo",
  "finalidade",
  "areaM2",
  "quartos",
  "banheiros",
  "vagas",
  "bairro",
  "condominioCentavos",
  "iptuCentavos",
  "aceitaFinanciamento",
] as const satisfies readonly (keyof CamposImovelConteudo)[];

/** true se algum campo de imóvel está preenchido (usado para recusar campo de imóvel em produto/serviço). */
export function temCampoDeImovel(c: CamposImovelConteudo): boolean {
  return CHAVES_CAMPOS_IMOVEL.some((k) => c[k] !== undefined && c[k] !== null);
}

/** Número vindo do banco (numeric pode chegar como texto). Valor inválido vira null. */
export function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

const emLista = <T extends string>(lista: readonly T[], v: unknown): T | null =>
  typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as T) : null;
export const tipoImovelOuNulo = (v: unknown) => emLista(TIPOS_IMOVEL, v);
export const finalidadeOuNula = (v: unknown) => emLista(FINALIDADES_IMOVEL, v);

/** O que falta para o imóvel seguir à aprovação (espelha catalogo_enviar_item_versao). */
export function pendenciasDoImovel(c: CamposImovelConteudo, preco: Preco | null): string[] {
  const p: string[] = [];
  if (!c.imovelTipo) p.push("Escolha o tipo do imóvel.");
  if (!c.finalidade) p.push("Escolha venda ou aluguel.");
  if (!preco) p.push("Informe o preço ou escolha sob consulta.");
  if (c.areaM2 === null || c.areaM2 === undefined) p.push("Informe a área.");
  if (c.quartos === null || c.quartos === undefined) p.push("Informe o número de quartos.");
  if (c.banheiros === null || c.banheiros === undefined) p.push("Informe o número de banheiros.");
  if (c.vagas === null || c.vagas === undefined) p.push("Informe o número de vagas.");
  if (!c.bairro) p.push("Informe o bairro.");
  return p;
}

/** Preço do imóvel como texto. No aluguel, o valor é mensal: "R$ 2.500,00 por mês". */
export function formatarPrecoImovel(
  preco: Preco | null,
  finalidade: FinalidadeImovel | null | undefined,
): string | null {
  if (!preco) return null;
  if (preco.modo === "sob_consulta" || preco.centavos === null) return "Sob consulta";
  const v = formatarCentavos(preco.centavos);
  const base = preco.modo === "a_partir_de" ? `A partir de ${v}` : v;
  return finalidade === "aluguel" ? `${base} por mês` : base;
}

/** Imóvel no formato de exibição (público e prévia). Sem endereço exato, sem dado de pessoa. */
export type ImovelExibicao = {
  tipo: TipoImovel | null;
  tipoRotulo: string | null;
  finalidade: FinalidadeImovel | null;
  finalidadeRotulo: string | null;
  areaM2: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string | null;
  condominioCentavos: number | null;
  condominioTexto: string | null;
  iptuCentavos: number | null;
  iptuTexto: string | null;
  aceitaFinanciamento: boolean | null;
  /** "Bairro, Cidade/UF" com o que existir. */
  localTexto: string | null;
};

export function imovelParaExibicao(
  c: CamposImovelConteudo,
  cidade: string | null | undefined,
  uf: string | null | undefined,
): ImovelExibicao {
  const tipo = c.imovelTipo ?? null;
  const finalidade = c.finalidade ?? null;
  const cond = c.condominioCentavos ?? null;
  const iptu = c.iptuCentavos ?? null;
  const cidadeUf = [cidade, uf].filter(Boolean).join("/");
  const local = [c.bairro, cidadeUf].filter(Boolean).join(", ");
  return {
    tipo,
    tipoRotulo: tipo ? ROTULOS_TIPO_IMOVEL[tipo] : null,
    finalidade,
    finalidadeRotulo: finalidade ? ROTULOS_FINALIDADE_IMOVEL[finalidade] : null,
    areaM2: c.areaM2 ?? null,
    quartos: c.quartos ?? null,
    banheiros: c.banheiros ?? null,
    vagas: c.vagas ?? null,
    bairro: c.bairro ?? null,
    condominioCentavos: cond,
    condominioTexto: cond === null ? null : formatarCentavos(cond),
    iptuCentavos: iptu,
    iptuTexto: iptu === null ? null : formatarCentavos(iptu),
    aceitaFinanciamento: c.aceitaFinanciamento ?? null,
    localTexto: local || null,
  };
}
