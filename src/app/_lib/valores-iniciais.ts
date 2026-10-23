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
  };
}
