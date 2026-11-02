/** Interface pública do módulo perfis (perfil comercial, versões, slug). Outros módulos importam só daqui. */
export { UFS, camposPerfilSchema, novoPerfilSchema, informacoesSociaisSchema } from "./schemas";
export type { CamposPerfil, NovoPerfil } from "./schemas";
export {
  SLUGS_RESERVADOS,
  slugReservado,
  validarSlug,
  gerarSlugDeNome,
  candidatosDeSlug,
} from "./slug";
export type { ResultadoSlug } from "./slug";
export { pareceLinkOuRede, normalizarSite } from "./texto-livre";
export { aplicarCamposPerfil, pendenciasDoPerfil, validarConteudoPerfil } from "./regras";
export { conteudoDeVersao, paraPerfilExibicao, paraPerfilPublico } from "./modelos";
export type {
  ConteudoPerfil,
  PerfilExibicao,
  LinhaPerfil,
  LinhaVersaoPerfil,
  LinhaPerfilPublico,
  ColunasVersaoPerfil,
  DadosCriarPerfil,
  DadosGravarVersaoPerfil,
} from "./modelos";
export { MENSAGENS_PERFIS, mapearErroBancoPerfis } from "./erros";
export type { ErroPerfis, CodigoErroPerfis } from "./erros";
export { criarServicoPerfis, montarMeuPerfil } from "./servico";
export type {
  ServicoPerfis,
  ClienteBancoPerfis,
  MeuPerfil,
  PreviaPerfil,
  VersaoParaRevisaoPerfil,
} from "./servico";
export {
  criarServicoAparencia,
  estiloEfetivo,
  paraBannerPublico,
  paraBannerAguardando,
  paraBannerAdmin,
  mapearErroBancoAparencia,
  gravarBannersSchema,
  definirEstiloSchema,
  responderBannerSchema,
  definirEstiloHabilitadoSchema,
  adicionarBannerAdminSchema,
  removerBannerAdminSchema,
  TEXTO_ALTERNATIVO_MAX,
  ESTILO_PADRAO,
  DESTINOS_SECAO_BANNER,
  LIMITE_BANNERS,
  MENSAGENS_APARENCIA,
} from "./aparencia";
export type {
  ServicoAparencia,
  ClienteBancoAparencia,
  EstiloPagina,
  BannerPublico,
  BannerAguardando,
  BannerAdmin,
  DestinoSecaoBanner,
  LinhaBannerPublico,
  LinhaBannerAguardando,
  LinhaBannerAdmin,
} from "./aparencia";
