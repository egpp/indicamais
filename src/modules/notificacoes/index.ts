/**
 * Interface pública do módulo notificacoes (Fase 5): avisos no app (sino), leitura e abas "Quem me indicou" e
 * "Minhas indicações". IM-047 a IM-053, D-013. Só contato válido, curtida e resultado de revisão geram aviso; nenhum
 * aviso afirma compartilhamento externo (IM-051). O envio de e-mail ao responsável continua no módulo indicacoes
 * (provedor pendente). Outros módulos importam só daqui.
 */
export { criarServicoNotificacoes } from "./servico";
export type {
  ServicoNotificacoes,
  ClienteBancoNotificacoesApp,
  Resultado as ResultadoNotificacoes,
} from "./servico";
export { MENSAGENS_NOTIFICACOES, mapearErroBancoNotificacoes } from "./erros";
export type { ErroNotificacoes, CodigoErroNotificacoes } from "./erros";
export { ORIGENS_AVISO, marcarLidaSchema } from "./schemas";
export type { OrigemAviso } from "./schemas";
export { TIPOS_AVISO, textoDoAviso } from "./textos";
export type { TipoAviso } from "./textos";
export type {
  Aviso,
  QuemMeIndicou,
  MinhaIndicacao as MinhaIndicacaoAba,
  AbaQuemMeIndicou,
  AbaMinhasIndicacoes,
  TipoDestino as TipoDestinoAviso,
  LinhaAviso,
  LinhaQuemMeIndicou,
  LinhaMinhaIndicacao as LinhaMinhaIndicacaoAba,
} from "./modelos";
