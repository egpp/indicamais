import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type { RespostaBanco, Resultado as ResultadoBase } from "@/shared/conteudo/resultado";
import {
  erroRelacionamento,
  mapearErroBancoRelacionamento,
  MENSAGENS_RELACIONAMENTO,
  type ErroRelacionamento,
} from "./erros";
import {
  maisRecentes,
  paraMembroDaBase,
  paraMinhaParticipacao,
  paraResumoDaBase,
  type LinhaMeuMembro,
  type LinhaMeuResumo,
  type LinhaMinhaParticipacao,
  type MembroDaBase,
  type MinhaParticipacao,
  type ResultadoAcaoBase,
  type ResumoDaBase,
} from "./modelos";
import { perfilIdSchema } from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroRelacionamento>;

/**
 * Banco injetado. Sessão do usuário; NUNCA service_role. Cada método é uma chamada 1:1 a RPC ou visão das migrações
 * 20261101*; o adaptador real fica em src/app/_lib/banco-relacionamento.ts.
 */
export interface ClienteBancoRelacionamento {
  /** rpc relacionamento_curtir(p_perfil_id) -> true se curtiu agora, false se já curtia. */
  curtir(a: { perfilId: string }): Promise<RespostaBanco<boolean>>;
  /** rpc relacionamento_descurtir(p_perfil_id) -> true se descurtiu agora. */
  descurtir(a: { perfilId: string }): Promise<RespostaBanco<boolean>>;
  /** rpc relacionamento_sair_da_base(p_perfil_id) -> true se saiu agora. */
  sairDaBase(a: { perfilId: string }): Promise<RespostaBanco<boolean>>;
  /** select de relacionamento_meus_membros (filtro fixo por auth.uid() no banco). */
  listarMeusMembros(): Promise<RespostaBanco<LinhaMeuMembro[]>>;
  /** select de relacionamento_meu_resumo. */
  lerMeuResumo(): Promise<RespostaBanco<LinhaMeuResumo[]>>;
  /** select de relacionamento_minhas_participacoes. */
  listarMinhasParticipacoes(): Promise<RespostaBanco<LinhaMinhaParticipacao[]>>;
}

const M = MENSAGENS_RELACIONAMENTO;
const falha = (erro: ErroRelacionamento): { ok: false; erro: ErroRelacionamento } => ({
  ok: false,
  erro,
});

export function criarServicoRelacionamento(banco: ClienteBancoRelacionamento) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroRelacionamento("ERRO_INTERNO", M.generica));
    }
  }

  /** Valida a entrada no limite do módulo e executa a ação do banco. */
  function acao(
    entrada: unknown,
    chamar: (a: { perfilId: string }) => Promise<RespostaBanco<boolean>>,
  ): Promise<Resultado<ResultadoAcaoBase>> {
    return seguro(async () => {
      const p = perfilIdSchema.safeParse(entrada);
      if (!p.success) {
        const campos = errosPorCampo(p.error);
        return falha(
          erroRelacionamento("VALIDACAO", Object.values(campos)[0] ?? M.dadosInvalidos, campos),
        );
      }
      const r = await chamar({ perfilId: p.data.perfilId });
      if (r.erro) return falha(mapearErroBancoRelacionamento(r.erro));
      return { ok: true, valor: { alterou: r.dados === true } };
    });
  }

  async function lista<L, T>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoRelacionamento(r.erro));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: itens };
  }

  return {
    /** IM-043: curtir exige login, não pontua nem gera comissão (IM-042). Repetir é inofensivo (`alterou: false`). */
    curtir: (entrada: unknown) => acao(entrada, (a) => banco.curtir(a)),

    /** IM-043, IM-045: remove só a curtida; quem tem indicação válida permanece na base. */
    descurtir: (entrada: unknown) => acao(entrada, (a) => banco.descurtir(a)),

    /** IM-045: ação da própria pessoa; sai da base do perfil e encerra os avisos dela. */
    sairDaBase: (entrada: unknown) => acao(entrada, (a) => banco.sairDaBase(a)),

    /** IM-039, IM-040, IM-041: membros dos perfis do responsável, só nome público, datas e contagens. */
    listarMembros: (): Promise<Resultado<MembroDaBase[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarMeusMembros(), paraMembroDaBase);
        return r.ok ? { ok: true, valor: maisRecentes(r.valor) } : r;
      }),

    /** IM-039, IM-045: totais por perfil do responsável (inclui saídas, agregado e anônimo). */
    resumo: (): Promise<Resultado<ResumoDaBase[]>> =>
      seguro(() => lista(() => banco.lerMeuResumo(), paraResumoDaBase)),

    /** IM-043, IM-045: bases em que a pessoa logada está. */
    minhasParticipacoes: (): Promise<Resultado<MinhaParticipacao[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarMinhasParticipacoes(), paraMinhaParticipacao);
        return r.ok ? { ok: true, valor: maisRecentes(r.valor) } : r;
      }),
  };
}

export type ServicoRelacionamento = ReturnType<typeof criarServicoRelacionamento>;
