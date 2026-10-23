/** Textos e formatos de apresentação (pt-BR, America/Sao_Paulo). Só exibição: nenhuma regra de negócio. */

const FUSO = "America/Sao_Paulo";

/** "23/10/2026 14:30" no fuso de Brasília. O banco guarda UTC (IM-005). */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}`;
}

export type CategoriaOpcao = { id: string; nome: string };

export function nomeDaCategoria(id: string | null, categorias: readonly CategoriaOpcao[]): string {
  if (!id) return "";
  return categorias.find((c) => c.id === id)?.nome ?? "Categoria indisponível";
}

export const ROTULO_TIPO_ITEM = { produto: "Produto", servico: "Serviço" } as const;

export const ROTULO_MODO_PRECO = {
  fixo: "Preço fixo",
  a_partir_de: "A partir de",
  sob_consulta: "Sob consulta",
} as const;
