/**
 * Datas digitadas no fuso de Brasília (America/Sao_Paulo) <-> instante ISO em UTC (IM-005). O banco guarda UTC;
 * a tela mostra e recebe horário de Brasília. Só conversão de entrada/saída: nenhuma regra de negócio.
 */

const FUSO = "America/Sao_Paulo";
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const formatadorPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Partes = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

function partesEmBrasilia(ms: number): Partes {
  const p = formatadorPartes.formatToParts(new Date(ms));
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
  return {
    ano: n("year"),
    mes: n("month"),
    dia: n("day"),
    hora: n("hour"),
    minuto: n("minute"),
    segundo: n("second"),
  };
}

/** Deslocamento de Brasília em relação ao UTC, em minutos, no instante `ms` (ex.: -180). */
function deslocamentoMin(ms: number): number {
  const p = partesEmBrasilia(ms);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - ms) / 60000);
}

/**
 * "2026-11-05T14:30" (valor de <input type="datetime-local">, horário de Brasília) -> "2026-11-05T17:30:00.000Z".
 * Vazio -> null (sem limite). Texto que não é data/hora real (mês 13, 31/02...) volta como veio, para o schema do
 * módulo recusar com a mensagem de data inválida.
 */
export function brasiliaParaIsoUtc(texto: string): string | null {
  const t = texto.trim();
  if (t === "") return null;
  const m = LOCAL.exec(t);
  if (!m) return t;
  const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const chute = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const conferido = new Date(chute);
  if (
    conferido.getUTCFullYear() !== ano ||
    conferido.getUTCMonth() !== mes - 1 ||
    conferido.getUTCDate() !== dia ||
    conferido.getUTCHours() !== hora
  ) {
    return t;
  }
  let utc = chute - deslocamentoMin(chute) * 60000;
  const segundo = deslocamentoMin(utc);
  if (segundo !== deslocamentoMin(chute)) utc = chute - segundo * 60000;
  return new Date(utc).toISOString();
}

/** Instante ISO (UTC) -> "2026-11-05T14:30" em horário de Brasília, para preencher <input type="datetime-local">. */
export function isoUtcParaBrasilia(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = partesEmBrasilia(ms);
  const d2 = (n: number) => String(n).padStart(2, "0");
  return `${p.ano}-${d2(p.mes)}-${d2(p.dia)}T${d2(p.hora)}:${d2(p.minuto)}`;
}
