import { z } from "zod";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/**
 * Entradas externas do módulo de comissões (IM-061 a IM-073). Valores monetários são centavos inteiros; percentuais
 * são pontos-base (1 bp = 0,01%; 1 a 10000), conforme as constraints do banco. Limites de faixa são os do banco; o
 * parâmetro configurável (prazo) é validado pelo próprio banco contra minimo/maximo (IM-068).
 */
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;
export const CENTAVOS_MAX = 100_000_000;
export const PERCENTUAL_BP_MIN = 1;
export const PERCENTUAL_BP_MAX = 10_000;
export const NOME_OFERTA_MAX = 100;

/** Motivo obrigatório (auditoria): aparado, 10 a 500 caracteres, sem caracteres de controle. */
export const motivoSchema = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(MOTIVO_MIN, { error: `O motivo precisa ter pelo menos ${MOTIVO_MIN} caracteres.` })
  .max(MOTIVO_MAX, { error: `O motivo pode ter no máximo ${MOTIVO_MAX} caracteres.` })
  .refine(semControle, { error: "O motivo tem caracteres inválidos." });

export const centavosSchema = z
  .number({ error: "Informe o valor em centavos." })
  .int({ error: "O valor deve ser um número inteiro de centavos." })
  .min(1, { error: "O valor deve ser maior que zero." })
  .max(CENTAVOS_MAX, { error: "Valor acima do máximo permitido." });

export const percentualBpSchema = z
  .number({ error: "Informe o percentual em pontos-base." })
  .int({ error: "O percentual deve ser inteiro, em pontos-base." })
  .min(PERCENTUAL_BP_MIN, { error: "O percentual deve ser de pelo menos 1 ponto-base." })
  .max(PERCENTUAL_BP_MAX, { error: "O percentual não pode passar de 10000 pontos-base (100%)." });

const dataValida = (ano: number, mes: number, dia: number) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
};

/** Data AAAA-MM-DD existente no calendário. */
export const dataSchema = z
  .string({ error: "Informe a data." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida (use AAAA-MM-DD)." })
  .refine((s) => dataValida(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)), {
    error: "Data inexistente.",
  });

/** Competência AAAA-MM. O banco recebe o dia 1 do mês (AAAA-MM-01). */
export const competenciaSchema = z
  .string({ error: "Informe a competência." })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Competência inválida (use AAAA-MM)." })
  .transform((s) => `${s}-01`);

export const chaveParametroSchema = z
  .string({ error: "Informe o parâmetro." })
  .regex(/^[a-z][a-z0-9_]{0,63}$/, { error: "Parâmetro inválido." });

export const definirParametroSchema = z.object({
  chave: chaveParametroSchema,
  valor: z.number({ error: "Informe o valor." }).int({ error: "O valor deve ser inteiro." }),
  motivo: motivoSchema,
});

export const definirHabilitacaoSchema = z.object({
  perfilId: uuidSchema,
  ativa: z.boolean({ error: "Informe se o módulo fica ativo." }),
  origem: z.enum(["espontanea", "solicitacao"], { error: "Origem inválida." }),
  motivo: motivoSchema,
});

export const registrarVinculoSchema = z
  .object({
    perfilId: uuidSchema,
    indicadorId: uuidSchema,
    clienteId: uuidSchema,
    motivo: motivoSchema,
  })
  .refine((v) => v.indicadorId !== v.clienteId, {
    path: ["clienteId"],
    error: "Indicador e cliente devem ser contas diferentes.",
  });

export const registrarAssinaturaSchema = z
  .object({
    ofertaId: uuidSchema,
    clienteId: uuidSchema,
    valorCentavos: centavosSchema,
    inicio: dataSchema,
    fim: dataSchema.nullable().optional(),
    motivo: motivoSchema,
  })
  .refine((v) => v.fim == null || v.fim >= v.inicio, {
    path: ["fim"],
    error: "O fim não pode ser anterior ao início.",
  });

export const cancelarAssinaturaSchema = z.object({
  assinaturaId: uuidSchema,
  motivo: motivoSchema,
});

export const confirmarPagamentoSchema = z.object({
  assinaturaId: uuidSchema,
  competencia: competenciaSchema,
  valorCentavos: centavosSchema,
  motivo: motivoSchema,
});

export const estornarPagamentoSchema = z.object({
  pagamentoId: uuidSchema,
  motivo: motivoSchema,
  confirmarJaPaga: z.boolean().default(false),
});

export const CAUSAS_REVERSAO = ["cancelamento", "estorno", "correcao"] as const;
export const reverterComissaoSchema = z.object({
  comissaoId: uuidSchema,
  causa: z.enum(CAUSAS_REVERSAO, { error: "Causa inválida." }),
  motivo: motivoSchema,
  confirmarJaPaga: z.boolean().default(false),
});

export const ESTADOS_REPASSE = ["pendente_repasse", "paga"] as const;
export const avancarRepasseSchema = z.object({
  comissaoId: uuidSchema,
  estado: z.enum(ESTADOS_REPASSE, { error: "Estado inválido." }),
  motivo: motivoSchema,
});

export const listarVencidosSchema = z.object({ perfilId: uuidSchema.nullable().optional() });

export const encerrarVinculoSchema = z.object({ vinculoId: uuidSchema, motivo: motivoSchema });

export const criarOfertaSchema = z.object({
  perfilId: uuidSchema,
  itemId: uuidSchema,
  nome: z
    .string({ error: "Informe o nome da oferta." })
    .trim()
    .min(1, { error: "Informe o nome da oferta." })
    .max(NOME_OFERTA_MAX, { error: `O nome pode ter no máximo ${NOME_OFERTA_MAX} caracteres.` })
    .refine(semControle, { error: "O nome tem caracteres inválidos." }),
  percentualBp: percentualBpSchema,
});

export const alterarPercentualSchema = z.object({
  ofertaId: uuidSchema,
  percentualBp: percentualBpSchema,
});

export const definirOfertaAtivaSchema = z.object({
  ofertaId: uuidSchema,
  ativa: z.boolean({ error: "Informe o estado da oferta." }),
});
