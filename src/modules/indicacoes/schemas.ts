import { z } from "zod";
import { normalizarWhatsappBR } from "@/modules/contas";
import { LIMITES } from "@/shared/config/limites";
import { uuidSchema } from "@/shared/conteudo/zod-util";
import { SLUG_FORMATO } from "@/shared/formatacao/slug";
import { INVISIVEIS, INVISIVEIS_GLOBAL, INVISIVEIS_MENSAGEM } from "./invisiveis";

/**
 * Entradas do módulo indicacoes, validadas na borda (Zod). O banco valida de novo (defesa em profundidade),
 * mas entrada inválida nunca chega a ele.
 */

const C = LIMITES.contato;

export const semInvisiveis = (s: string) => !INVISIVEIS.test(s);
export const comprimento = (s: string) => Array.from(s).length;

export const CANAIS_COMPARTILHAMENTO = ["whatsapp", "copiar", "outro"] as const;
export type CanalCompartilhamento = (typeof CANAIS_COMPARTILHAMENTO)[number];

export const CODIGO_LINK = /^[0-9a-f]{32}$/;
const CHAVE = /^[A-Za-z0-9_-]+$/;

export type ResultadoWhatsappVisitante =
  { ok: true; e164: string } | { ok: false; mensagem: string };

const MSG_WHATSAPP = "Informe um WhatsApp válido com DDD. Exemplo: (51) 99999-9999.";

/**
 * WhatsApp do visitante -> "+55DDDNÚMERO". Só ASCII [0-9], espaço, parênteses, hífen, ponto e "+" inicial.
 * Letras, invisíveis, dígitos de largura total e outros alfabetos numéricos são recusados antes de qualquer
 * conversão. A normalização em si (DDD, 8/9 dígitos) é a de contas (IM-009).
 */
export function normalizarWhatsappVisitante(entrada: unknown): ResultadoWhatsappVisitante {
  if (typeof entrada !== "string") return { ok: false, mensagem: MSG_WHATSAPP };
  const t = entrada.replace(/^ +| +$/g, ""); // só espaço ASCII: BOM/NBSP nas pontas também são recusados
  if (t === "" || t.length > 30) return { ok: false, mensagem: MSG_WHATSAPP };
  if (!/^[+]?[0-9 ().-]+$/.test(t)) return { ok: false, mensagem: MSG_WHATSAPP };
  const r = normalizarWhatsappBR(t);
  if (!r.ok || !/^\+55[0-9]{10,11}$/.test(r.e164)) return { ok: false, mensagem: MSG_WHATSAPP };
  return { ok: true, e164: r.e164 };
}

const whatsappVisitanteSchema = z.string({ error: MSG_WHATSAPP }).transform((v, ctx) => {
  const r = normalizarWhatsappVisitante(v);
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: r.mensagem });
    return z.NEVER;
  }
  return r.e164;
});

const vazioParaUndefined = (v: unknown) =>
  v === null || (typeof v === "string" && v.trim() === "") ? undefined : v;

const nomeSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z
    .string({ error: "Informe seu nome." })
    .refine((s) => comprimento(s) >= C.nomeMin, { error: "Informe seu nome." })
    .refine((s) => comprimento(s) <= C.nomeMax, {
      error: `O nome deve ter no máximo ${C.nomeMax} caracteres.`,
    })
    .refine(semInvisiveis, { error: "O nome tem caracteres inválidos." }),
);

const textoOpcional = (base: z.ZodType<string>) =>
  z.preprocess((v) => {
    const x = vazioParaUndefined(v);
    return typeof x === "string" ? x.trim() : x;
  }, base.optional());

const emailVisitanteSchema = textoOpcional(
  z
    .string({ error: "E-mail inválido." })
    .max(C.emailMax, { error: "E-mail muito longo." })
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { error: "E-mail inválido." })
    .refine(semInvisiveis, { error: "E-mail inválido." }),
);

const mensagemVisitanteSchema = textoOpcional(
  z
    .string({ error: "Mensagem inválida." })
    .refine((s) => comprimento(s) <= C.mensagemMax, {
      error: `A mensagem deve ter no máximo ${C.mensagemMax} caracteres.`,
    })
    .refine((s) => !INVISIVEIS_MENSAGEM.test(s), {
      error: "A mensagem tem caracteres inválidos.",
    }),
);

/** Código de link vindo da URL (?ind=). Malformado é descartado em silêncio: o visitante não é prejudicado (IM-025). */
const codigoOpcionalSchema = z.preprocess(
  (v) => (typeof v === "string" && CODIGO_LINK.test(v) ? v : undefined),
  z.string().optional(),
);

export const chaveIdempotenciaSchema = z
  .string({ error: "Chave de envio inválida." })
  .min(C.chaveMin, { error: "Chave de envio inválida." })
  .max(C.chaveMax, { error: "Chave de envio inválida." })
  .regex(CHAVE, { error: "Chave de envio inválida." });

/** Nome público do destino usado só em textos prontos. Invisíveis viram espaço; vazio vira ausente. */
const nomeDestinoSchema = z.preprocess(
  (v) =>
    typeof v === "string"
      ? Array.from(v.replace(INVISIVEIS_GLOBAL, " ").replace(/\s+/g, " ").trim())
          .slice(0, LIMITES.link.nomeDestinoMax)
          .join("") || undefined
      : undefined,
  z.string().optional(),
);

export const enviarContatoSchema = z
  .object({
    perfilId: uuidSchema.optional(),
    itemId: uuidSchema.optional(),
    nome: nomeSchema,
    whatsapp: whatsappVisitanteSchema,
    email: emailVisitanteSchema,
    mensagem: mensagemVisitanteSchema,
    codigo: codigoOpcionalSchema,
    chave: chaveIdempotenciaSchema,
    nomeDestino: nomeDestinoSchema,
  })
  .refine((d) => (d.perfilId === undefined) !== (d.itemId === undefined), {
    path: ["destino"],
    error: "Informe exatamente um destino (perfil ou item).",
  });
export type EnviarContato = z.output<typeof enviarContatoSchema>;

const slugSchema = z
  .string({ error: "Endereço do perfil inválido." })
  .min(LIMITES.perfil.slugMin, { error: "Endereço do perfil inválido." })
  .max(LIMITES.perfil.slugMax, { error: "Endereço do perfil inválido." })
  .regex(SLUG_FORMATO, { error: "Endereço do perfil inválido." });

export const gerarLinkSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("perfil"),
    id: uuidSchema,
    slug: slugSchema,
    nome: nomeDestinoSchema,
  }),
  z.object({ tipo: z.literal("item"), id: uuidSchema, nome: nomeDestinoSchema }),
]);
export type DestinoLink = z.output<typeof gerarLinkSchema>;

export const compartilhamentoSchema = z.object({
  codigo: z.string({ error: "Link inválido." }).regex(CODIGO_LINK, { error: "Link inválido." }),
  canal: z.enum(CANAIS_COMPARTILHAMENTO, { error: "Canal inválido." }),
});

export const pedidoIdSchema = z.object({ pedidoId: uuidSchema });

const motivoObrigatorio = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z
    .string({ error: "Informe o motivo." })
    .min(1, { error: "Informe o motivo." })
    .max(LIMITES.revisao.motivoMax, {
      error: `O motivo deve ter no máximo ${LIMITES.revisao.motivoMax} caracteres.`,
    })
    .refine((s) => !INVISIVEIS_MENSAGEM.test(s), { error: "O motivo tem caracteres inválidos." }),
);

export const reenvioResponsavelSchema = pedidoIdSchema;
export const reenvioAdminSchema = pedidoIdSchema.extend({ motivo: motivoObrigatorio });
export const tratarAlertaSchema = pedidoIdSchema.extend({ motivo: motivoObrigatorio });

export const definirParametroSchema = z.object({
  chave: z
    .string({ error: "Parâmetro inválido." })
    .regex(/^[a-z0-9_]{1,80}$/, { error: "Parâmetro inválido." }),
  valor: z
    .number({ error: "Informe um número inteiro." })
    .int({ error: "Informe um número inteiro." }),
  motivo: motivoObrigatorio,
});
