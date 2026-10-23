import { validarCategorias } from "@/shared/conteudo/categorias";
import { caminhoDaPasta } from "@/shared/conteudo/imagens";
import type { CamposItem } from "./schemas";
import type { ConteudoItem } from "./modelos";

/** Aplica o patch (undefined = mantém; null = limpa). Função pura. */
export function aplicarCamposItem(base: ConteudoItem, c: CamposItem): ConteudoItem {
  return {
    nome: c.nome === undefined ? base.nome : c.nome,
    descricao: c.descricao === undefined ? base.descricao : c.descricao,
    fotoPath: c.fotoPath === undefined ? base.fotoPath : c.fotoPath,
    categoriaPrincipalId:
      c.categoriaPrincipalId === undefined ? base.categoriaPrincipalId : c.categoriaPrincipalId,
    categoriasSecundariasIds: c.categoriasSecundariasIds ?? base.categoriasSecundariasIds,
    preco: c.preco === undefined ? base.preco : c.preco,
  };
}

/**
 * Coerência do conteúdo inteiro depois do patch. `itemId: null` = item ainda não existe (criação): nenhuma
 * foto é aceita, porque o upload (`item/<itemId>/`) só acontece depois de criar o item.
 */
export function validarConteudoItem(
  c: ConteudoItem,
  itemId: string | null,
): Record<string, string> {
  const erros: Record<string, string> = {};
  const cat = validarCategorias({
    principalId: c.categoriaPrincipalId,
    secundariasIds: c.categoriasSecundariasIds,
  });
  if (cat) erros.categoriasSecundariasIds = cat;
  if (c.fotoPath !== null && !(itemId !== null && caminhoDaPasta("item", itemId, c.fotoPath))) {
    erros.fotoPath = "Imagem inválida. Envie novamente.";
  }
  return erros;
}

/** O que falta para enviar à aprovação (IM-014, IM-017). Lista vazia = pronto. */
export function pendenciasDoItem(c: ConteudoItem): string[] {
  const p: string[] = [];
  if (!c.nome) p.push("Informe o nome.");
  if (!c.descricao) p.push("Informe a descrição.");
  if (!c.fotoPath) p.push("Envie uma foto.");
  if (!c.categoriaPrincipalId) p.push("Escolha a categoria principal.");
  return p;
}
