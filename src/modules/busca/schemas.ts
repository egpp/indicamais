import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { UFS } from "@/shared/conteudo/ufs";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/** Filtros da busca pública (IM-019). Campos desconhecidos são descartados; limites vêm de LIMITES.busca. */

export const TIPOS_BUSCA = ["perfil", "produto", "servico"] as const;
export type TipoBusca = (typeof TIPOS_BUSCA)[number];

const B = LIMITES.busca;

/** Formulário e query string mandam "" ou null para "sem filtro". */
const vazioParaUndefined = (v: unknown) =>
  v === null || (typeof v === "string" && v.trim() === "") ? undefined : v;

/** "2" vira 2 (query string). Qualquer outra coisa segue como veio e a validação recusa. */
const numeroDeTexto = (v: unknown) => {
  const x = vazioParaUndefined(v);
  return typeof x === "string" && /^\d{1,9}$/.test(x.trim()) ? Number(x.trim()) : x;
};

const texto = (max: number, mensagem: string) =>
  z.preprocess(
    (v) => {
      const x = vazioParaUndefined(v);
      return typeof x === "string" ? x.trim() : x;
    },
    z
      .string({ error: "Texto inválido." })
      .max(max, { error: mensagem })
      .refine(semControle, { error: "O texto tem caracteres inválidos." })
      .optional(),
  );

export const filtrosBuscaSchema = z.object({
  /** Parte do NOME (D-008: só por nome). O banco ignora acentos e caixa; % _ \ são texto comum. */
  termo: texto(B.termoMax, `A busca deve ter até ${B.termoMax} caracteres.`),
  tipo: z.preprocess(
    (v) => {
      const x = vazioParaUndefined(v);
      return typeof x === "string" ? x.trim().toLowerCase() : x;
    },
    z.enum(TIPOS_BUSCA, { error: "Escolha perfil, produto ou serviço." }).optional(),
  ),
  categoriaId: z.preprocess(vazioParaUndefined, uuidSchema.optional()),
  uf: z.preprocess(
    (v) => {
      const x = vazioParaUndefined(v);
      return typeof x === "string" ? x.trim().toUpperCase() : x;
    },
    z.enum(UFS, { error: "Escolha uma UF válida." }).optional(),
  ),
  cidade: texto(B.cidadeMax, `A cidade deve ter até ${B.cidadeMax} caracteres.`),
  pagina: z.preprocess(
    numeroDeTexto,
    z
      .number({ error: "Página inválida." })
      .int({ error: "Página inválida." })
      .min(1, { error: "Página inválida." })
      .max(B.paginaMax, { error: "Página inválida." })
      .default(1),
  ),
  limite: z.preprocess(
    numeroDeTexto,
    z
      .number({ error: "Quantidade por página inválida." })
      .int({ error: "Quantidade por página inválida." })
      .min(1, { error: "Quantidade por página inválida." })
      .max(B.limiteMax, { error: `Mostre no máximo ${B.limiteMax} resultados por página.` })
      .default(B.limitePadrao),
  ),
});
export type FiltrosBusca = z.infer<typeof filtrosBuscaSchema>;

/** Quantos itens de cada tipo a seção da página inicial mostra (IM-019). */
export const secaoSchema = z.preprocess(
  numeroDeTexto,
  z
    .number({ error: "Quantidade inválida." })
    .int({ error: "Quantidade inválida." })
    .min(1, { error: "Quantidade inválida." })
    .max(B.limiteMax, { error: "Quantidade inválida." })
    .default(6),
);
