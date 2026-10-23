import { z } from "zod";
import { normalizarWhatsappBR } from "./whatsapp";
import { MENSAGEM_NOME_INVALIDO } from "./mensagens";

/** Schemas de entrada do módulo contas; servem cliente e servidor (IM-007, IM-008, IM-009). */

export const SENHA_MIN = 8;
// Limite prático do bcrypt usado pelo Auth (72 bytes).
export const SENHA_MAX = 72;

export const emailSchema = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .min(1, { error: "Informe o e-mail." })
  .max(254, { error: "E-mail muito longo." })
  .pipe(z.email({ error: "E-mail inválido." }));

export const senhaSchema = z
  .string({ error: "Informe a senha." })
  .min(SENHA_MIN, { error: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.` })
  .refine((s) => new TextEncoder().encode(s).length <= SENHA_MAX, {
    error: `A senha deve ter no máximo ${SENHA_MAX} caracteres.`,
  })
  .refine((s) => /\p{L}/u.test(s), { error: "A senha deve ter pelo menos uma letra." })
  .refine((s) => /\d/.test(s), { error: "A senha deve ter pelo menos um número." });

export const nomeExibicaoSchema = z
  .string({ error: MENSAGEM_NOME_INVALIDO })
  .trim()
  .min(1, { error: MENSAGEM_NOME_INVALIDO })
  .max(80, { error: MENSAGEM_NOME_INVALIDO });

/** WhatsApp: entrada livre brasileira -> E.164. */
export const whatsappSchema = z
  .string({ error: "Informe o número de WhatsApp." })
  .transform((v, ctx) => {
    const r = normalizarWhatsappBR(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.mensagem });
      return z.NEVER;
    }
    return r.e164;
  });

export const cadastroSchema = z.object({
  email: emailSchema,
  senha: senhaSchema,
  nomeExibicao: nomeExibicaoSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Login não aplica regra de composição: contas antigas podem ter outra regra.
  senha: z.string({ error: "Informe a senha." }).min(1, { error: "Informe a senha." }),
});

export const solicitarRecuperacaoSchema = z.object({ email: emailSchema });

export const redefinirSenhaSchema = z
  .object({
    novaSenha: senhaSchema,
    confirmacao: z.string({ error: "Confirme a senha." }),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    error: "As senhas não conferem.",
    path: ["confirmacao"],
  });

export const reenviarConfirmacaoSchema = z.object({ email: emailSchema });

export const atualizarWhatsappSchema = z.object({ whatsapp: whatsappSchema });

export type Cadastro = z.infer<typeof cadastroSchema>;
export type Login = z.infer<typeof loginSchema>;
export type SolicitarRecuperacao = z.infer<typeof solicitarRecuperacaoSchema>;
export type RedefinirSenha = z.infer<typeof redefinirSenhaSchema>;
export type ReenviarConfirmacao = z.infer<typeof reenviarConfirmacaoSchema>;
export type AtualizarWhatsapp = z.infer<typeof atualizarWhatsappSchema>;
