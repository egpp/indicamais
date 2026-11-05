/**
 * Moeda, percentual e competência nas telas de comissões (IM-005, IM-062, IM-069). Só leitura/exibição: o banco
 * guarda centavos inteiros e pontos-base (100 = 1%); quem valida faixa e regra é o módulo. Nada aqui calcula comissão.
 */

/** 12345 -> "R$ 123,45" (aceita negativo; o módulo de catálogo recusa). */
export function formatarReais(centavos: number): string {
  const n = Number.isFinite(centavos) ? Math.trunc(centavos) : 0;
  const abs = Math.abs(n);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = String(abs % 100).padStart(2, "0");
  return `${n < 0 ? "-" : ""}R$ ${reais},${cents}`;
}

/** 500 -> "5%", 250 -> "2,5%", 1 -> "0,01%". */
export function formatarPercentualBp(bp: number): string {
  const n = Number.isFinite(bp) ? Math.trunc(bp) : 0;
  const inteiro = Math.floor(n / 100);
  const frac = String(n % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${inteiro}${frac ? `,${frac}` : ""}%`;
}

/** "R$ 1.234,56", "99,9", "1234" -> centavos. Ilegível vira NaN (o formulário responde com a mensagem do campo). */
export function lerReais(texto: string): number {
  const t = texto.replace(/^\s*R\$\s*/i, "").trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return Number.NaN;
  const [inteiro = "0", frac = ""] = t.replace(/\./g, "").split(",");
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : Number.NaN;
}

/** "5", "2,5", "2,5%" -> pontos-base (500, 250). Ilegível vira NaN. */
export function lerPercentualBp(texto: string): number {
  const t = texto.replace(/%\s*$/, "").trim();
  if (!/^\d{1,3}(,\d{1,2})?$/.test(t)) return Number.NaN;
  const [inteiro = "0", frac = ""] = t.split(",");
  return Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
}

/** "2026-11" ou "11/2026" -> "2026-11". Outro formato volta como veio, para o schema responder. */
export function lerCompetencia(texto: string): string {
  const t = texto.trim();
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(t);
  return m ? `${m[2]}-${m[1]}` : t;
}

/** "2026-11-01" -> "11/2026". */
export function rotuloCompetencia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[2]}/${m[1]}` : "";
}
