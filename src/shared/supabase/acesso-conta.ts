import { z } from "zod";
import { criarClienteServico } from "./servico";

/**
 * Bloqueio de acesso no Auth (IM-080). Ao suspender uma conta, o servidor aplica `banned_until` pela Admin API
 * (o Auth recusa novo login e renovação de sessão); ao reativar, desfaz. Só servidor. A situação de verdade
 * continua em contas_ciclo_vida: isto é a segunda barreira (a primeira é contas_meu_estado() no proxy e a RLS).
 * Devolve só sucesso/falha; nunca devolve nem registra dados da conta nem mensagem do provedor (IM-086).
 */

/** Cerca de 100 anos: equivale a "para sempre" para a suspensão. */
export const DURACAO_BLOQUEIO = "876000h";

const idConta = z.uuid();

/** O que o adaptador usa da Admin API (permite teste sem rede). */
export type AdminAuth = {
  updateUserById(
    id: string,
    atributos: { ban_duration: string },
  ): Promise<{ error: unknown | null }>;
};

export type ResultadoAcesso = { ok: true } | { ok: false; motivo: "conta_invalida" | "falha" };

async function alterar(
  contaId: string,
  duracao: string,
  admin?: AdminAuth,
): Promise<ResultadoAcesso> {
  const id = idConta.safeParse(contaId);
  if (!id.success) return { ok: false, motivo: "conta_invalida" };
  try {
    const api = admin ?? criarClienteServico().auth.admin;
    const { error } = await api.updateUserById(id.data, { ban_duration: duracao });
    return error ? { ok: false, motivo: "falha" } : { ok: true };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/** Impede novo login e renovação de sessão da conta suspensa. Idempotente. */
export function bloquearAcessoNoAuth(contaId: string, admin?: AdminAuth) {
  return alterar(contaId, DURACAO_BLOQUEIO, admin);
}

/** Desfaz o bloqueio ao reativar a conta. Idempotente. */
export function liberarAcessoNoAuth(contaId: string, admin?: AdminAuth) {
  return alterar(contaId, "none", admin);
}
