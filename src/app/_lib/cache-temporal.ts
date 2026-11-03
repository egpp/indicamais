/**
 * Cache em memória com validade (TTL), por isolate do Worker. Serve para absorver rajadas de visitas na home (D-018:
 * atualização em intervalos, não a cada visita). Guarda só o que o chamador manda; a chave NUNCA deve conter dado de
 * pessoa. Chamadas simultâneas à mesma chave compartilham uma única carga. Falha da carga não é guardada.
 */
export type OpcoesCacheTemporal = { ttlMs: number; maxEntradas?: number; agora?: () => number };

export function criarCacheTemporal<T>({
  ttlMs,
  maxEntradas = 200,
  agora = Date.now,
}: OpcoesCacheTemporal) {
  const guardado = new Map<string, { valor: T; expira: number }>();
  const emVoo = new Map<string, Promise<T>>();
  let geracao = 0;

  return {
    async obter(chave: string, carregar: () => Promise<T>): Promise<T> {
      const e = guardado.get(chave);
      if (e && e.expira > agora()) return e.valor;
      const andando = emVoo.get(chave);
      if (andando) return andando;
      const minhaGeracao = geracao;
      const p: Promise<T> = carregar()
        .then((valor) => {
          // Invalidada durante a carga: devolve, mas não guarda o valor possivelmente velho.
          if (minhaGeracao === geracao) {
            if (guardado.size >= maxEntradas) {
              const maisAntiga = guardado.keys().next().value;
              if (maisAntiga !== undefined) guardado.delete(maisAntiga);
            }
            guardado.set(chave, { valor, expira: agora() + ttlMs });
          }
          return valor;
        })
        .finally(() => {
          if (emVoo.get(chave) === p) emVoo.delete(chave);
        });
      emVoo.set(chave, p);
      return p;
    },
    invalidar(): void {
      geracao += 1;
      guardado.clear();
      emVoo.clear();
    },
    tamanho: () => guardado.size,
  };
}
