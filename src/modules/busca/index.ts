/** Interface pública do módulo busca (busca e filtros públicos, IM-019). Outros módulos importam só daqui. */
export { TIPOS_BUSCA, filtrosBuscaSchema } from "./schemas";
export type { TipoBusca, FiltrosBusca } from "./schemas";
export { paraCard, paraPagina } from "./modelos";
export type { CardBusca, LinhaBusca, PaginaBusca } from "./modelos";
export { MENSAGENS_BUSCA, mapearErroBancoBusca } from "./erros";
export type { ErroBusca, CodigoErroBusca } from "./erros";
export { criarServicoBusca } from "./servico";
export type {
  ServicoBusca,
  ClienteBancoBusca,
  ParamsBuscaPublica,
  FiltrosDisponiveis,
  SecaoProdutosEServicos,
} from "./servico";
