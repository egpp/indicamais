/** Interface pública do módulo busca (busca e filtros públicos, IM-019). Outros módulos importam só daqui. */
export { TIPOS_BUSCA, filtrosBuscaSchema } from "./schemas";
export type { TipoBusca, FiltrosBusca } from "./schemas";
export { paraCard, paraPagina } from "./modelos";
export type { CardBusca, LinhaBusca, PaginaBusca } from "./modelos";
export { MENSAGENS_BUSCA, mapearErroBancoBusca } from "./erros";
export type { ErroBusca, CodigoErroBusca } from "./erros";
export { CHAVES_SECAO_HOME, validarLocalizacaoHome, chaveCacheHome } from "./home-schemas";
export type { ChaveSecaoHome, LocalizacaoHome } from "./home-schemas";
export { paraCardDaHome, paraParametroSecao } from "./home-modelos";
export type {
  LinhaSecaoHome,
  LinhaPerfilHome,
  SecaoHome,
  ParametroSecaoHome,
  PerfilParaCidade,
} from "./home-modelos";
export { criarServicoHome, escolherLocalizacaoHome } from "./home-servico";
export type {
  ServicoHome,
  ClienteBancoHome,
  ParamsHomeSecoes,
  ParamsHomeSecaoPerfis,
  ResultadoHome,
} from "./home-servico";
export { criarServicoBusca } from "./servico";
export type {
  ServicoBusca,
  ClienteBancoBusca,
  ParamsBuscaPublica,
  FiltrosDisponiveis,
  SecaoProdutosEServicos,
} from "./servico";
