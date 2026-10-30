/** Interface pública do módulo contas. Outros módulos importam só daqui. */
export { normalizarWhatsappBR } from "./whatsapp";
export type { ResultadoWhatsapp, CodigoErroWhatsapp } from "./whatsapp";
export {
  cadastroSchema,
  loginSchema,
  solicitarRecuperacaoSchema,
  redefinirSenhaSchema,
  reenviarConfirmacaoSchema,
  atualizarWhatsappSchema,
  nomeExibicaoSchema,
  emailSchema,
  senhaSchema,
  whatsappSchema,
} from "./schemas";
export type {
  Cadastro,
  Login,
  SolicitarRecuperacao,
  RedefinirSenha,
  ReenviarConfirmacao,
  AtualizarWhatsapp,
} from "./schemas";
export { podeIndicar, whatsappApresentavelComoVerificado } from "./regras";
export {
  MENSAGEM_WHATSAPP_INDISPONIVEL,
  MENSAGEM_RECUPERACAO_SOLICITADA,
  MENSAGEM_CONFIRMACAO_REENVIADA,
  MENSAGEM_LOGIN_INVALIDO,
} from "./mensagens";
export { mapearErroBanco } from "./erros";
export type { ErroConta, CodigoErroConta, ErroBanco } from "./erros";
export { criarServicoContas, paraConta } from "./servico";
export type {
  ServicoContas,
  ClienteBancoContas,
  Conta,
  LinhaConta,
  RespostaBanco,
  Resultado,
} from "./servico";

// Ciclo de vida da própria conta (Fase 6, D-014: IM-080, IM-081, IM-082).
export {
  PALAVRA_CONFIRMACAO_ENCERRAMENTO,
  MENSAGENS_CICLO_CONTA,
  SITUACOES_CONTA,
  solicitarEncerramentoSchema,
  paraEstadoDaConta,
  mapearErroCicloConta,
  criarServicoCicloVidaConta,
} from "./ciclo-vida";
export type {
  SituacaoConta,
  EstadoDaConta,
  LinhaMeuEstado,
  SolicitarEncerramento,
  ResultadoCiclo,
  ClienteBancoCicloVidaConta,
  ServicoCicloVidaConta,
} from "./ciclo-vida";
