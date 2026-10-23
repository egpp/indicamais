import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { formatoDeCaminhoValido } from "@/shared/conteudo/imagens";
import { textoOpcional, uuidSchema } from "@/shared/conteudo/zod-util";
import { precoSchema } from "./preco";

/** Entradas do módulo catalogo (IM-014, IM-015, IM-016). Campos desconhecidos são descartados. */

export const TIPOS_ITEM = ["produto", "servico"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

const fotoPathSchema = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string({ error: "Imagem inválida." })
      .refine(formatoDeCaminhoValido, { error: "Imagem inválida." })
      .nullable(),
  )
  .optional();

const categoriasSecundariasSchema = z
  .array(uuidSchema, { error: "Categorias inválidas." })
  .max(LIMITES.categorias.secundariasMax, {
    error: `Escolha no máximo ${LIMITES.categorias.secundariasMax} categorias secundárias.`,
  })
  .refine((a) => new Set(a).size === a.length, { error: "Não repita a mesma categoria." })
  .optional();

/** Campos editáveis do item (patch): undefined = não mexe; null = limpa. */
export const camposItemSchema = z.object({
  nome: textoOpcional(
    LIMITES.item.nomeMax,
    `O nome deve ter até ${LIMITES.item.nomeMax} caracteres.`,
  ),
  descricao: textoOpcional(
    LIMITES.item.descricaoMax,
    `A descrição deve ter até ${LIMITES.item.descricaoMax} caracteres.`,
  ),
  fotoPath: fotoPathSchema,
  categoriaPrincipalId: uuidSchema.nullable().optional(),
  categoriasSecundariasIds: categoriasSecundariasSchema,
  /** null = sem preço (preço é opcional). */
  preco: precoSchema.nullable().optional(),
});
export type CamposItem = z.infer<typeof camposItemSchema>;

/** Novo item: tipo obrigatório; `perfilId` ausente = anúncio particular da conta (IM-015). */
export const novoItemSchema = camposItemSchema.extend({
  tipo: z.enum(TIPOS_ITEM, { error: "Escolha produto ou serviço." }),
  perfilId: uuidSchema.nullable().optional(),
});
export type NovoItem = z.infer<typeof novoItemSchema>;

// Categorias -----------------------------------------------------------------------------------------------

const nomeCategoria = z
  .string({ error: "Informe o nome da categoria." })
  .trim()
  .min(LIMITES.categoria.nomeMin, {
    error: `O nome deve ter de ${LIMITES.categoria.nomeMin} a ${LIMITES.categoria.nomeMax} caracteres.`,
  })
  .max(LIMITES.categoria.nomeMax, {
    error: `O nome deve ter de ${LIMITES.categoria.nomeMin} a ${LIMITES.categoria.nomeMax} caracteres.`,
  });

const motivoObrigatorio = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(1, { error: "Informe o motivo." })
  .max(LIMITES.revisao.motivoMax, {
    error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
  });

export const solicitarCategoriaSchema = z.object({
  nome: nomeCategoria,
  justificativa: textoOpcional(
    LIMITES.categoria.justificativaMax,
    `A justificativa deve ter até ${LIMITES.categoria.justificativaMax} caracteres.`,
  ),
});
export type SolicitarCategoria = z.infer<typeof solicitarCategoriaSchema>;

export const criarCategoriaSchema = z.object({
  nome: nomeCategoria,
  ordem: z.number().int().min(-1000).max(100000).optional(),
});

export const alterarCategoriaSchema = z.object({
  id: uuidSchema,
  nome: nomeCategoria,
  ativa: z.boolean({ error: "Informe se a categoria fica ativa." }),
  ordem: z.number().int().min(-1000).max(100000),
  motivo: motivoObrigatorio,
});

export const decidirSolicitacaoSchema = z.discriminatedUnion("atendida", [
  z.object({
    atendida: z.literal(true),
    id: uuidSchema,
    categoriaId: uuidSchema,
    motivo: textoOpcional(LIMITES.revisao.motivoMax, "Motivo muito longo."),
  }),
  z.object({
    atendida: z.literal(false),
    id: uuidSchema,
    motivo: motivoObrigatorio,
  }),
]);
