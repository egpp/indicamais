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
export {
  MENSAGENS_ADMINISTRACAO,
  mapearErroBancoAdministracao,
  mapearErroBancoPatrocinador,
} from "./erros";
export type { ErroAdministracao, CodigoErroAdministracao } from "./erros";
export { criarServicoAdministracao, NOTIFICADOR_REVISAO_NULO } from "./servico";
export type {
  ServicoAdministracao,
  ClienteBancoAdministracao,
  NotificadorRevisao,
  EventoRevisaoDecidida,
} from "./servico";

// Patrocinadores do carrossel (IM-020, D-008).
export {
  criarPatrocinadorSchema,
  alterarPatrocinadorSchema,
  definirPatrocinadorAtivoSchema,
} from "./patrocinador-schemas";
export type {
  CriarPatrocinador,
  AlterarPatrocinador,
  DefinirPatrocinadorAtivo,
} from "./patrocinador-schemas";
export {
  paraPatrocinadorPublico,
  montarCarrossel,
  situacaoDoPatrocinador,
  paraPatrocinadorAdmin,
} from "./patrocinador-modelos";
export type {
  LinhaPatrocinadorPublico,
  LinhaPatrocinadorAdmin,
  PatrocinadorPublico,
  PatrocinadorAdmin,
  DestinoPatrocinador,
  SituacaoPatrocinador,
} from "./patrocinador-modelos";
export { criarServicoPatrocinadores } from "./servico-patrocinadores";
export type {
  ServicoPatrocinadores,
  ClienteBancoPatrocinadores,
  ParamsCriarPatrocinador,
  ParamsAlterarPatrocinador,
  ParamsDefinirPatrocinadorAtivo,
} from "./servico-patrocinadores";

// Consulta somente leitura de perfis e itens (D-009, IM-021, IM-077 parte).
export {
  criarServicoConsultaNegocios,
  filtroNegociosSchema,
  escaparCuringasLike,
  paraNegocioConsultado,
  rotuloSituacaoNegocio,
  POR_PAGINA_NEGOCIOS,
  SITUACOES_NEGOCIO,
  TIPOS_NEGOCIO,
} from "./consulta-negocios";
export type {
  ClienteBancoConsultaNegocios,
  ConsultaBanco,
  LinhaConsultaNegocio,
  NegocioConsultado,
  PaginaNegocios,
  ServicoConsultaNegocios,
  FiltroNegociosEntrada,
} from "./consulta-negocios";
