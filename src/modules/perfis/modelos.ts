import { categoriasParaColunas, colunasParaCategorias } from "@/shared/conteudo/categorias";
import type { SituacaoVersao } from "@/shared/conteudo/ciclo-versao";

/** Linhas como o banco devolve. */
export type LinhaPerfil = {
  id: string;
  responsavel_id: string;
  slug: string;
  publicado: boolean;
  versao_aprovada_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type LinhaVersaoPerfil = {
  id: string;
  perfil_id: string;
  situacao: SituacaoVersao;
  nome: string | null;
  descricao_breve: string | null;
  imagem_path: string | null;
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  areas_atendidas: string[];
  banners_paths: string[];
  fotos_paths: string[];
  site: string | null;
  informacoes_sociais: string | null;
  criado_em: string;
  enviada_em: string | null;
  /** Vem de perfis_perfil_versao_contato (o adaptador junta). Só o dono e o admin leem. */
  whatsapp_comercial_e164: string | null;
};

/** Linha da visão perfis_perfil_publico. Sem responsável, sem WhatsApp, sem e-mail. */
export type LinhaPerfilPublico = {
  id: string;
  slug: string;
  nome: string | null;
  descricao_breve: string | null;
  imagem_path: string | null;
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  areas_atendidas: string[];
  banners_paths: string[];
  fotos_paths: string[];
  site: string | null;
  informacoes_sociais: string | null;
};

/** Conteúdo editável de uma versão de perfil, em forma de domínio (inclui o WhatsApp comercial, que é privado). */
export type ConteudoPerfil = {
  nome: string | null;
  descricaoBreve: string | null;
  imagemPath: string | null;
  categoriaPrincipalId: string | null;
  categoriasSecundariasIds: string[];
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  areasAtendidas: string[];
  bannersPaths: string[];
  fotosPaths: string[];
  site: string | null;
  informacoesSociais: string | null;
  whatsappComercialE164: string | null;
};

export const CONTEUDO_PERFIL_VAZIO: ConteudoPerfil = {
  nome: null,
  descricaoBreve: null,
  imagemPath: null,
  categoriaPrincipalId: null,
  categoriasSecundariasIds: [],
  cidade: null,
  uf: null,
  endereco: null,
  areasAtendidas: [],
  bannersPaths: [],
  fotosPaths: [],
  site: null,
  informacoesSociais: null,
  whatsappComercialE164: null,
};

export function conteudoDeVersao(v: LinhaVersaoPerfil): ConteudoPerfil {
  const cat = colunasParaCategorias(v);
  return {
    nome: v.nome,
    descricaoBreve: v.descricao_breve,
    imagemPath: v.imagem_path,
    categoriaPrincipalId: cat.principalId,
    categoriasSecundariasIds: cat.secundariasIds,
    cidade: v.cidade,
    uf: v.uf,
    endereco: v.endereco,
    areasAtendidas: [...v.areas_atendidas],
    bannersPaths: [...v.banners_paths],
    fotosPaths: [...v.fotos_paths],
    site: v.site,
    informacoesSociais: v.informacoes_sociais,
    whatsappComercialE164: v.whatsapp_comercial_e164,
  };
}

/** Colunas de perfis_perfil_versao (o WhatsApp vai por tabela à parte). */
export function colunasDeConteudo(c: ConteudoPerfil) {
  return {
    nome: c.nome,
    descricao_breve: c.descricaoBreve,
    imagem_path: c.imagemPath,
    ...categoriasParaColunas({
      principalId: c.categoriaPrincipalId,
      secundariasIds: c.categoriasSecundariasIds,
    }),
    cidade: c.cidade,
    uf: c.uf,
    endereco: c.endereco,
    areas_atendidas: c.areasAtendidas,
    banners_paths: c.bannersPaths,
    fotos_paths: c.fotosPaths,
    site: c.site,
    informacoes_sociais: c.informacoesSociais,
  };
}
export type ColunasVersaoPerfil = ReturnType<typeof colunasDeConteudo>;

/**
 * Modelo de exibição do perfil: o MESMO formato na página pública e na prévia (IM-017).
 * Por construção NÃO tem WhatsApp comercial, responsável nem e-mail (IM-029); a página pública
 * não mostra o número (decisão provisória do gestor: só o botão de contato, na Fase 3).
 * Os campos são copiados um a um: coluna extra na linha de origem nunca chega aqui.
 */
export type PerfilExibicao = {
  id: string;
  slug: string;
  nome: string | null;
  descricaoBreve: string | null;
  imagemPath: string | null;
  categoriaPrincipalId: string | null;
  categoriasSecundariasIds: string[];
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  areasAtendidas: string[];
  bannersPaths: string[];
  fotosPaths: string[];
  site: string | null;
  informacoesSociais: string | null;
};

export function paraPerfilExibicao(
  base: { id: string; slug: string },
  c: Omit<ConteudoPerfil, "whatsappComercialE164"> & { whatsappComercialE164?: unknown },
): PerfilExibicao {
  return {
    id: base.id,
    slug: base.slug,
    nome: c.nome,
    descricaoBreve: c.descricaoBreve,
    imagemPath: c.imagemPath,
    categoriaPrincipalId: c.categoriaPrincipalId,
    categoriasSecundariasIds: [...c.categoriasSecundariasIds],
    cidade: c.cidade,
    uf: c.uf,
    endereco: c.endereco,
    areasAtendidas: [...c.areasAtendidas],
    bannersPaths: [...c.bannersPaths],
    fotosPaths: [...c.fotosPaths],
    site: c.site,
    informacoesSociais: c.informacoesSociais,
  };
}

/** Linha da visão pública -> modelo público. */
export function paraPerfilPublico(l: LinhaPerfilPublico): PerfilExibicao {
  return paraPerfilExibicao(
    { id: l.id, slug: l.slug },
    conteudoDeVersao({
      id: "",
      perfil_id: l.id,
      situacao: "aprovada",
      nome: l.nome,
      descricao_breve: l.descricao_breve,
      imagem_path: l.imagem_path,
      categoria_principal_id: l.categoria_principal_id,
      categoria_secundaria_1_id: l.categoria_secundaria_1_id,
      categoria_secundaria_2_id: l.categoria_secundaria_2_id,
      cidade: l.cidade,
      uf: l.uf,
      endereco: l.endereco,
      areas_atendidas: l.areas_atendidas ?? [],
      banners_paths: l.banners_paths ?? [],
      fotos_paths: l.fotos_paths ?? [],
      site: l.site,
      informacoes_sociais: l.informacoes_sociais,
      criado_em: "",
      enviada_em: null,
      whatsapp_comercial_e164: null,
    }),
  );
}
