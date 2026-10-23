/** Interface pública do módulo administracao (fila de revisão, decisão, resultado). Administração mínima da Fase 2 (D-006). */
export { ALVOS_REVISAO, decidirRevisaoSchema } from "./schemas";
export type { AlvoRevisao, DecidirRevisao } from "./schemas";
export {
  podeDecidir,
  paraItemFila,
  ordenarFila,
  resultadoDaRevisao,
  ordenarResultados,
} from "./modelos";
export type { LinhaFila, ItemFila, LinhaResultadoRevisao, ResultadoRevisao } from "./modelos";
export { MENSAGENS_ADMINISTRACAO, mapearErroBancoAdministracao } from "./erros";
export type { ErroAdministracao, CodigoErroAdministracao } from "./erros";
export { criarServicoAdministracao, NOTIFICADOR_REVISAO_NULO } from "./servico";
export type {
  ServicoAdministracao,
  ClienteBancoAdministracao,
  NotificadorRevisao,
  EventoRevisaoDecidida,
} from "./servico";
