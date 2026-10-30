/**
 * Verificação de acesso da conta por requisição (IM-080, IM-081). O proxy consulta contas_meu_estado() só para
 * quem tem sessão; o resultado fica em memória por pouco tempo (por instância do servidor) para não gerar uma
 * consulta ao banco em cada requisição. O resultado nunca sai do servidor: o proxy só decide continuar ou
 * encerrar a sessão (IM-086). Erro de consulta NÃO bloqueia (a RLS e contas_acesso_ativo() seguem valendo).
 */

export const TEMPO_CACHE_MS = 30_000;
const MAXIMO_ENTRADAS = 2_000;

type Entrada = { permitido: boolean; ate: number };
const cache = new Map<string, Entrada>();

/** Só o que o proxy usa do cliente Supabase (permite teste sem rede). */
export type ConsultaEstado = {
  rpc(nome: "contas_meu_estado"): PromiseLike<{
    data: { o_acesso_permitido: boolean }[] | null;
    error: unknown | null;
  }>;
};

export function limparCacheEstado() {
  cache.clear();
}

export async function acessoPermitido(
  cliente: ConsultaEstado,
  contaId: string,
  agora: number = Date.now(),
): Promise<boolean> {
  const guardado = cache.get(contaId);
  if (guardado && guardado.ate > agora) return guardado.permitido;

  let permitido = true;
  try {
    const { data, error } = await cliente.rpc("contas_meu_estado");
    if (error || !data) return true; // sem decisão: não bloqueia e não guarda
    permitido = data[0]?.o_acesso_permitido !== false;
  } catch {
    return true;
  }

  if (cache.size >= MAXIMO_ENTRADAS) cache.clear();
  cache.set(contaId, { permitido, ate: agora + TEMPO_CACHE_MS });
  return permitido;
}
