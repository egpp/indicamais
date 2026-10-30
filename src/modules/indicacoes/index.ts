/**
 * Interface pública do módulo indicacoes (links de indicação, pedidos de contato, notificação ao responsável).
 * Fase 3: IM-024 a IM-029, IM-034 (registro da suspeita), IM-041, IM-050. Nada de pontos, Base de
 * Relacionamento nem Curtir (IM-043 e IM-044 pendentes). Outros módulos importam só daqui.
 */
export { criarServicoIndicacoes, novaChaveContato } from "./servico";
export type {
  ServicoIndicacoes,
  ClienteBancoIndicacoes,
  OpcoesServicoIndicacoes,
  LinkGerado,
  ContatoEnviado,
  Resultado,
} from "./servico";
export {
  criarServicoNotificacoesContato,
  montarEmailNovoPedido,
  sanitizarErroNotificacao,
  ENVIADOR_EMAIL_SEM_PROVEDOR,
  ERRO_PROVEDOR_NAO_CONFIGURADO,
  ERRO_LIMITE_TENTATIVAS,
  ERRO_SEM_EMAIL,
} from "./notificacoes";
export type {
  EnviadorEmail,
  EmailParaEnviar,
  ResultadoEnvio,
  ClienteBancoNotificacoes,
  LinhaNotificacaoPendente,
  OpcoesProcessamento,
  ResumoProcessamento,
  ResultadoProcessamento,
  ServicoNotificacoesContato,
} from "./notificacoes";
export {
  MENSAGENS_INDICACOES,
  mapearErroBancoIndicacoes,
  refinarErroPorEstadoDaConta,
} from "./erros";
export type { ErroIndicacoes, CodigoErroIndicacoes, OperacaoIndicacoes } from "./erros";
export {
  enviarContatoSchema,
  gerarLinkSchema,
  normalizarWhatsappVisitante,
  CANAIS_COMPARTILHAMENTO,
} from "./schemas";
export type { CanalCompartilhamento, EnviarContato, DestinoLink } from "./schemas";
export type {
  PedidoContato,
  MinhaIndicacao,
  MeuLink,
  ContatoAdmin,
  Parametro,
  TipoDestino,
  LinhaMeuPedido,
  LinhaMinhaIndicacao,
  LinhaMeuLink,
  LinhaFilaContato,
  LinhaParametro,
} from "./modelos";
