import type { Metadata } from "next";
import { SEM_INDEXACAO, robotsPublico } from "./pagina";
import { urlAbsoluta } from "./site";

/** Resumo para descrição de prévia: sem quebras de linha, até `max` caracteres, termina em reticências se cortar. */
export function resumir(texto: string | null | undefined, max = 160): string | null {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (limpo === "") return null;
  return limpo.length > max ? `${limpo.slice(0, max - 1).trimEnd()}…` : limpo;
}

export const NOME_SITE = "IndicaMais";
export const DESCRICAO_PADRAO =
  "Encontre empresas, profissionais, produtos e serviços perto de você no IndicaMais.";

type Entrada = {
  titulo: string;
  descricao: string;
  /** Caminho do app ("/perfil/x"). A URL absoluta só sai se NEXT_PUBLIC_APP_URL estiver configurada. */
  caminho: string;
  /** URL ABSOLUTA da imagem (assinada no servidor). Sem imagem, a prévia usa o cartão pequeno. */
  imagemUrl?: string | null;
  imagemAlt?: string;
  /** Página com filtros (resultado de busca): nunca indexada, mesmo com a indexação ligada. */
  semIndexar?: boolean;
};

/**
 * Metadados de uma página pública: título, descrição, Open Graph e Twitter para a prévia no WhatsApp.
 * `robots` é noindex/nofollow até a variável PUBLICO_INDEXAVEL=sim (decisão do Emerson, IM-089).
 * Só leva o que está no modelo público: nunca WhatsApp, responsável, e-mail ou id de conta.
 */
export function metadadosPublicos(e: Entrada): Metadata {
  const url = urlAbsoluta(e.caminho);
  const imagens = e.imagemUrl ? [{ url: e.imagemUrl, alt: e.imagemAlt ?? e.titulo }] : undefined;
  return {
    title: e.titulo,
    description: e.descricao,
    ...(e.semIndexar ? SEM_INDEXACAO : robotsPublico()),
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title: e.titulo,
      description: e.descricao,
      siteName: NOME_SITE,
      locale: "pt_BR",
      type: "website",
      ...(url ? { url } : {}),
      ...(imagens ? { images: imagens } : {}),
    },
    twitter: {
      card: imagens ? "summary_large_image" : "summary",
      title: e.titulo,
      description: e.descricao,
      ...(imagens ? { images: [e.imagemUrl as string] } : {}),
    },
  };
}
