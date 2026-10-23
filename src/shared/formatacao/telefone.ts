/** Formatação de telefone brasileiro para exibição e máscara de digitação (IM-005). Só apresentação. */

/** Máscara enquanto digita: (11) 99999-0001 ou (11) 3333-0001. Aceita colagem com +55. */
export function mascararTelefoneBR(entrada: string): string {
  let d = entrada.replace(/\D/g, "");
  if (entrada.trim().startsWith("+") && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

/** "+5511999990001" -> "(11) 99999-0001". Entrada fora do padrão volta como veio. */
export function formatarE164BR(e164: string): string {
  const m = /^\+55(\d{2})(\d{8,9})$/.exec(e164);
  if (!m) return e164;
  return mascararTelefoneBR(`${m[1]}${m[2]}`);
}
