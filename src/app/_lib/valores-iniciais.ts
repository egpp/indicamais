import type { ConteudoItem } from "@/modules/catalogo";
import { formatarCentavos } from "@/modules/catalogo";
import type { ConteudoPerfil } from "@/modules/perfis";
import { formatarE164BR } from "@/shared/formatacao/telefone";

/** Conteúdo do módulo -> valores de campo de formulário (texto). Só apresentação. */

export function valoresIniciaisPerfil(c: ConteudoPerfil): Record<string, string> {
  return {
    nome: c.nome ?? "",
    descricaoBreve: c.descricaoBreve ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    whatsappComercial: c.whatsappComercialE164 ? formatarE164BR(c.whatsappComercialE164) : "",
    endereco: c.endereco ?? "",
    areasAtendidas: c.areasAtendidas.join(", "),
    site: c.site ?? "",
    informacoesSociais: c.informacoesSociais ?? "",
    categoriaPrincipalId: c.categoriaPrincipalId ?? "",
    categoriaSecundaria1: c.categoriasSecundariasIds[0] ?? "",
    categoriaSecundaria2: c.categoriasSecundariasIds[1] ?? "",
  };
}

/** "R$ 1.250,00" -> "1.250,00" (o campo já tem o rótulo R$). */
const semSimbolo = (centavos: number) => formatarCentavos(centavos).replace(/^R\$\s*/, "");

export function valoresIniciaisItem(c: ConteudoItem): Record<string, string> {
  return {
    nome: c.nome ?? "",
    descricao: c.descricao ?? "",
    categoriaPrincipalId: c.categoriaPrincipalId ?? "",
    categoriaSecundaria1: c.categoriasSecundariasIds[0] ?? "",
    categoriaSecundaria2: c.categoriasSecundariasIds[1] ?? "",
    precoModo: c.preco?.modo ?? "",
    precoValor: c.preco && c.preco.centavos !== null ? semSimbolo(c.preco.centavos) : "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    imovelTipo: c.imovelTipo ?? "",
    finalidade: c.finalidade ?? "",
    areaM2: c.areaM2 === null || c.areaM2 === undefined ? "" : String(c.areaM2).replace(".", ","),
    quartos: numeroOuVazio(c.quartos),
    banheiros: numeroOuVazio(c.banheiros),
    vagas: numeroOuVazio(c.vagas),
    bairro: c.bairro ?? "",
    condominio: reaisOuVazio(c.condominioCentavos),
    iptu: reaisOuVazio(c.iptuCentavos),
    aceitaFinanciamento:
      c.aceitaFinanciamento === true ? "true" : c.aceitaFinanciamento === false ? "false" : "",
  };
}

const numeroOuVazio = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : String(n);
const reaisOuVazio = (c: number | null | undefined) =>
  c === null || c === undefined ? "" : semSimbolo(c);
