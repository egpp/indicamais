import type { MetadataRoute } from "next";
import { CAMINHOS_PRIVADOS } from "./_lib/caminhos-privados";
import { indexacaoLigada } from "./_lib/site";

/**
 * Enquanto a indexação pública estiver desligada (PUBLICO_INDEXAVEL, IM-089) bloqueia tudo; depois, bloqueia só
 * as áreas privadas. Não é controle de acesso: as páginas continuam protegidas no servidor.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: indexacaoLigada()
      ? { userAgent: "*", allow: "/", disallow: [...CAMINHOS_PRIVADOS] }
      : { userAgent: "*", disallow: "/" },
  };
}
