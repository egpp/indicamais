/**
 * Configuração central de limites de conteúdo (perfis, catálogo, revisão).
 * Valores de D-006 (imagens) e dos CHECKs do banco. Nenhuma regra repete estes números.
 * Quando o app é mais estrito que o banco (fotos: 6 contra 8), vale o app (D-006).
 */
export const LIMITES = {
  imagem: {
    tamanhoMaxBytes: 2 * 1024 * 1024,
    tiposPermitidos: ["image/jpeg", "image/png", "image/webp"],
    extensaoPorTipo: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
    /** Imagens por conta no Storage (política do banco). */
    maxPorConta: 100,
  },
  perfil: {
    nomeMax: 80,
    descricaoBreveMax: 280,
    cidadeMax: 80,
    enderecoMax: 200,
    areasMax: 20,
    areaMax: 60,
    areasTotalMax: 600,
    siteMax: 200,
    informacoesSociaisMax: 500,
    fotosMax: 6,
    bannersMax: 3,
    slugMin: 3,
    slugMax: 60,
  },
  categorias: { secundariasMax: 2 },
  item: { nomeMax: 100, descricaoMax: 1500 },
  preco: { minCentavos: 1, maxCentavos: 100_000_000 },
  categoria: { nomeMin: 2, nomeMax: 60, justificativaMax: 300, pendentesMaxPorConta: 5 },
  revisao: { motivoMax: 500 },
} as const;

export type TipoImagem = (typeof LIMITES.imagem.tiposPermitidos)[number];
