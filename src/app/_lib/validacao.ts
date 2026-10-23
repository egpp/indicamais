import {
  cadastroSchema,
  loginSchema,
  nomeExibicaoSchema,
  atualizarWhatsappSchema,
  redefinirSenhaSchema,
  reenviarConfirmacaoSchema,
  solicitarRecuperacaoSchema,
} from "@/modules/contas";
import { errosPorCampo } from "./estado-formulario";

/**
 * Validação no navegador com os MESMOS schemas do servidor (módulo contas).
 * Devolve null se válido, ou { campo: mensagem }.
 */
type Dados = Record<string, string>;
type Erros = Record<string, string> | null;

function aplicar(
  r: { success: true } | { success: false; error: { issues: Parameters<typeof errosPorCampo>[0] } },
): Erros {
  return r.success ? null : errosPorCampo(r.error.issues);
}

export const validarCadastro = (d: Dados): Erros => {
  const nome = (d.nomeExibicao ?? "").trim();
  return aplicar(
    cadastroSchema.safeParse({
      email: d.email ?? "",
      senha: d.senha ?? "",
      nomeExibicao: nome === "" ? undefined : nome,
    }),
  );
};
export const validarLogin = (d: Dados): Erros =>
  aplicar(loginSchema.safeParse({ email: d.email ?? "", senha: d.senha ?? "" }));
export const validarEmail = (d: Dados): Erros =>
  aplicar(solicitarRecuperacaoSchema.safeParse({ email: d.email ?? "" }));
export const validarReenvio = (d: Dados): Erros =>
  aplicar(reenviarConfirmacaoSchema.safeParse({ email: d.email ?? "" }));
export const validarRedefinicao = (d: Dados): Erros =>
  aplicar(
    redefinirSenhaSchema.safeParse({
      novaSenha: d.novaSenha ?? "",
      confirmacao: d.confirmacao ?? "",
    }),
  );
export const validarNome = (d: Dados): Erros => {
  const r = nomeExibicaoSchema.safeParse(d.nomeExibicao ?? "");
  return r.success ? null : { nomeExibicao: r.error.issues[0]?.message ?? "Nome inválido." };
};
export const validarWhatsapp = (d: Dados): Erros =>
  aplicar(atualizarWhatsappSchema.safeParse({ whatsapp: d.whatsapp ?? "" }));
