/**
 * Normalização de WhatsApp brasileiro para E.164 (+55). IM-009.
 * Função pura: não consulta banco; a unicidade é garantida pelo banco.
 */

export type CodigoErroWhatsapp =
  "VAZIO" | "NAO_BRASILEIRO" | "COMPRIMENTO" | "DDD_INVALIDO" | "NUMERO_INVALIDO";

export type ResultadoWhatsapp =
  { ok: true; e164: string } | { ok: false; codigo: CodigoErroWhatsapp; mensagem: string };

const MENSAGENS: Record<CodigoErroWhatsapp, string> = {
  VAZIO: "Informe o número de WhatsApp.",
  NAO_BRASILEIRO: "Informe um número brasileiro (DDD + número).",
  COMPRIMENTO: "O número deve ter DDD e 8 ou 9 dígitos. Exemplo: (11) 99999-0001.",
  DDD_INVALIDO: "DDD inválido. Confira o número.",
  NUMERO_INVALIDO: "Número de WhatsApp inválido. Confira os dígitos.",
};

/** DDDs em uso no Brasil (Anatel). */
const DDDS_VALIDOS: ReadonlySet<string> = new Set([
  ..."11 12 13 14 15 16 17 18 19".split(" "),
  ..."21 22 24 27 28".split(" "),
  ..."31 32 33 34 35 37 38".split(" "),
  ..."41 42 43 44 45 46 47 48 49".split(" "),
  ..."51 53 54 55".split(" "),
  ..."61 62 63 64 65 66 67 68 69".split(" "),
  ..."71 73 74 75 77 79".split(" "),
  ..."81 82 83 84 85 86 87 88 89".split(" "),
  ..."91 92 93 94 95 96 97 98 99".split(" "),
]);

const erro = (codigo: CodigoErroWhatsapp): ResultadoWhatsapp => ({
  ok: false,
  codigo,
  mensagem: MENSAGENS[codigo],
});

/**
 * Aceita "(11) 99999-0001", "11999990001", "+55 11 99999-0001",
 * "5511999990001", "011 99999-0001" (0 de operadora/tronco opcional).
 * Devolve "+55DDDNUMERO" ou erro com mensagem em pt-BR.
 */
export function normalizarWhatsappBR(entrada: string): ResultadoWhatsapp {
  const texto = (entrada ?? "").trim();
  if (texto === "") return erro("VAZIO");
  // Só dígitos, espaço, parênteses, hífen, ponto e "+" inicial são aceitos.
  if (!/^\+?[\d\s().-]+$/.test(texto)) return erro("NUMERO_INVALIDO");

  const comMais = texto.startsWith("+");
  let d = texto.replace(/\D/g, "");

  if (comMais) {
    if (!d.startsWith("55")) return erro("NAO_BRASILEIRO");
    d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
  } else {
    if (d.startsWith("0")) d = d.slice(1);
    // 12–13 dígitos começando em 55 = com código do país.
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  }

  if (d.length !== 10 && d.length !== 11) {
    return erro(d.length > 11 ? "NAO_BRASILEIRO" : "COMPRIMENTO");
  }

  const ddd = d.slice(0, 2);
  if (!DDDS_VALIDOS.has(ddd)) return erro("DDD_INVALIDO");

  const numero = d.slice(2);
  if (numero.length === 9) {
    // Celular: 9 inicial.
    if (numero[0] !== "9") return erro("NUMERO_INVALIDO");
  } else if (!/^[2-5]/.test(numero)) {
    // 8 dígitos: só fixo (começa em 2–5).
    return erro("NUMERO_INVALIDO");
  }
  return { ok: true, e164: `+55${d}` };
}
