export type Resultado<T, E> = { ok: true; valor: T } | { ok: false; erro: E };

/** Resposta de uma operação do banco injetado. `dados: null` sem erro = nenhuma linha. */
export type RespostaBanco<T> = { dados: T | null; erro: ErroBanco | null };

export type ErroBanco = {
  code?: string;
  message?: string;
  details?: string;
  constraint?: string;
};
