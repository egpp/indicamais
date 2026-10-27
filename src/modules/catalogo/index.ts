/** Interface pública do módulo catalogo (itens, preço, categorias). Outros módulos importam só daqui. */
export {
  MODOS_PRECO,
  precoSchema,
  formatarCentavos,
  formatarPreco,
  parsearReaisParaCentavos,
  precoDeColunas,
  precoParaColunas,
} from "./preco";
export type { Preco, ModoPreco } from "./preco";
export {
  TIPOS_ITEM,
  camposItemSchema,
  novoItemSchema,
  solicitarCategoriaSchema,
  criarCategoriaSchema,
  alterarCategoriaSchema,
  decidirSolicitacaoSchema,
} from "./schemas";
export type { CamposItem, NovoItem, TipoItem, SolicitarCategoria } from "./schemas";
export { aplicarCamposItem, pendenciasDoItem, validarConteudoItem } from "./regras";
export { conteudoDeVersao, paraItemExibicao, paraItemPublico } from "./modelos";
export type {
  ConteudoItem,
  ItemExibicao,
  LinhaItem,
  LinhaItemVersao,
  LinhaItemPublico,
  LinhaCategoria,
  LinhaSolicitacao,
  ColunasVersaoItem,
  DadosCriarItem,
} from "./modelos";
export { MENSAGENS_CATALOGO, mapearErroBancoCatalogo } from "./erros";
export type { ErroCatalogo, CodigoErroCatalogo } from "./erros";
export { criarServicoItens, montarMeuItem } from "./servico-itens";
export type {
  ServicoItens,
  ClienteBancoItens,
  MeuItem,
  PreviaItem,
  VersaoParaRevisaoItem,
} from "./servico-itens";
export { criarServicoCategorias, paraCategoria, paraSolicitacao } from "./servico-categorias";
export type {
  ServicoCategorias,
  ClienteBancoCategorias,
  Categoria,
  CategoriaAdmin,
  Solicitacao,
} from "./servico-categorias";
