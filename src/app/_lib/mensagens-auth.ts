/** Textos de tela da autenticação (pt-BR). As mensagens de privacidade vêm do módulo contas. */

export const MENSAGEM_CADASTRO_ENVIADO =
  "Enviamos as instruções para o e-mail informado. Confira a caixa de entrada e a pasta de spam.";
export const MENSAGEM_EMAIL_NAO_CONFIRMADO =
  "Confirme seu e-mail para entrar. Se precisar, peça um novo link.";
export const MENSAGEM_GOOGLE_INDISPONIVEL =
  "O login com Google não está disponível no momento. Entre com e-mail e senha.";
export const MENSAGEM_LINK_INVALIDO =
  "Este link é inválido ou expirou. Peça um novo para continuar.";
export const MENSAGEM_SENHA_IGUAL = "A nova senha deve ser diferente da atual.";
export const MENSAGEM_SENHA_FRACA = "Esta senha é fraca ou muito comum. Escolha outra.";
export const MENSAGEM_SESSAO_EXPIRADA = "Sua sessão expirou. Entre novamente.";
export const MENSAGEM_LIMITE_TENTATIVAS =
  "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
export const MENSAGEM_NOME_SALVO = "Nome atualizado.";
export const MENSAGEM_WHATSAPP_SALVO = "WhatsApp salvo. Ele ainda não foi verificado.";

/** Mensagens da página de entrada por chave na URL (nunca refletir texto da URL). */
export const AVISOS_ENTRADA: Record<string, string> = {
  link_invalido: MENSAGEM_LINK_INVALIDO,
  oauth: "Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.",
  confirmado: "E-mail confirmado. Agora é só entrar.",
  sessao: MENSAGEM_SESSAO_EXPIRADA,
};

/** Mesmo texto genérico do módulo contas (não exportado pelo index; ver dúvidas ao gestor). */
export const MENSAGEM_ERRO_TELA = "Não foi possível concluir agora. Tente novamente em instantes.";
