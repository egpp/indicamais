/**
 * Interface pública do módulo relacionamento (Fase 5): curtir, descurtir, sair da base, membros e resumo do
 * responsável e participações da pessoa. IM-039 a IM-045, D-013. A base não pontua nem gera comissão e não é
 * alterada por pontos ou comissões (IM-042, IM-059, IM-065). Outros módulos importam só daqui.
 */
export { criarServicoRelacionamento } from "./servico";
export type { ServicoRelacionamento, ClienteBancoRelacionamento, Resultado } from "./servico";
export { MENSAGENS_RELACIONAMENTO, mapearErroBancoRelacionamento } from "./erros";
export type { ErroRelacionamento, CodigoErroRelacionamento } from "./erros";
export { perfilIdSchema } from "./schemas";
export type {
  MembroDaBase,
  ResumoDaBase,
  MinhaParticipacao,
  ResultadoAcaoBase,
  LinhaMeuMembro,
  LinhaMeuResumo,
  LinhaMinhaParticipacao,
} from "./modelos";
