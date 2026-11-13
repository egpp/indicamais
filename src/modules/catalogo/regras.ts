import { LIMITES } from "@/shared/config/limites";
import { validarCategorias } from "@/shared/conteudo/categorias";
import { caminhoDaPasta } from "@/shared/conteudo/imagens";
import { pendenciasDoImovel, temCampoDeImovel } from "./imovel";
import type { CamposItem, TipoItem } from "./schemas";
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
    imovelTipo: c.imovelTipo === undefined ? (base.imovelTipo ?? null) : c.imovelTipo,
    finalidade: c.finalidade === undefined ? (base.finalidade ?? null) : c.finalidade,
    areaM2: c.areaM2 === undefined ? (base.areaM2 ?? null) : c.areaM2,
    quartos: c.quartos === undefined ? (base.quartos ?? null) : c.quartos,
    banheiros: c.banheiros === undefined ? (base.banheiros ?? null) : c.banheiros,
    vagas: c.vagas === undefined ? (base.vagas ?? null) : c.vagas,
    bairro: c.bairro === undefined ? (base.bairro ?? null) : c.bairro,
    condominioCentavos:
      c.condominioCentavos === undefined ? (base.condominioCentavos ?? null) : c.condominioCentavos,
    iptuCentavos: c.iptuCentavos === undefined ? (base.iptuCentavos ?? null) : c.iptuCentavos,
    aceitaFinanciamento:
      c.aceitaFinanciamento === undefined
        ? (base.aceitaFinanciamento ?? null)
        : c.aceitaFinanciamento,
    fotosExtrasPaths: c.fotosExtrasPaths ?? base.fotosExtrasPaths ?? [],
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
  /** Tipo do item. Imóvel tem cidade/UF próprias e campos de imóvel; os demais tipos não aceitam campos de imóvel. */
  tipo: TipoItem = "produto",
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (tipo === "imovel") {
    if (anuncioParticular) erros.perfilId = "O imóvel pertence a um site. Escolha o site.";
    if (c.cidade && c.cidade.length < LIMITES.item.cidadeMin) {
      erros.cidade = `Informe a cidade (de ${LIMITES.item.cidadeMin} a ${LIMITES.perfil.cidadeMax} caracteres).`;
    }
  } else {
    if (anuncioParticular) {
      if (!c.cidade || c.cidade.length < LIMITES.item.cidadeMin) {
        erros.cidade = `Informe a cidade (de ${LIMITES.item.cidadeMin} a ${LIMITES.perfil.cidadeMax} caracteres).`;
      }
      if (!c.uf) erros.uf = "Escolha a UF.";
    } else {
      if (c.cidade) erros.cidade = "Item de site usa a cidade do site.";
      if (c.uf) erros.uf = "Item de site usa a UF do site.";
    }
    if (temCampoDeImovel(c)) {
      erros.imovelTipo = "Os campos de imóvel só valem para itens do tipo imóvel.";
    }
  }
  const cat = validarCategorias({
    principalId: c.categoriaPrincipalId,
    secundariasIds: c.categoriasSecundariasIds,
  });
  if (cat) erros.categoriasSecundariasIds = cat;
  if (c.fotoPath !== null && !(itemId !== null && caminhoDaPasta("item", itemId, c.fotoPath))) {
    erros.fotoPath = "Imagem inválida. Envie novamente.";
  }
  const extras = c.fotosExtrasPaths ?? [];
  if (extras.length > LIMITES.imovel.fotosExtrasMax) {
    erros.fotosExtrasPaths = `Envie no máximo ${LIMITES.imovel.fotosExtrasMax} fotos adicionais.`;
  } else if (new Set(extras).size !== extras.length) {
    erros.fotosExtrasPaths = "Não repita a mesma foto.";
  } else if (extras.some((p) => !(itemId !== null && caminhoDaPasta("item", itemId, p)))) {
    erros.fotosExtrasPaths = "Imagem inválida. Envie novamente.";
  }
  return erros;
}

/** O que falta para enviar à aprovação (IM-014, IM-017). Lista vazia = pronto. */
export function pendenciasDoItem(
  c: ConteudoItem,
  anuncioParticular = false,
  tipo: TipoItem = "produto",
): string[] {
  const p: string[] = [];
  if (!c.nome) p.push("Informe o nome.");
  if (!c.descricao) p.push("Informe a descrição.");
  if (!c.fotoPath) p.push("Envie uma foto.");
  if (!c.categoriaPrincipalId) p.push("Escolha a categoria principal.");
  if (anuncioParticular) {
    if (!c.cidade) p.push("Informe a cidade.");
    if (!c.uf) p.push("Escolha a UF.");
  }
  if (tipo === "imovel") {
    p.push(...pendenciasDoImovel(c, c.preco));
    if (!c.cidade) p.push("Informe a cidade do imóvel.");
    if (!c.uf) p.push("Escolha a UF do imóvel.");
  }
  return p;
}
