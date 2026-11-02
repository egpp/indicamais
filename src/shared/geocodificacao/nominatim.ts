import { z } from "zod";

/**
 * Geocodificação no SERVIDOR com o Nominatim do OpenStreetMap (D-016; IM-018, IM-092). Sem chave nem custo.
 * Política de uso do Nominatim: User-Agent que identifica a aplicação (nome + URL, nunca e-mail de pessoa),
 * no máximo 1 requisição por segundo, sem autocomplete e sem lote. Só a coordenada é aproveitada: nada do
 * resultado é guardado aqui (o banco guarda a coordenada) e o endereço nunca vai para log.
 * Qualquer falha vira resultado neutro: o mapa simplesmente não aparece e o salvar do perfil não quebra.
 */

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const INTERVALO_MINIMO_MS = 1000;
export const TIMEOUT_MS = 5000;

export type EntradaGeocodificacao = { endereco: string; cidade: string; uf: string };
export type ResultadoGeocodificacao =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; motivo: "entrada_invalida" | "sem_resultado" | "indisponivel" };

const textoSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((s) => !/[\u0000-\u001F\u007F]/.test(s));
const entradaSchema = z.object({
  endereco: textoSchema,
  cidade: textoSchema,
  uf: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/),
});

const numero = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z.number().finite(),
);
const respostaSchema = z.array(
  z.object({
    lat: numero.pipe(z.number().min(-90).max(90)),
    lon: numero.pipe(z.number().min(-180).max(180)),
  }),
);

export type DependenciasGeocodificador = {
  fetch?: typeof fetch;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  /** URL pública do app, para o User-Agent. Padrão: NEXT_PUBLIC_APP_URL. */
  appUrl?: string;
  timeoutMs?: number;
};

export function criarGeocodificador(deps: DependenciasGeocodificador = {}) {
  const agora = deps.agora ?? (() => Date.now());
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
  let fila: Promise<unknown> = Promise.resolve();
  let ultimaSaida = Number.NEGATIVE_INFINITY;

  /** Serializa as consultas desta instância e garante o intervalo mínimo entre elas. */
  function naFila<T>(f: () => Promise<T>): Promise<T> {
    const r = fila.then(async () => {
      const falta = ultimaSaida + INTERVALO_MINIMO_MS - agora();
      if (falta > 0) await esperar(falta);
      ultimaSaida = agora();
      return f();
    });
    fila = r.catch(() => undefined);
    return r;
  }

  async function consultar(q: string): Promise<ResultadoGeocodificacao> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    const app = deps.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const agente = app ? `IndicaMais/1.0 (${app})` : "IndicaMais/1.0";
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const resp = await (deps.fetch ?? fetch)(url.toString(), {
        method: "GET",
        headers: { "User-Agent": agente, Accept: "application/json", "Accept-Language": "pt-BR" },
        signal: ctl.signal,
        cache: "no-store",
      });
      if (!resp.ok) return { ok: false, motivo: "indisponivel" };
      const corpo = respostaSchema.safeParse(await resp.json());
      if (!corpo.success) return { ok: false, motivo: "indisponivel" };
      const primeiro = corpo.data[0];
      if (!primeiro) return { ok: false, motivo: "sem_resultado" };
      return { ok: true, latitude: primeiro.lat, longitude: primeiro.lon };
    } catch {
      // Timeout, rede ou JSON inválido: sem detalhe e sem endereço em log.
      return { ok: false, motivo: "indisponivel" };
    } finally {
      clearTimeout(timer);
    }
  }

  return async function geocodificarEndereco(
    entrada: EntradaGeocodificacao,
  ): Promise<ResultadoGeocodificacao> {
    const e = entradaSchema.safeParse(entrada);
    if (!e.success) return { ok: false, motivo: "entrada_invalida" };
    const { endereco, cidade, uf } = e.data;
    try {
      return await naFila(() => consultar(`${endereco}, ${cidade} - ${uf.toUpperCase()}, Brasil`));
    } catch {
      return { ok: false, motivo: "indisponivel" };
    }
  };
}

/** Instância do processo (o limite de 1 req/s vale por instância). */
export const geocodificarEndereco = criarGeocodificador();
