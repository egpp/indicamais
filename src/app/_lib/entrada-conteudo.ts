import { parsearReaisParaCentavos } from "@/modules/catalogo";

/**
 * Leitura dos formulários de perfil e item para o formato dos schemas dos módulos. Só transforma texto
 * digitado em entrada (lista de áreas, R$ -> centavos); quem valida e decide é o módulo.
 */

export type Ler = (nome: string) => string;

export const lerDeFormData =
  (f: FormData): Ler =>
  (n) => {
    const v = f.get(n);
    return typeof v === "string" ? v : "";
  };

export const lerDeRegistro =
  (d: Record<string, string>): Ler =>
  (n) =>
    d[n] ?? "";

const vazioParaNulo = (s: string) => (s.trim() === "" ? null : s.trim());

export function listaDeAreas(texto: string): string[] {
  return texto
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function categorias(ler: Ler) {
  return {
    categoriaPrincipalId: vazioParaNulo(ler("categoriaPrincipalId")),
    categoriasSecundariasIds: [ler("categoriaSecundaria1"), ler("categoriaSecundaria2")]
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export const CAMPOS_PERFIL = [
  "nome",
  "descricaoBreve",
  "cidade",
  "uf",
  "whatsappComercial",
  "endereco",
  "areasAtendidas",
  "site",
  "informacoesSociais",
  "categoriaPrincipalId",
  "categoriaSecundaria1",
  "categoriaSecundaria2",
  "slug",
] as const;

export function lerCamposPerfil(ler: Ler) {
  return {
    nome: ler("nome"),
    descricaoBreve: ler("descricaoBreve"),
    cidade: ler("cidade"),
    uf: ler("uf"),
    whatsappComercial: ler("whatsappComercial"),
    endereco: ler("endereco"),
    areasAtendidas: listaDeAreas(ler("areasAtendidas")),
    site: ler("site"),
    informacoesSociais: ler("informacoesSociais"),
    ...categorias(ler),
  };
}

export function lerNovoPerfil(ler: Ler) {
  return { ...lerCamposPerfil(ler), slug: ler("slug") };
}

export function lerImagensPerfil(f: FormData) {
  const textos = (n: string) => f.getAll(n).filter((v): v is string => typeof v === "string");
  return {
    imagemPath: lerDeFormData(f)("imagemPath"),
    bannersPaths: textos("bannersPaths"),
    fotosPaths: textos("fotosPaths"),
  };
}

export const CAMPOS_ITEM = [
  "tipo",
  "origem",
  "perfilId",
  "nome",
  "descricao",
  "categoriaPrincipalId",
  "categoriaSecundaria1",
  "categoriaSecundaria2",
  "precoModo",
  "precoValor",
  "cidade",
  "uf",
] as const;

/** Preço: "" = sem preço; "sob_consulta" não leva valor; "fixo" e "a_partir_de" convertem R$ em centavos. */
export function lerPreco(ler: Ler): unknown {
  const modo = ler("precoModo");
  if (modo === "") return null;
  if (modo === "sob_consulta") return { modo, centavos: null };
  // Valor ilegível vira NaN: o schema do módulo responde com a mensagem de faixa de valor.
  return { modo, centavos: parsearReaisParaCentavos(ler("precoValor")) ?? Number.NaN };
}

/**
 * Cidade e UF só existem no anúncio particular (D-008, IM-015). Item de perfil herda a localização do perfil:
 * o formulário nem mostra os campos e eles nunca seguem para o módulo.
 */
function localizacaoDoAnuncio(ler: Ler) {
  return ler("origem") === "anuncio" ? { cidade: ler("cidade"), uf: ler("uf") } : {};
}

export function lerCamposItem(ler: Ler) {
  return {
    nome: ler("nome"),
    descricao: ler("descricao"),
    preco: lerPreco(ler),
    ...categorias(ler),
    ...localizacaoDoAnuncio(ler),
  };
}

export function lerNovoItem(ler: Ler) {
  const perfilId = vazioParaNulo(ler("perfilId"));
  return { ...lerCamposItem(ler), tipo: ler("tipo"), perfilId };
}

/** Item de perfil exige escolher o perfil (anúncio particular não tem perfil, IM-015). */
export function perfilObrigatorioFaltando(ler: Ler): boolean {
  return ler("origem") === "perfil" && vazioParaNulo(ler("perfilId")) === null;
}

export const MENSAGEM_ESCOLHA_PERFIL = "Escolha o perfil do item.";
