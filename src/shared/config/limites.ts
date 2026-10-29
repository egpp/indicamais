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
  item: { nomeMax: 100, descricaoMax: 1500, cidadeMin: 2 },
  preco: { minCentavos: 1, maxCentavos: 100_000_000 },
  categoria: { nomeMin: 2, nomeMax: 60, justificativaMax: 300, pendentesMaxPorConta: 5 },
  revisao: { motivoMax: 500 },
  /** Patrocinadores do carrossel (IM-020, D-008). Sem preço nem cobrança. */
  patrocinador: { tituloMin: 2, tituloMax: 60, textoDestinoMax: 200, maximoNoCarrossel: 20 },
  /** Busca pública (IM-019): limites também impostos no banco (busca_publica). */
  busca: { termoMax: 80, cidadeMax: 80, limitePadrao: 20, limiteMax: 50, paginaMax: 1000 },
  /**
   * Pedido de contato do visitante (IM-026): limites também impostos no banco (indicacoes_enviar_contato e
   * CHECKs de indicacoes_pedido_contato). Janela anti-repetição e limite de taxa são parâmetros no banco
   * (tabela indicacoes_parametro), não constantes aqui.
   */
  contato: {
    nomeMin: 2,
    nomeMax: 80,
    emailMax: 254,
    mensagemMax: 1000,
    chaveMin: 16,
    chaveMax: 100,
  },
} as const;

export type TipoImagem = (typeof LIMITES.imagem.tiposPermitidos)[number];
