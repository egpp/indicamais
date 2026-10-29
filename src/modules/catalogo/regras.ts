import { LIMITES } from "@/shared/config/limites";
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
    cidade: c.cidade === undefined ? (base.cidade ?? null) : c.cidade,
    uf: c.uf === undefined ? (base.uf ?? null) : c.uf,
  };
}

/**
 * Coerência do conteúdo inteiro depois do patch. `itemId: null` = item ainda não existe (criação): nenhuma
 * foto é aceita, porque o upload (`item/<itemId>/`) só acontece depois de criar o item.
 */
export function validarConteudoItem(
  c: ConteudoItem,
  itemId: string | null,
  /** true = anúncio particular (sem perfil): cidade e UF obrigatórias; false = item de perfil: proibidas. */
  anuncioParticular = false,
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (anuncioParticular) {
    if (!c.cidade || c.cidade.length < LIMITES.item.cidadeMin) {
      erros.cidade = `Informe a cidade (de ${LIMITES.item.cidadeMin} a ${LIMITES.perfil.cidadeMax} caracteres).`;
    }
    if (!c.uf) erros.uf = "Escolha a UF.";
  } else {
    if (c.cidade) erros.cidade = "Item de perfil usa a cidade do perfil.";
    if (c.uf) erros.uf = "Item de perfil usa a UF do perfil.";
  }
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
export function pendenciasDoItem(c: ConteudoItem, anuncioParticular = false): string[] {
  const p: string[] = [];
  if (!c.nome) p.push("Informe o nome.");
  if (!c.descricao) p.push("Informe a descrição.");
  if (!c.fotoPath) p.push("Envie uma foto.");
  if (!c.categoriaPrincipalId) p.push("Escolha a categoria principal.");
  if (anuncioParticular) {
    if (!c.cidade) p.push("Informe a cidade.");
    if (!c.uf) p.push("Escolha a UF.");
  }
  return p;
}
