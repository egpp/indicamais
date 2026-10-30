import { z } from "zod";
import type { Database } from "@/shared/db/database.types";
import { mapearErroBanco, type ErroBanco, type ErroConta } from "./erros";
import { MENSAGEM_ERRO_GENERICO } from "./mensagens";
import type { RespostaBanco } from "./servico";

/**
 * Ciclo de vida da PRÓPRIA conta (IM-080, IM-081, IM-082; D-014): estado, solicitar e cancelar o encerramento.
 * Sem service_role: o banco confere auth.uid(). Anonimização e suspensão no Auth são do servidor/devops.
 * Provisório até a revisão jurídica da política de retenção (IM-082): o prazo vem do banco (contas_parametro).
 */

export const PALAVRA_CONFIRMACAO_ENCERRAMENTO = "ENCERRAR";

export const MENSAGENS_CICLO_CONTA = {
  semLogin: "Entre na sua conta para continuar.",
  confirmacaoInvalida: `Para encerrar a conta, digite ${PALAVRA_CONFIRMACAO_ENCERRAMENTO}.`,
  adminGeral: "Esta conta de administração não pode ser encerrada por aqui.",
  semEncerramento: "Não há encerramento solicitado nesta conta.",
  acessoRestrito: "O acesso a esta conta está restrito no momento.",
} as const;

export const SITUACOES_CONTA = [
  "ativa",
  "suspensa",
  "encerramento_solicitado",
  "anonimizada",
] as const;
export type SituacaoConta = (typeof SITUACOES_CONTA)[number];

export type LinhaMeuEstado =
  Database["public"]["Functions"]["contas_meu_estado"]["Returns"][number];

export type EstadoDaConta = {
  situacao: SituacaoConta;
  acessoPermitido: boolean;
  /** Fim da carência (ISO, UTC) quando há encerramento solicitado; a interface exibe em America/Sao_Paulo. */
  encerramentoExecutarApos: string | null;
};

/** Sem linha (anônimo) ou situação desconhecida: null. Situação desconhecida NUNCA vira "ativa" (falha fechado). */
export function paraEstadoDaConta(l: LinhaMeuEstado | null | undefined): EstadoDaConta | null {
  if (!l) return null;
  const situacao = (SITUACOES_CONTA as readonly string[]).includes(l.o_situacao)
    ? (l.o_situacao as SituacaoConta)
    : null;
  if (!situacao) return null;
  const acessoPermitido =
    l.o_acesso_permitido === true && situacao !== "suspensa" && situacao !== "anonimizada";
  return {
    situacao,
    acessoPermitido,
    encerramentoExecutarApos:
      situacao === "encerramento_solicitado" ? (l.o_encerramento_executar_apos ?? null) : null,
  };
}

/** Palavra digitada, sem diferenciar maiúsculas (o banco confere de novo). */
export const solicitarEncerramentoSchema = z.object({
  confirmacao: z
    .string({ error: MENSAGENS_CICLO_CONTA.confirmacaoInvalida })
    .trim()
    .refine((v) => v.toUpperCase() === PALAVRA_CONFIRMACAO_ENCERRAMENTO, {
      error: MENSAGENS_CICLO_CONTA.confirmacaoInvalida,
    }),
});
export type SolicitarEncerramento = z.infer<typeof solicitarEncerramentoSchema>;

export type ResultadoCiclo<T> = { ok: true; valor: T } | { ok: false; erro: ErroConta };

export interface ClienteBancoCicloVidaConta {
  /** rpc contas_meu_estado(): zero linhas para anônimo. */
  lerMeuEstado(): Promise<RespostaBanco<LinhaMeuEstado[]>>;
  /** rpc contas_solicitar_encerramento(p_confirmacao) -> fim da carência. */
  solicitarEncerramento(a: { confirmacao: string }): Promise<RespostaBanco<string>>;
  /** rpc contas_cancelar_encerramento(). */
  cancelarEncerramento(): Promise<{ erro: ErroBanco | null }>;
}

const falha = (codigo: ErroConta["codigo"], mensagem: string): { ok: false; erro: ErroConta } => ({
  ok: false,
  erro: { codigo, mensagem },
});

/** 42501 sem login ou conta restrita; 22023 palavra errada; P0001 estado (admin geral / sem encerramento). */
export function mapearErroCicloConta(
  e: ErroBanco,
  op: "estado" | "solicitar" | "cancelar",
): ErroConta {
  const M = MENSAGENS_CICLO_CONTA;
  switch (e.code) {
    case "42501":
      return {
        codigo: "NAO_AUTENTICADO",
        mensagem: op === "estado" ? M.semLogin : M.acessoRestrito,
      };
    case "22023":
      return { codigo: "CONFIRMACAO_INVALIDA", mensagem: M.confirmacaoInvalida };
    case "P0001":
      return op === "cancelar"
        ? { codigo: "ESTADO_INVALIDO", mensagem: M.semEncerramento }
        : { codigo: "ESTADO_INVALIDO", mensagem: M.adminGeral };
  }
  return mapearErroBanco(e);
}

export function criarServicoCicloVidaConta(banco: ClienteBancoCicloVidaConta) {
  async function seguro<T>(f: () => Promise<ResultadoCiclo<T>>): Promise<ResultadoCiclo<T>> {
    try {
      return await f();
    } catch {
      return falha("ERRO_INTERNO", MENSAGEM_ERRO_GENERICO);
    }
  }

  return {
    /** Estado da conta logada para o servidor/proxy decidir acesso a cada requisição. `null` = anônimo. */
    obterMeuEstado: (): Promise<ResultadoCiclo<EstadoDaConta | null>> =>
      seguro(async () => {
        const r = await banco.lerMeuEstado();
        if (r.erro) return { ok: false, erro: mapearErroCicloConta(r.erro, "estado") };
        return { ok: true, valor: paraEstadoDaConta(r.dados?.[0]) };
      }),

    /**
     * IM-081: confirmação reforçada (digitar ENCERRAR). Perfis ficam despublicados; carência definida no banco;
     * dá para desistir. Repetir enquanto em carência devolve o mesmo prazo.
     */
    solicitarEncerramento: (entrada: unknown): Promise<ResultadoCiclo<{ executarApos: string }>> =>
      seguro(async () => {
        const p = solicitarEncerramentoSchema.safeParse(entrada);
        if (!p.success) {
          return falha("CONFIRMACAO_INVALIDA", MENSAGENS_CICLO_CONTA.confirmacaoInvalida);
        }
        const r = await banco.solicitarEncerramento({ confirmacao: p.data.confirmacao });
        if (r.erro) return { ok: false, erro: mapearErroCicloConta(r.erro, "solicitar") };
        if (!r.dados) return falha("ERRO_INTERNO", MENSAGEM_ERRO_GENERICO);
        return { ok: true, valor: { executarApos: r.dados } };
      }),

    /** IM-081: desistir dentro da carência. Os perfis NÃO voltam sozinhos: o responsável republica. */
    cancelarEncerramento: (): Promise<ResultadoCiclo<null>> =>
      seguro(async () => {
        const r = await banco.cancelarEncerramento();
        if (r.erro) return { ok: false, erro: mapearErroCicloConta(r.erro, "cancelar") };
        return { ok: true, valor: null };
      }),
  };
}

export type ServicoCicloVidaConta = ReturnType<typeof criarServicoCicloVidaConta>;
