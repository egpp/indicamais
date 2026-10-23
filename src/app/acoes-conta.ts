"use server";

import { redirect } from "next/navigation";
import {
  MENSAGEM_CONFIRMACAO_REENVIADA,
  MENSAGEM_LOGIN_INVALIDO,
  MENSAGEM_RECUPERACAO_SOLICITADA,
  cadastroSchema,
  criarServicoContas,
  loginSchema,
  redefinirSenhaSchema,
  reenviarConfirmacaoSchema,
  solicitarRecuperacaoSchema,
} from "@/modules/contas";
import { criarClienteServidor } from "@/shared/supabase/servidor";
import { criarBancoContas } from "./_lib/banco-contas";
import { caminhoSeguro } from "./_lib/destino";
import { classificarErroAuth } from "./_lib/erro-auth";
import { errosPorCampo, type EstadoFormulario } from "./_lib/estado-formulario";
import {
  MENSAGEM_CADASTRO_ENVIADO,
  MENSAGEM_EMAIL_NAO_CONFIRMADO,
  MENSAGEM_ERRO_TELA,
  MENSAGEM_GOOGLE_INDISPONIVEL,
  MENSAGEM_LIMITE_TENTATIVAS,
  MENSAGEM_NOME_SALVO,
  MENSAGEM_SENHA_FRACA,
  MENSAGEM_SENHA_IGUAL,
  MENSAGEM_SESSAO_EXPIRADA,
  MENSAGEM_WHATSAPP_SALVO,
} from "./_lib/mensagens-auth";
import { registrarFalhaAuth } from "./_lib/log-auth";
import { origemDoApp } from "./_lib/origem";

/** Server Actions da conta. Sem regra de negócio: validam com os schemas do módulo e chamam Auth/serviço. */

const texto = (f: FormData, nome: string) => {
  const v = f.get(nome);
  return typeof v === "string" ? v : "";
};

export async function cadastrar(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const nome = texto(f, "nomeExibicao").trim();
  const valores = { email: texto(f, "email"), nomeExibicao: texto(f, "nomeExibicao") };
  const p = cadastroSchema.safeParse({
    email: valores.email,
    senha: texto(f, "senha"),
    nomeExibicao: nome === "" ? undefined : nome,
  });
  if (!p.success) return { erros: errosPorCampo(p.error.issues), valores };

  const supabase = await criarClienteServidor();
  const origem = await origemDoApp();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email,
    password: p.data.senha,
    options: {
      emailRedirectTo: `${origem}/auth/callback`,
      data: p.data.nomeExibicao ? { full_name: p.data.nomeExibicao } : {},
    },
  });
  if (error) {
    registrarFalhaAuth("cadastrar", error);
    const tipo = classificarErroAuth(error);
    if (tipo === "SENHA_FRACA") return { erros: { senha: MENSAGEM_SENHA_FRACA }, valores };
    if (tipo === "LIMITE") return { erro: MENSAGEM_LIMITE_TENTATIVAS, valores };
    return { erro: MENSAGEM_ERRO_TELA, valores };
  }
  // Confirmação desligada no painel: já há sessão.
  if (data.session) redirect("/minha-conta");
  // Resposta igual para e-mail novo ou já cadastrado (IM-008).
  return { sucesso: MENSAGEM_CADASTRO_ENVIADO };
}

export async function entrar(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const valores = { email: texto(f, "email") };
  const p = loginSchema.safeParse({ email: valores.email, senha: texto(f, "senha") });
  if (!p.success) return { erros: errosPorCampo(p.error.issues), valores };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: p.data.email,
    password: p.data.senha,
  });
  if (error) {
    const tipo = classificarErroAuth(error);
    // email_not_confirmed só ocorre com a senha correta; não revela e-mail a terceiros.
    if (tipo === "NAO_CONFIRMADO") return { erro: MENSAGEM_EMAIL_NAO_CONFIRMADO, valores };
    if (tipo === "LIMITE") return { erro: MENSAGEM_LIMITE_TENTATIVAS, valores };
    if (tipo === "CREDENCIAIS") return { erro: MENSAGEM_LOGIN_INVALIDO, valores };
    return { erro: MENSAGEM_ERRO_TELA, valores };
  }
  redirect(caminhoSeguro(texto(f, "proximo")));
}

export async function entrarComGoogle(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const origem = await origemDoApp();
  const proximo = caminhoSeguro(texto(f, "proximo"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return { erro: MENSAGEM_GOOGLE_INDISPONIVEL };

  // Provedor desligado no painel: o endpoint responde 4xx em JSON. Confere antes de enviar o usuário.
  try {
    const r = await fetch(data.url, { redirect: "manual" });
    if (r.status >= 400) return { erro: MENSAGEM_GOOGLE_INDISPONIVEL };
  } catch {
    return { erro: MENSAGEM_GOOGLE_INDISPONIVEL };
  }
  redirect(data.url);
}

export async function solicitarRecuperacao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const valores = { email: texto(f, "email") };
  const p = solicitarRecuperacaoSchema.safeParse(valores);
  if (!p.success) return { erros: errosPorCampo(p.error.issues), valores };

  try {
    const supabase = await criarClienteServidor();
    const origem = await origemDoApp();
    const { error } = await supabase.auth.resetPasswordForEmail(p.data.email, {
      redirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent("/redefinir-senha")}`,
    });
    registrarFalhaAuth("recuperar_senha", error);
  } catch {
    // Ignora de propósito: a resposta é sempre a mesma (IM-008).
    registrarFalhaAuth("recuperar_senha", { code: "excecao" });
  }
  return { sucesso: MENSAGEM_RECUPERACAO_SOLICITADA };
}

export async function reenviarConfirmacao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const valores = { email: texto(f, "email") };
  const p = reenviarConfirmacaoSchema.safeParse(valores);
  if (!p.success) return { erros: errosPorCampo(p.error.issues), valores };

  try {
    const supabase = await criarClienteServidor();
    const origem = await origemDoApp();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: p.data.email,
      options: { emailRedirectTo: `${origem}/auth/callback` },
    });
    registrarFalhaAuth("reenviar_confirmacao", error);
  } catch {
    // Resposta neutra sempre (IM-008).
    registrarFalhaAuth("reenviar_confirmacao", { code: "excecao" });
  }
  return { sucesso: MENSAGEM_CONFIRMACAO_REENVIADA };
}

export async function redefinirSenha(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const p = redefinirSenhaSchema.safeParse({
    novaSenha: texto(f, "novaSenha"),
    confirmacao: texto(f, "confirmacao"),
  });
  if (!p.success) return { erros: errosPorCampo(p.error.issues) };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: p.data.novaSenha });
  if (error) {
    switch (classificarErroAuth(error)) {
      case "SENHA_IGUAL":
        return { erros: { novaSenha: MENSAGEM_SENHA_IGUAL } };
      case "SENHA_FRACA":
        return { erros: { novaSenha: MENSAGEM_SENHA_FRACA } };
      case "SEM_SESSAO":
        return { erro: MENSAGEM_SESSAO_EXPIRADA };
      case "LIMITE":
        return { erro: MENSAGEM_LIMITE_TENTATIVAS };
      default:
        return { erro: MENSAGEM_ERRO_TELA };
    }
  }
  redirect("/minha-conta?aviso=senha");
}

export async function atualizarNome(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const valores = { nomeExibicao: texto(f, "nomeExibicao") };
  const supabase = await criarClienteServidor();
  const r = await criarServicoContas(criarBancoContas(supabase)).atualizarNomeExibicao(
    valores.nomeExibicao,
  );
  if (!r.ok) return { erros: { nomeExibicao: r.erro.mensagem }, valores };
  return { sucesso: MENSAGEM_NOME_SALVO, valores: { nomeExibicao: r.valor.nomeExibicao ?? "" } };
}

export async function atualizarWhatsapp(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const valores = { whatsapp: texto(f, "whatsapp") };
  const supabase = await criarClienteServidor();
  const r = await criarServicoContas(criarBancoContas(supabase)).atualizarWhatsapp({
    whatsapp: valores.whatsapp,
  });
  if (!r.ok) return { erros: { whatsapp: r.erro.mensagem }, valores };
  return { sucesso: MENSAGEM_WHATSAPP_SALVO };
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
