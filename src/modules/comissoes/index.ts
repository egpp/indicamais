/**
 * Interface pública do módulo comissoes (Fase 7): comissão mononível sobre assinaturas recorrentes registradas
 * manualmente. IM-061 a IM-073, D-025, D-026. Sem cobrança, repasse automático nem integração financeira (IM-090;
 * IM-074 é futuro). Saldos, regras e histórico são próprios: nada altera pontos, relacionamento ou social (IM-065).
 * Outros módulos importam só daqui.
 */
export { criarServicoComissoes } from "./servico";
export type {
  ServicoComissoes,
  ClienteBancoComissoes,
  OpcoesServicoComissoes,
  Resultado,
} from "./servico";
export { MENSAGENS_COMISSOES, mapearErroBancoComissoes } from "./erros";
export type { ErroComissoes, CodigoErroComissoes } from "./erros";
export {
  MOTIVO_MIN,
  MOTIVO_MAX,
  CENTAVOS_MAX,
  PERCENTUAL_BP_MIN,
  PERCENTUAL_BP_MAX,
  CAUSAS_REVERSAO,
  ESTADOS_REPASSE,
  competenciaSchema,
  motivoSchema,
  PARAMETRO_PRAZO_INADIMPLENCIA,
  PARAMETRO_AVISO_ANTECEDENCIA,
  PARAMETROS_LEITURA,
  definirParametroSchema,
  definirHabilitacaoSchema,
  registrarVinculoSchema,
  registrarAssinaturaSchema,
  cancelarAssinaturaSchema,
  confirmarPagamentoSchema,
  estornarPagamentoSchema,
  reverterComissaoSchema,
  avancarRepasseSchema,
  encerrarVinculoSchema,
  criarOfertaSchema,
  alterarPercentualSchema,
  definirOfertaAtivaSchema,
} from "./schemas";
export {
  LIMITE_PADRAO,
  LIMITE_MAX,
  BUSCA_MAX,
  filtroNegociosAdminSchema,
  filtroAssinaturasAdminSchema,
  filtroPagamentosAdminSchema,
  filtroComissoesAdminSchema,
  filtroVinculosAdminSchema,
} from "./schemas-admin";
export type {
  Pagina,
  NegocioAdmin,
  AssinaturaAdmin,
  PagamentoAdmin,
  ComissaoAdmin,
  VinculoAdmin,
  PrazoInadimplencia,
  ParametroComissoes,
  NegocioVinculado,
  LinhaNegocioAdmin,
  LinhaAssinaturaAdmin,
  LinhaPagamentoAdmin,
  LinhaComissaoAdmin,
  LinhaVinculoAdmin,
  LinhaPrazoAdmin,
  LinhaNegocioVinculado,
} from "./modelos-admin";
export type {
  EstadoComissao,
  CausaReversao,
  MinhaComissao,
  MeuSaldoComissoes,
  MinhaSituacao,
  MeuNegocio,
  MinhaOferta,
  ComissaoDoNegocio,
  VinculoDoNegocio,
  SituacaoVinculo,
  VinculoVencido,
  LinhaMinhaComissao,
  LinhaMeuSaldo,
  LinhaMinhaSituacao,
  LinhaMeuNegocio,
  LinhaMinhaOferta,
  LinhaNegocioComissao,
  LinhaNegocioVinculo,
  LinhaSituacaoVinculo,
  LinhaVinculoVencido,
} from "./modelos";
