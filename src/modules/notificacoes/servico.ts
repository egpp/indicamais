import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type { RespostaBanco, Resultado as ResultadoBase } from "@/shared/conteudo/resultado";
import {
  erroNotificacoes,
  mapearErroBancoNotificacoes,
  MENSAGENS_NOTIFICACOES,
  type ErroNotificacoes,
} from "./erros";
import {
  maisRecentes,
  paraAviso,
  paraMinhaIndicacao,
  paraQuemMeIndicou,
  type AbaMinhasIndicacoes,
  type AbaQuemMeIndicou,
  type Aviso,
  type LinhaAviso,
  type LinhaMinhaIndicacao,
  type LinhaQuemMeIndicou,
} from "./modelos";
import { marcarLidaSchema, type OrigemAviso } from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroNotificacoes>;

/**
 * Banco injetado. Sessão do usuário; NUNCA service_role. Cada método é 1:1 a uma visão ou RPC das migrações
 * 20261101120000 e 20261030120000; o adaptador real fica em src/app/_lib/banco-notificacoes.ts.
 */
export interface ClienteBancoNotificacoesApp {
  /** select de notificacoes_meus_avisos (derivada; filtro fixo por auth.uid()). */
  listarMeusAvisos(): Promise<RespostaBanco<LinhaAviso[]>>;
  /** rpc notificacoes_contar_nao_lidas(). */
  contarNaoLidas(): Promise<RespostaBanco<number>>;
  /** rpc notificacoes_marcar_lida(p_origem, p_origem_id) -> true se marcou agora. */
  marcarLida(a: { origem: OrigemAviso; origemId: string }): Promise<RespostaBanco<boolean>>;
  /** rpc notificacoes_marcar_todas_lidas() -> quantos foram marcados agora. */
  marcarTodasLidas(): Promise<RespostaBanco<number>>;
  /** select de notificacoes_quem_me_indicou. */
  listarQuemMeIndicou(): Promise<RespostaBanco<LinhaQuemMeIndicou[]>>;
  /** select de indicacoes_minhas_indicacoes (visão do módulo indicacoes; aqui só leitura, sem duplicar registro). */
  listarMinhasIndicacoes(): Promise<RespostaBanco<LinhaMinhaIndicacao[]>>;
}

const M = MENSAGENS_NOTIFICACOES;
const falha = (erro: ErroNotificacoes): { ok: false; erro: ErroNotificacoes } => ({
  ok: false,
  erro,
});

export function criarServicoNotificacoes(banco: ClienteBancoNotificacoesApp) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroNotificacoes("ERRO_INTERNO", M.generica));
    }
  }

  async function lista<L, T extends { criadoEm: string }>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoNotificacoes(r.erro));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: maisRecentes(itens) };
  }

  return {
    /** IM-047, IM-051, IM-052: avisos do sino, mais recentes primeiro. Só contato válido, curtida e revisão. */
    meusAvisos: (): Promise<Resultado<Aviso[]>> =>
      seguro(() => lista(() => banco.listarMeusAvisos(), paraAviso)),

    /** IM-052: contador de não lidas do sino. */
    contarNaoLidas: (): Promise<Resultado<number>> =>
      seguro(async () => {
        const r = await banco.contarNaoLidas();
        if (r.erro) return falha(mapearErroBancoNotificacoes(r.erro));
        return { ok: true, valor: typeof r.dados === "number" && r.dados > 0 ? r.dados : 0 };
      }),

    /** IM-052: marca UM aviso como lido. Aviso alheio ou inexistente responde igual (não encontrado). */
    marcarLida: (entrada: unknown): Promise<Resultado<{ alterou: boolean }>> =>
      seguro(async () => {
        const p = marcarLidaSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroNotificacoes("VALIDACAO", Object.values(campos)[0] ?? M.dadosInvalidos, campos),
          );
        }
        const r = await banco.marcarLida({ origem: p.data.origem, origemId: p.data.origemId });
        if (r.erro) return falha(mapearErroBancoNotificacoes(r.erro));
        return { ok: true, valor: { alterou: r.dados === true } };
      }),

    /** IM-052: marca todos os avisos da conta como lidos; devolve quantos mudaram agora. */
    marcarTodasLidas: (): Promise<Resultado<{ marcadas: number }>> =>
      seguro(async () => {
        const r = await banco.marcarTodasLidas();
        if (r.erro) return falha(mapearErroBancoNotificacoes(r.erro));
        return { ok: true, valor: { marcadas: typeof r.dados === "number" ? r.dados : 0 } };
      }),

    /** IM-048, IM-050: aba "Quem me indicou" com total. Indicador só por nome público; quem saiu fica sem nome. */
    quemMeIndicou: (): Promise<Resultado<AbaQuemMeIndicou>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarQuemMeIndicou(), paraQuemMeIndicou);
        return r.ok ? { ok: true, valor: { total: r.valor.length, itens: r.valor } } : r;
      }),

    /** IM-049, IM-029: aba "Minhas indicações" com contagem. Destino, data e status; nada do visitante. */
    minhasIndicacoes: (): Promise<Resultado<AbaMinhasIndicacoes>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarMinhasIndicacoes(), paraMinhaIndicacao);
        return r.ok ? { ok: true, valor: { total: r.valor.length, itens: r.valor } } : r;
      }),
  };
}

export type ServicoNotificacoes = ReturnType<typeof criarServicoNotificacoes>;
