import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import {
  erroAdm,
  mapearErroBancoAdministracao,
  MENSAGENS_ADMINISTRACAO,
  type ErroAdministracao,
} from "./erros";
import {
  ordenarFila,
  ordenarResultados,
  paraItemFila,
  podeDecidir,
  resultadoDaRevisao,
  type ItemFila,
  type LinhaFila,
  type LinhaResultadoRevisao,
  type ResultadoRevisao,
} from "./modelos";
import { decidirRevisaoSchema, type AlvoRevisao } from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroAdministracao>;

/**
 * Banco injetado. Sessão do usuário (administrador ou responsável), nunca service_role: o próprio banco
 * confere o papel de administrador e recusa o dono decidindo o próprio conteúdo.
 */
export interface ClienteBancoAdministracao {
  /** Conta autenticada (auth.uid()). */
  readonly contaId: string;
  /** select em administracao_fila_pendencias (vazia para quem não é administrador). */
  listarFila(): Promise<RespostaBanco<LinhaFila[]>>;
  /** rpc perfis_decidir_versao. */
  decidirPerfil(a: {
    versaoId: string;
    aprovar: boolean;
    motivo: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc catalogo_decidir_item_versao. */
  decidirItem(a: {
    versaoId: string;
    aprovar: boolean;
    motivo: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  /**
   * select em administracao_meus_resultados: versões enviadas (pendente/aprovada/rejeitada) dos perfis e
   * itens da própria conta. A visão filtra por auth.uid(); o responsável nunca lê as tabelas de revisão.
   */
  listarMinhasRevisoes(): Promise<RespostaBanco<LinhaResultadoRevisao[]>>;
}

/** Fato ocorrido: o que o ponto de extensão recebe. Sem e-mail, telefone ou nome de visitante. */
export type EventoRevisaoDecidida = {
  alvo: AlvoRevisao;
  versaoId: string;
  decisao: "aprovada" | "rejeitada";
  /** Motivo da rejeição (vai para o responsável). */
  motivo: string | null;
  decididoPor: string;
  decididaEm: string;
  /** Dono do conteúdo, quando a fila o informou. O destinatário do e-mail é resolvido no servidor. */
  donoId: string | null;
};

/**
 * PONTO DE EXTENSÃO (IM-023, D-006): o e-mail do resultado depende de SMTP próprio e NÃO existe ainda.
 * Quando houver, implementar esta interface e injetá-la. Falha aqui nunca desfaz a decisão.
 */
export interface NotificadorRevisao {
  aoDecidir(evento: EventoRevisaoDecidida): Promise<void>;
}

export const NOTIFICADOR_REVISAO_NULO: NotificadorRevisao = { async aoDecidir() {} };

const M = MENSAGENS_ADMINISTRACAO;
const falha = (erro: ErroAdministracao): { ok: false; erro: ErroAdministracao } => ({
  ok: false,
  erro,
});

export function criarServicoAdministracao(
  banco: ClienteBancoAdministracao,
  opcoes: { notificador?: NotificadorRevisao; agora?: () => Date } = {},
) {
  const notificador = opcoes.notificador ?? NOTIFICADOR_REVISAO_NULO;
  const agora = opcoes.agora ?? (() => new Date());

  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroAdm("ERRO_INTERNO", M.generica));
    }
  }

  async function filaCompleta(): Promise<Resultado<ItemFila[]>> {
    const r = await banco.listarFila();
    if (r.erro) return falha(mapearErroBancoAdministracao(r.erro));
    return {
      ok: true,
      valor: ordenarFila((r.dados ?? []).map((l) => paraItemFila(l, banco.contaId))),
    };
  }

  return {
    /** Fila de revisão (perfis e itens pendentes), mais antigos primeiro. `proprio` esconde o botão de decidir. */
    listarFila: () => seguro(filaCompleta),

    /**
     * Aprova ou rejeita uma versão pendente. Rejeição exige motivo. O dono não decide o próprio conteúdo:
     * conferido aqui (quando a fila o mostra) e, de qualquer forma, pelo banco. Aprovar não altera
     * `publicado`: se o dono despublicou, aprovar a edição NÃO republica.
     */
    decidir: (entrada: unknown): Promise<Resultado<{ decisao: "aprovada" | "rejeitada" }>> =>
      seguro(async () => {
        const p = decidirRevisaoSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          const motivoFaltando = "motivo" in campos;
          return falha(
            erroAdm(
              motivoFaltando ? "MOTIVO_OBRIGATORIO" : "VALIDACAO",
              Object.values(campos)[0] ?? M.dadosInvalidos,
              campos,
            ),
          );
        }
        const d = p.data;

        let donoId: string | null = null;
        const fila = await banco.listarFila();
        const naFila = fila.dados?.find(
          (l) => l.versao_id === d.versaoId && l.alvo_tipo === d.alvo,
        );
        if (naFila) {
          donoId = naFila.dono_id;
          if (!podeDecidir({ adminId: banco.contaId, donoId })) {
            return falha(erroAdm("AUTO_APROVACAO", M.autoAprovacao));
          }
        }

        const motivo = d.motivo && d.motivo.length > 0 ? d.motivo : null;
        const args = { versaoId: d.versaoId, aprovar: d.aprovar, motivo };
        const r =
          d.alvo === "perfil" ? await banco.decidirPerfil(args) : await banco.decidirItem(args);
        if (r.erro) return falha(mapearErroBancoAdministracao(r.erro));

        const decisao = d.aprovar ? ("aprovada" as const) : ("rejeitada" as const);
        try {
          await notificador.aoDecidir({
            alvo: d.alvo,
            versaoId: d.versaoId,
            decisao,
            motivo: d.aprovar ? null : motivo,
            decididoPor: banco.contaId,
            decididaEm: agora().toISOString(),
            donoId,
          });
        } catch {
          // O aviso é secundário: a decisão já foi gravada e auditada no banco.
        }
        return { ok: true, valor: { decisao } };
      }),

    /** IM-023: resultados das revisões do responsável (situação, motivo ou link, autor e data). */
    listarMeusResultados: (): Promise<Resultado<ResultadoRevisao[]>> =>
      seguro(async () => {
        const r = await banco.listarMinhasRevisoes();
        if (r.erro) return falha(mapearErroBancoAdministracao(r.erro));
        return {
          ok: true,
          valor: ordenarResultados((r.dados ?? []).map(resultadoDaRevisao)),
        };
      }),
  };
}

export type ServicoAdministracao = ReturnType<typeof criarServicoAdministracao>;
