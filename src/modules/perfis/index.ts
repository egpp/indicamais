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
} from "./modelos";
export { MENSAGENS_PERFIS, mapearErroBancoPerfis } from "./erros";
export type { ErroPerfis, CodigoErroPerfis } from "./erros";
export { criarServicoPerfis, montarMeuPerfil } from "./servico";
export type { ServicoPerfis, ClienteBancoPerfis, MeuPerfil, PreviaPerfil } from "./servico";
