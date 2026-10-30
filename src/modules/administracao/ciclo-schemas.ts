import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/** Entrada externa das ações de permissões, denúncias, suspensão e invalidação (IM-076, IM-077, IM-080). D-014. */

export const PERMISSOES = [
  "aprovar",
  "gerir_categorias",
  "analisar_denuncias",
  "invalidar_indicacoes",
  "reverter_pontos",
  "suspender",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

export const ROTULOS_PERMISSAO: Record<Permissao, string> = {
  aprovar: "Aprovar conteúdo e benefícios",
  gerir_categorias: "Gerir categorias",
  analisar_denuncias: "Analisar denúncias",
  invalidar_indicacoes: "Invalidar indicações",
  reverter_pontos: "Reverter pontos",
  suspender: "Suspender e reativar contas",
};

export const ALVOS_DENUNCIA = ["perfil", "item", "conta", "pedido", "indicacao"] as const;
export type AlvoDenuncia = (typeof ALVOS_DENUNCIA)[number];

export const TIPOS_DENUNCIA = [
  "autoindicacao",
  "spam_fraude",
  "uso_indevido_dados",
  "conteudo_inadequado",
] as const;
export type TipoDenuncia = (typeof TIPOS_DENUNCIA)[number];

export const ROTULOS_TIPO_DENUNCIA: Record<TipoDenuncia, string> = {
  autoindicacao: "Autoindicação",
  spam_fraude: "Spam ou fraude",
  uso_indevido_dados: "Uso indevido de dados",
  conteudo_inadequado: "Conteúdo inadequado",
};

export const SITUACOES_DENUNCIA = ["aberta", "em_analise", "procedente", "improcedente"] as const;
export type SituacaoDenuncia = (typeof SITUACOES_DENUNCIA)[number];

/** Decisões possíveis na análise (a situação "aberta" só existe na entrada). */
export const DECISOES_DENUNCIA = ["em_analise", "procedente", "improcedente"] as const;
export type DecisaoDenuncia = (typeof DECISOES_DENUNCIA)[number];

export const LIMITES_CICLO = {
  textoDenunciaMax: 500,
  motivoMax: LIMITES.revisao.motivoMax,
} as const;

const motivo = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(1, { error: "Informe o motivo." })
  .max(LIMITES_CICLO.motivoMax, {
    error: `O motivo deve ter até ${LIMITES_CICLO.motivoMax} caracteres.`,
  })
  .refine(semControle, { error: "O texto tem caracteres inválidos." });

const permissao = z.enum(PERMISSOES, { error: "Permissão inválida." });

export const permissaoContaSchema = z.object({
  contaId: uuidSchema,
  permissao,
  motivo,
});
export type PermissaoConta = z.infer<typeof permissaoContaSchema>;

/**
 * Denúncia pública (IM-076). `origem` = hash sha256 hex (64) calculado no servidor; nunca o IP cru. `site` é o
 * campo-armadilha do formulário: preenchido = robô. Texto curto opcional, sem caracteres de controle.
 */
export const denunciarSchema = z.object({
  alvoTipo: z.enum(ALVOS_DENUNCIA, { error: "Tipo de alvo inválido." }),
  alvoId: uuidSchema,
  tipo: z.enum(TIPOS_DENUNCIA, { error: "Escolha o motivo da denúncia." }),
  texto: z.preprocess(
    (v) =>
      v === null ? undefined : typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v,
    z
      .string({ error: "Texto inválido." })
      .max(LIMITES_CICLO.textoDenunciaMax, {
        error: `O texto deve ter até ${LIMITES_CICLO.textoDenunciaMax} caracteres.`,
      })
      .refine(semControle, { error: "O texto tem caracteres inválidos." })
      .optional(),
  ),
  origem: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z
      .string()
      .regex(/^[0-9a-f]{64}$/, { error: "Origem inválida." })
      .optional(),
  ),
  site: z.string().max(500).nullish(),
});
export type Denunciar = z.infer<typeof denunciarSchema>;

export const decidirDenunciaSchema = z.object({
  denunciaId: uuidSchema,
  decisao: z.enum(DECISOES_DENUNCIA, { error: "Decisão inválida." }),
  motivo,
});
export type DecidirDenuncia = z.infer<typeof decidirDenunciaSchema>;

export const contaMotivoSchema = z.object({ contaId: uuidSchema, motivo });
export type ContaMotivo = z.infer<typeof contaMotivoSchema>;

export const invalidarIndicacaoSchema = z.object({
  pedidoId: uuidSchema,
  motivo,
  /** Só depois de o P0410 avisar do saldo negativo e a pessoa confirmar (como em pontos). */
  confirmarSaldoNegativo: z.boolean().optional(),
});
export type InvalidarIndicacao = z.infer<typeof invalidarIndicacaoSchema>;
