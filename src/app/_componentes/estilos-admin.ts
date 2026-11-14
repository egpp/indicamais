import { IDS_ESTILOS, TEMAS, type EstiloId } from "./site/estilos";

/** Lógica só de apresentação da tela "Modelos de sites" (administração). Nenhuma regra de negócio aqui. */

export type FiltroModelos = "todos" | "habilitados" | "desabilitados";

export type EstiloDaLista = { id: string; rotulo: string; habilitado: boolean };

export type ModeloNaTela = {
  id: string;
  /** "01".."22", pela ordem de IDS_ESTILOS. */
  numero: string;
  /** Rótulo exibido nesta tela (o 22º aparece como "Essencial — Plano Gratuito"; no banco segue "Básico"). */
  nome: string;
  habilitado: boolean;
  /** Desenho pronto (TEMAS[id].liberado). Sem ele o modelo não pode ser habilitado. */
  pronto: boolean;
  padrao: boolean;
};

/** Rótulos de exibição só desta tela, por id. */
const ROTULO_NA_TELA: Partial<Record<EstiloId, string>> = {
  basico: "Essencial — Plano Gratuito",
};

export function numeroDoModelo(id: string): string | null {
  const i = (IDS_ESTILOS as readonly string[]).indexOf(id);
  return i < 0 ? null : String(i + 1).padStart(2, "0");
}

/** Monta os modelos na ordem de IDS_ESTILOS; ids desconhecidos do banco são ignorados. */
export function montarModelos(lista: readonly EstiloDaLista[]): ModeloNaTela[] {
  const porId = new Map(lista.map((e) => [e.id, e]));
  const resultado: ModeloNaTela[] = [];
  for (const id of IDS_ESTILOS) {
    const e = porId.get(id);
    if (!e) continue;
    resultado.push({
      id,
      numero: numeroDoModelo(id) ?? "",
      nome: ROTULO_NA_TELA[id] ?? e.rotulo,
      habilitado: e.habilitado,
      pronto: TEMAS[id].liberado === true,
      padrao: id === "minimalista",
    });
  }
  return resultado;
}

export function contarModelos(modelos: readonly ModeloNaTela[]) {
  const habilitados = modelos.filter((m) => m.habilitado).length;
  return { total: modelos.length, habilitados, desabilitados: modelos.length - habilitados };
}

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function filtrarModelos(
  modelos: readonly ModeloNaTela[],
  filtro: FiltroModelos,
  busca: string,
): ModeloNaTela[] {
  const termo = semAcento(busca.trim());
  return modelos.filter((m) => {
    if (filtro === "habilitados" && !m.habilitado) return false;
    if (filtro === "desabilitados" && m.habilitado) return false;
    return termo === "" || semAcento(m.nome).includes(termo);
  });
}

export function lerFiltro(valor: string | string[] | undefined): FiltroModelos {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v === "habilitados" || v === "desabilitados" ? v : "todos";
}

export function lerBusca(valor: string | string[] | undefined): string {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return (v ?? "").slice(0, 60);
}

export function rotuloContagem(n: number): string {
  return n === 1 ? "1 modelo encontrado" : `${n} modelos encontrados`;
}

export function caminhoPrevia(numero: string): string {
  return `/modelos-sites/modelo-${numero}-previa.webp`;
}

export function caminhoImagemCompleta(numero: string): string {
  return `/modelos-sites/modelo-${numero}.webp`;
}
