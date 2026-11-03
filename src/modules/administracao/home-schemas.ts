import { z } from "zod";
import { CHAVES_SECAO_HOME } from "@/modules/busca";
import { LIMITES } from "@/shared/config/limites";

/**
 * Edição das seções em carrossel da home pelo administrador geral (IM-096, D-018). Espelha os CHECKs do banco
 * (busca_home_secao): título 3-40, ordem 1-99, mínimo 1-20, limite 1-30 e >= mínimo. Chave e tipo de item não se editam.
 */

export const LIMITES_HOME = {
  tituloMin: 3,
  tituloMax: 40,
  ordemMin: 1,
  ordemMax: 99,
  minimoMin: 1,
  minimoMax: 20,
  limiteMin: 1,
  limiteMax: 30,
} as const;
const L = LIMITES_HOME;

/** Mesmo formato do banco: letras (com acento), números e pontuação simples; sem emoji, marcação ou link (IM-012). */
const FORMATO_TITULO = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ,.!?:&'()/+-]*$/;
const PARECE_LINK = /(https?:|www\.|\.com|\.net|\.org|\.br)/i;

const msgTitulo = `O título deve ter de ${L.tituloMin} a ${L.tituloMax} caracteres.`;

const titulo = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v),
  z
    .string({ error: msgTitulo })
    .min(L.tituloMin, { error: msgTitulo })
    .max(L.tituloMax, { error: msgTitulo })
    .refine((t) => FORMATO_TITULO.test(t), {
      error: "O título aceita só letras, números e pontuação simples.",
    })
    .refine((t) => !PARECE_LINK.test(t), { error: "O título não pode ter link nem endereço." }),
);

const inteiro = (min: number, max: number, mensagem: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && /^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : v),
    z.number({ error: mensagem }).int({ error: mensagem }).min(min, { error: mensagem }).max(max, { error: mensagem }),
  );

/** Formulário manda "true"/"on"/"false"/"off"; qualquer outra coisa é recusada. */
const booleano = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const t = v.trim().toLowerCase();
  if (["true", "on", "1"].includes(t)) return true;
  if (["false", "off", "0"].includes(t)) return false;
  return v;
}, z.boolean({ error: "Informe se a seção fica ativa." }));

const motivo = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(1, { error: "Informe o motivo." })
  .max(LIMITES.revisao.motivoMax, {
    error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
  });

export const alterarSecaoHomeSchema = z
  .object({
    chave: z.enum(CHAVES_SECAO_HOME, { error: "Seção desconhecida." }),
    titulo,
    ativa: booleano,
    ordem: inteiro(L.ordemMin, L.ordemMax, `A ordem deve ficar entre ${L.ordemMin} e ${L.ordemMax}.`),
    minimoItens: inteiro(
      L.minimoMin,
      L.minimoMax,
      `O mínimo de itens deve ficar entre ${L.minimoMin} e ${L.minimoMax}.`,
    ),
    limitePadrao: inteiro(
      L.limiteMin,
      L.limiteMax,
      `O limite de itens deve ficar entre ${L.limiteMin} e ${L.limiteMax}.`,
    ),
    motivo,
  })
  .superRefine((v, ctx) => {
    if (v.limitePadrao < v.minimoItens) {
      ctx.addIssue({
        code: "custom",
        path: ["limitePadrao"],
        message: "O limite de itens não pode ser menor que o mínimo.",
      });
    }
  });
export type AlterarSecaoHome = z.infer<typeof alterarSecaoHomeSchema>;
