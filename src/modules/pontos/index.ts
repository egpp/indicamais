/**
 * Interface pública do módulo pontos (Fase 4): saldo e histórico do indicador, parâmetros centrais, reversão e
 * reprocessamento, consultas administrativas e cadastro de benefícios. IM-028, IM-030 a IM-036, IM-077, IM-078.
 * NÃO existe resgate, cupom, sorteio nem prêmio (IM-037 e IM-038 são futuros). Pontos não alteram comissões nem
 * relacionamento (IM-042, IM-059, IM-065). Outros módulos importam só daqui.
 */
export { criarServicoPontos } from "./servico";
export type {
  ServicoPontos,
  ClienteBancoPontos,
  OpcoesServicoPontos,
  CamposBeneficioBanco,
  Resultado,
} from "./servico";
export { MENSAGENS_PONTOS, mapearErroBancoPontos } from "./erros";
export type { ErroPontos, CodigoErroPontos, OperacaoPontos } from "./erros";
export {
  CATEGORIAS_REVERSAO,
  ROTULOS_CATEGORIA_REVERSAO,
  CHAVES_PARAMETRO_PONTOS,
  reverterCreditoSchema,
  definirParametroSchema,
  reprocessarPedidoSchema,
  criarBeneficioSchema,
  salvarBeneficioSchema,
  adminCadastrarBeneficioSchema,
  decidirBeneficioSchema,
  editarPropostaBeneficioSchema,
  responderPropostaSchema,
} from "./schemas";
export type { CategoriaReversao, ChaveParametroPontos, ReverterCredito } from "./schemas";
export { ROTULOS_MOTIVO_DECISAO, hojeSaoPaulo, prazoResgateVigente } from "./modelos";
export type {
  MeuSaldo,
  MeuLancamento,
  ParametrosPontos,
  LancamentoAdmin,
  SaldoAdmin,
  DecisaoAdmin,
  MotivoDecisao,
  FalhaCredito,
  BeneficioPublico,
  BeneficioDoPerfil,
  VersaoBeneficio,
  SituacaoVersao,
  BeneficioPendente,
  BeneficioAguardandoAceite,
  PropostaAguardandoAceite,
  OrigemVersao,
  TipoLancamento,
  SituacaoLancamento,
  TipoDestinoPontos,
  LinhaMeuSaldo,
  LinhaMeuLancamento,
  LinhaParametrosAtuais,
  LinhaLancamentoAdmin,
  LinhaSaldoAdmin,
  LinhaDecisaoAdmin,
  LinhaFalhaAdmin,
  LinhaFilaBeneficio,
  LinhaAguardandoAceite,
  LinhaBeneficioPublico,
  LinhaBeneficio,
  LinhaBeneficioVersao,
  LinhaBeneficioRevisao,
  LinhasBeneficiosDoPerfil,
} from "./modelos";
