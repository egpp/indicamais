import { validarCategorias } from "@/shared/conteudo/categorias";
import { caminhoDaConta } from "@/shared/conteudo/imagens";
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

/** Coerência do conteúdo inteiro depois do patch: categorias e imagens dentro da pasta da conta. */
export function validarConteudoPerfil(c: ConteudoPerfil, contaId: string): Record<string, string> {
  const erros: Record<string, string> = {};
  const cat = validarCategorias({
    principalId: c.categoriaPrincipalId,
    secundariasIds: c.categoriasSecundariasIds,
  });
  if (cat) erros.categoriasSecundariasIds = cat;
  if (c.imagemPath !== null && !caminhoDaConta(contaId, c.imagemPath)) {
    erros.imagemPath = "Imagem inválida. Envie novamente.";
  }
  if (c.bannersPaths.some((p) => !caminhoDaConta(contaId, p))) {
    erros.bannersPaths = "Imagem inválida. Envie novamente.";
  }
  if (c.fotosPaths.some((p) => !caminhoDaConta(contaId, p))) {
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
