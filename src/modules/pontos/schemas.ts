import { z } from "zod";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/** Entradas do módulo pontos, validadas na borda (Zod). O banco valida de novo (defesa em profundidade). */

/**
 * Categorias fixas de reversão (D-012, confirmações). A categoria é a parte visível ao indicador; a observação
 * interna é só do administrador. A assinatura final do RPC (outro agente) ainda não existe: ver adaptador.
 */
export const CATEGORIAS_REVERSAO = [
  "contato_duplicado",
  "indicacao_invalida",
  "autoindicacao",
  "fraude",
  "outro",
] as const;
export type CategoriaReversao = (typeof CATEGORIAS_REVERSAO)[number];

export const ROTULOS_CATEGORIA_REVERSAO: Record<CategoriaReversao, string> = {
  contato_duplicado: "Contato duplicado",
  indicacao_invalida: "Indicação inválida",
  autoindicacao: "Autoindicação",
  fraude: "Suspeita de fraude",
  outro: "Outro motivo",
};

/** Chaves de parâmetro do módulo (IM-030). A faixa de valores é conferida pelo banco. */
export const CHAVES_PARAMETRO_PONTOS = ["pontos_por_indicacao", "intervalo_dias"] as const;
export type ChaveParametroPontos = (typeof CHAVES_PARAMETRO_PONTOS)[number];

const MSG_MOTIVO = "Informe o motivo (até 500 caracteres).";
const comprimento = (s: string) => Array.from(s).length;

export const motivoSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z
    .string({ error: MSG_MOTIVO })
    .refine((s) => comprimento(s) >= 1, { error: MSG_MOTIVO })
    .refine((s) => comprimento(s) <= 500, { error: MSG_MOTIVO })
    .refine(semControle, { error: "O texto tem caracteres inválidos." }),
);

/** Texto opcional: vazio vira null. */
const textoOpcionalNulo = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
      z
        .string({ error: "Texto inválido." })
        .refine((s) => comprimento(s) <= max, { error: `Use no máximo ${max} caracteres.` })
        .refine(semControle, { error: "O texto tem caracteres inválidos." })
        .nullable(),
    )
    .optional()
    .transform((v) => v ?? null);

export const reverterCreditoSchema = z.object({
  lancamentoId: uuidSchema,
  categoria: z.enum(CATEGORIAS_REVERSAO, { error: "Escolha a categoria da reversão." }),
  /** Observação interna do administrador (nunca vai ao indicador). */
  observacao: textoOpcionalNulo(500),
  confirmarSaldoNegativo: z.boolean().optional().default(false),
});
export type ReverterCredito = z.infer<typeof reverterCreditoSchema>;

export const reprocessarPedidoSchema = z.object({ pedidoId: uuidSchema, motivo: motivoSchema });

export const definirParametroSchema = z.object({
  chave: z.enum(CHAVES_PARAMETRO_PONTOS, { error: "Parâmetro desconhecido." }),
  valor: z
    .number({ error: "Informe um número inteiro." })
    .int({ error: "Informe um número inteiro." })
    .min(1, { error: "Informe um valor maior que zero." })
    .max(1_000_000, { error: "Valor alto demais." }),
  motivo: motivoSchema,
});

// Benefícios (IM-036) ------------------------------------------------------------------------------------------

const textoObrigatorio = (max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: msg })
      .refine((s) => comprimento(s) >= 1, { error: msg })
      .refine((s) => comprimento(s) <= max, { error: `Use no máximo ${max} caracteres.` })
      .refine(semControle, { error: "O texto tem caracteres inválidos." }),
  );

const inteiroOpcional = (max: number, msg: string) =>
  z
    .preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z
        .number({ error: msg })
        .int({ error: msg })
        .min(1, { error: msg })
        .max(max, { error: msg })
        .nullable(),
    )
    .optional()
    .transform((v) => v ?? null);

/** Data civil AAAA-MM-DD existente no calendário. */
export function dataIsoValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  );
}

const dataOpcional = z
  .preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z
      .string({ error: "Data inválida." })
      .refine(dataIsoValida, { error: "Data inválida." })
      .nullable(),
  )
  .optional()
  .transform((v) => v ?? null);

const camposBeneficio = {
  nome: textoObrigatorio(100, "Informe o nome do benefício."),
  descricao: textoObrigatorio(1500, "Informe a descrição do benefício."),
  pontosNecessarios: z
    .number({ error: "Informe os pontos necessários." })
    .int({ error: "Informe os pontos necessários." })
    .min(1, { error: "Informe os pontos necessários." })
    .max(1_000_000, { error: "Valor alto demais." }),
  condicoes: textoOpcionalNulo(1000),
  limiteTotal: inteiroOpcional(1_000_000, "Informe um número inteiro maior que zero."),
  limitePorPessoa: inteiroOpcional(1_000_000, "Informe um número inteiro maior que zero."),
  prazoResgateAte: dataOpcional,
  prazoUsoAte: dataOpcional,
};

type CamposRelacionados = {
  limiteTotal: number | null;
  limitePorPessoa: number | null;
  prazoResgateAte: string | null;
  prazoUsoAte: string | null;
};

/** Regras entre campos, espelhando o banco: limite por pessoa <= total; uso não termina antes do resgate. */
function coerencia(d: CamposRelacionados, ctx: z.RefinementCtx) {
  if (d.limiteTotal !== null && d.limitePorPessoa !== null && d.limitePorPessoa > d.limiteTotal) {
    ctx.addIssue({
      code: "custom",
      path: ["limitePorPessoa"],
      message: "O limite por pessoa não pode ser maior que o limite total.",
    });
  }
  if (d.prazoResgateAte && d.prazoUsoAte && d.prazoUsoAte < d.prazoResgateAte) {
    ctx.addIssue({
      code: "custom",
      path: ["prazoUsoAte"],
      message: "O prazo de uso não pode terminar antes do prazo de resgate.",
    });
  }
}

export const criarBeneficioSchema = z
  .object({ perfilId: uuidSchema, ...camposBeneficio })
  .superRefine(coerencia);
export const salvarBeneficioSchema = z
  .object({ beneficioId: uuidSchema, ...camposBeneficio })
  .superRefine(coerencia);
export const adminCadastrarBeneficioSchema = z
  .object({ perfilId: uuidSchema, ...camposBeneficio, motivo: motivoSchema })
  .superRefine(coerencia);

export const enviarVersaoSchema = z.object({ versaoId: uuidSchema });
export const definirBeneficioAtivoSchema = z.object({
  beneficioId: uuidSchema,
  ativo: z.boolean(),
});
export const adminDefinirBeneficioAtivoSchema = z.object({
  beneficioId: uuidSchema,
  ativo: z.boolean(),
  motivo: motivoSchema,
});

export const decidirBeneficioSchema = z
  .object({
    versaoId: uuidSchema,
    aprovar: z.boolean(),
    motivo: textoOpcionalNulo(500),
  })
  .superRefine((d, ctx) => {
    if (!d.aprovar && d.motivo === null) {
      ctx.addIssue({ code: "custom", path: ["motivo"], message: "Informe o motivo da rejeição." });
    }
  });

export const perfilIdSchema = z.object({ perfilId: uuidSchema });

export type DadosBeneficio = z.infer<typeof criarBeneficioSchema>;
