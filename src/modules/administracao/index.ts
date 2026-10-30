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

// Permissões, denúncias, suspensão e invalidação de indicações (Fase 6, D-014: IM-076, IM-077, IM-080).
export {
  PERMISSOES,
  ROTULOS_PERMISSAO,
  ALVOS_DENUNCIA,
  TIPOS_DENUNCIA,
  ROTULOS_TIPO_DENUNCIA,
  SITUACOES_DENUNCIA,
  DECISOES_DENUNCIA,
  LIMITES_CICLO,
  permissaoContaSchema,
  denunciarSchema,
  decidirDenunciaSchema,
  contaMotivoSchema,
  invalidarIndicacaoSchema,
} from "./ciclo-schemas";
export type {
  Permissao,
  AlvoDenuncia,
  TipoDenuncia,
  SituacaoDenuncia,
  DecisaoDenuncia,
  PermissaoConta,
  Denunciar,
  DecidirDenuncia,
  ContaMotivo,
  InvalidarIndicacao,
} from "./ciclo-schemas";
export {
  paraPermissaoConcedida,
  paraMinhasPermissoes,
  paraDenunciaNaFila,
  ordenarDenuncias,
  paraDecisaoDeDenuncia,
  paraContaForaDoNormal,
  paraIndicacaoInvalidada,
} from "./ciclo-modelos";
export type {
  LinhaMinhaPermissao,
  LinhaPermissaoConcedida,
  LinhaDenunciaFila,
  LinhaDenunciaDecisao,
  LinhaContaCicloVida,
  LinhaIndicacaoInvalidada,
  PermissaoConcedida,
  DenunciaNaFila,
  DecisaoDeDenuncia,
  ContaForaDoNormal,
  IndicacaoInvalidada,
} from "./ciclo-modelos";
export { MENSAGENS_CICLO, mapearErroBancoCiclo } from "./erros-ciclo";
export type { OperacaoCiclo } from "./erros-ciclo";
export { criarServicoCicloVida, APLICADOR_BLOQUEIO_NULO } from "./servico-ciclo-vida";
export type {
  ServicoCicloVida,
  ClienteBancoCicloVida,
  AplicadorBloqueioAcesso,
} from "./servico-ciclo-vida";
