import { LIMITES } from "@/shared/config/limites";

/**
 * Lista de interesse (sacola) dos modelos 6, 11, 15, 17, 18 e 20 (D-023, IM-101). É só um rascunho de mensagem no
 * navegador: o visitante monta a lista e ela vira TEXTO no campo "Mensagem" do pedido de contato existente (IM-013).
 * Sem preço, sem total, sem estoque, sem pagamento (IM-090). Nada é gravado em cookie nem em armazenamento, e a lista
 * só vai ao dono do perfil junto com o pedido; nunca ao indicador nem a notificações (IM-029, IM-041, IM-050).
 */
export type ItemSacola = {
  /** Identificador estável do item (preparado para a ação de compra futura). */
  id: string;
  nome: string;
  /** Escolhas informativas, por exemplo "Tamanho: M". */
  escolhas: string[];
  quantidade: number;
};

export const MAX_ITENS_SACOLA = 20;
export const MAX_QUANTIDADE = 99;

const mesmaEscolha = (a: ItemSacola, b: { id: string; escolhas: string[] }) =>
  a.id === b.id && a.escolhas.join("|") === b.escolhas.join("|");

export function adicionarNaSacola(
  itens: readonly ItemSacola[],
  novo: { id: string; nome: string; escolhas?: string[] },
): ItemSacola[] {
  const escolhas = novo.escolhas ?? [];
  const existente = itens.find((i) => mesmaEscolha(i, { id: novo.id, escolhas }));
  if (existente) {
    return itens.map((i) =>
      i === existente ? { ...i, quantidade: Math.min(MAX_QUANTIDADE, i.quantidade + 1) } : i,
    );
  }
  if (itens.length >= MAX_ITENS_SACOLA) return [...itens];
  return [...itens, { id: novo.id, nome: novo.nome, escolhas, quantidade: 1 }];
}

export function alterarQuantidade(
  itens: readonly ItemSacola[],
  indice: number,
  delta: number,
): ItemSacola[] {
  return itens.flatMap((i, n) => {
    if (n !== indice) return [i];
    const q = Math.min(MAX_QUANTIDADE, i.quantidade + delta);
    return q < 1 ? [] : [{ ...i, quantidade: q }];
  });
}

const CABECALHO =
  "Tenho interesse nestes itens (lista sem valores; combinamos preço e disponibilidade):";

/** Texto que vai para o campo Mensagem. Cabe no limite do campo; se não couber, resume o restante. */
export function montarMensagemSacola(itens: readonly ItemSacola[]): string {
  if (itens.length === 0) return "";
  const max = LIMITES.contato.mensagemMax;
  const linhas = itens.map(
    (i) =>
      `- ${i.quantidade}x ${i.nome}${i.escolhas.length > 0 ? ` (${i.escolhas.join(", ")})` : ""}`,
  );
  const saida: string[] = [CABECALHO];
  let usado = CABECALHO.length;
  for (let n = 0; n < linhas.length; n++) {
    const resto = linhas.length - n;
    const reserva = `\n...e mais ${resto} item(ns).`.length;
    const linha = linhas[n]!;
    if (usado + 1 + linha.length + (resto > 1 ? reserva : 0) > max) {
      saida.push(`...e mais ${resto} item(ns).`);
      break;
    }
    saida.push(linha);
    usado += 1 + linha.length;
  }
  return saida.join("\n").slice(0, max);
}

/** Junta a lista ao que o visitante já escreveu, sem repetir a lista se ela já estiver no texto. */
export function incluirListaNaMensagem(atual: string, lista: string): string {
  if (!lista) return atual;
  const base = atual.includes(CABECALHO)
    ? atual.slice(0, atual.indexOf(CABECALHO)).trimEnd()
    : atual.trimEnd();
  const junto = base ? `${base}\n\n${lista}` : lista;
  return junto.slice(0, LIMITES.contato.mensagemMax);
}
