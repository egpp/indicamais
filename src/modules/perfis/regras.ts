import { validarCategorias } from "@/shared/conteudo/categorias";
import { caminhoDaPasta } from "@/shared/conteudo/imagens";
import type { CamposPerfil } from "./schemas";
import type { ConteudoPerfil } from "./modelos";

/** Aplica o patch (undefined = mantém; null = limpa). Função pura. */
export function aplicarCamposPerfil(base: ConteudoPerfil, c: CamposPerfil): ConteudoPerfil {
  return {
    nome: c.nome === undefined ? base.nome : c.nome,
    descricaoBreve: c.descricaoBreve === undefined ? base.descricaoBreve : c.descricaoBreve,
    imagemPath: c.imagemPath === undefined ? base.imagemPath : c.imagemPath,
    categoriaPrincipalId:
      c.categoriaPrincipalId === undefined ? base.categoriaPrincipalId : c.categoriaPrincipalId,
    categoriasSecundariasIds: c.categoriasSecundariasIds ?? base.categoriasSecundariasIds,
    cidade: c.cidade === undefined ? base.cidade : c.cidade,
    uf: c.uf === undefined ? base.uf : c.uf,
    endereco: c.endereco === undefined ? base.endereco : c.endereco,
    areasAtendidas: c.areasAtendidas ?? base.areasAtendidas,
    bannersPaths: c.bannersPaths ?? base.bannersPaths,
    fotosPaths: c.fotosPaths ?? base.fotosPaths,
    site: c.site === undefined ? base.site : c.site,
    informacoesSociais:
      c.informacoesSociais === undefined ? base.informacoesSociais : c.informacoesSociais,
    whatsappComercialE164:
      c.whatsappComercial === undefined ? base.whatsappComercialE164 : c.whatsappComercial,
  };
}

/**
 * Coerência do conteúdo inteiro depois do patch: categorias, WhatsApp comercial obrigatório e imagens dentro da
 * pasta `perfil/<perfilId>/`. `perfilId: null` = perfil ainda não existe (criação): nenhuma imagem é aceita,
 * porque o upload só acontece depois de criar o rascunho.
 */
export function validarConteudoPerfil(
  c: ConteudoPerfil,
  perfilId: string | null,
): Record<string, string> {
  const erros: Record<string, string> = {};
  const cat = validarCategorias({
    principalId: c.categoriaPrincipalId,
    secundariasIds: c.categoriasSecundariasIds,
  });
  if (cat) erros.categoriasSecundariasIds = cat;
  if (!c.whatsappComercialE164) erros.whatsappComercial = "Informe o WhatsApp comercial.";
  const naPasta = (p: string) => perfilId !== null && caminhoDaPasta("perfil", perfilId, p);
  if (c.imagemPath !== null && !naPasta(c.imagemPath)) {
    erros.imagemPath = "Imagem inválida. Envie novamente.";
  }
  if (c.bannersPaths.some((p) => !naPasta(p))) {
    erros.bannersPaths = "Imagem inválida. Envie novamente.";
  }
  if (c.fotosPaths.some((p) => !naPasta(p))) {
    erros.fotosPaths = "Imagem inválida. Envie novamente.";
  }
  return erros;
}

/** O que falta para enviar à aprovação (IM-011, IM-017). Lista vazia = pronto. */
export function pendenciasDoPerfil(c: ConteudoPerfil): string[] {
  const p: string[] = [];
  if (!c.nome) p.push("Informe o nome.");
  if (!c.descricaoBreve) p.push("Informe a descrição breve.");
  if (!c.imagemPath) p.push("Envie a imagem do perfil.");
  if (!c.categoriaPrincipalId) p.push("Escolha a categoria principal.");
  if (!c.cidade) p.push("Informe a cidade.");
  if (!c.uf) p.push("Escolha a UF.");
  if (!c.whatsappComercialE164) p.push("Informe o WhatsApp comercial.");
  return p;
}
