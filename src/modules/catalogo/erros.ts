import { alvoDoErro, classificarErroBanco, lerTetoAtingido } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_CATALOGO = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  naoEncontrado: "Item não encontrado.",
  semPermissao: "Você não tem permissão para esta ação.",
  emAnalise: "Este item está em análise. Aguarde a decisão antes de editar.",
  naoAprovado: "Só é possível publicar um item depois de aprovado.",
  incompleto: "Preencha os campos obrigatórios antes de enviar para aprovação.",
  conflito: "Já existe uma edição em andamento neste item. Recarregue a página.",
  nenhumRascunho: "Não há rascunho para enviar. Edite o item e tente de novo.",
  categoriaInvalida: "Confira as categorias escolhidas.",
  perfilInvalido: "Perfil não encontrado ou não pertence à sua conta.",
  precoInvalido: "Confira o preço informado.",
  localizacaoInvalida: "Confira a cidade e a UF informadas.",
  imagemInvalida: "Imagem inválida. Envie novamente.",
  textoInvalido: "Confira os textos informados.",
  categoriaDuplicada: "Já existe uma categoria com este nome.",
  categoriaJaExiste: "Esta categoria já existe. Escolha-a na lista.",
  limiteSolicitacoes:
    "Você já tem pedidos de categoria em análise. Aguarde a resposta antes de pedir outra.",
  solicitacaoDecidida: "Este pedido já foi respondido.",
  motivoObrigatorio: "Informe o motivo.",
  lojaNaoLiberada: "A Loja não está liberada para este perfil.",
  imovelInvalido: "Confira os dados do imóvel.",
  imovelIncompleto:
    "Preencha tipo, finalidade, preço, área, quartos, banheiros, vagas, bairro, cidade e UF antes de enviar.",
  imovelSemPerfil: "O imóvel pertence a um perfil. Escolha o perfil.",
  camposImovelForaDeImovel: "Os campos de imóvel só valem para itens do tipo imóvel.",
  fotosExtrasLimite: "Envie no máximo 8 fotos adicionais.",
  fotoRepetida: "Não repita a mesma foto.",
  filtrosInvalidos: "Confira os filtros informados.",
  limiteGenerico:
    "Você atingiu o limite de criação da sua conta. Para criar outro, fale com o suporte.",
} as const;

type ChaveLimiteCatalogo =
  "tetos_itens_por_perfil" | "tetos_anuncios_particulares" | "tetos_rascunhos_abertos";

/** Tetos de criação por conta (D-035). Sem prometer exclusão: não existe excluir item. Só texto fixo + número. */
export function mensagemLimiteCatalogo(chave: ChaveLimiteCatalogo, limite: number | null): string {
  const n = (s: string, p: string) => (limite === null ? p : `${limite} ${limite === 1 ? s : p}`);
  switch (chave) {
    case "tetos_itens_por_perfil":
      return `Este perfil atingiu o limite de ${n("item", "itens")}. Para cadastrar outro, fale com o suporte.`;
    case "tetos_anuncios_particulares":
      return `Você atingiu o limite de ${n("anúncio particular", "anúncios particulares")} por conta. Para criar outro, fale com o suporte.`;
    case "tetos_rascunhos_abertos":
      return `Você atingiu o limite de ${n("rascunho aberto", "rascunhos abertos")}. Envie um para aprovação antes de criar outro, ou fale com o suporte.`;
  }
}

export type CodigoErroCatalogo =
  | "VALIDACAO"
  | "INCOMPLETO"
  | "NAO_ENCONTRADO"
  | "SEM_PERMISSAO"
  | "LOJA_NAO_LIBERADA"
  | "EM_ANALISE"
  | "NAO_APROVADO"
  | "CONFLITO"
  | "CATEGORIA_INVALIDA"
  | "CATEGORIA_DUPLICADA"
  | "LIMITE_SOLICITACOES"
  | "LIMITE_CONTA"
  | "ESTADO_INVALIDO"
  | "ERRO_INTERNO";

export type ErroCatalogo = {
  codigo: CodigoErroCatalogo;
  mensagem: string;
  /** Mensagem por campo (validação de formulário). */
  campos?: Record<string, string>;
  /** Itens que faltam para enviar (IM-017). */
  pendencias?: string[];
};

export const erroCatalogo = (
  codigo: CodigoErroCatalogo,
  mensagem: string,
  extra: Partial<Pick<ErroCatalogo, "campos" | "pendencias">> = {},
): ErroCatalogo => ({ codigo, mensagem, ...extra });

/** Mapeia erros do Postgres/funções para mensagens pt-BR genéricas. */
export function mapearErroBancoCatalogo(e: ErroBanco): ErroCatalogo {
  if (e.code === "P0430") {
    const teto = lerTetoAtingido(e);
    if (teto && teto.chave !== "tetos_perfis_por_conta") {
      return erroCatalogo("LIMITE_CONTA", mensagemLimiteCatalogo(teto.chave, teto.limite));
    }
    return erroCatalogo("LIMITE_CONTA", MENSAGENS_CATALOGO.limiteGenerico);
  }
  const classe = classificarErroBanco(e);
  const alvo = alvoDoErro(e);
  const M = MENSAGENS_CATALOGO;

  if (classe === "DUPLICADO") {
    if (/uma_aberta/i.test(alvo)) return erroCatalogo("CONFLITO", M.conflito);
    if (/catalogo_categoria_(slug_unico|nome_unico)|nome_unico|slug_unico/i.test(alvo)) {
      return erroCatalogo("CATEGORIA_DUPLICADA", M.categoriaDuplicada);
    }
    return erroCatalogo("CONFLITO", M.conflito);
  }
  if (classe === "CHECK") {
    // Loja e imóveis (IM-097, IM-098): checar antes dos padrões genéricos (a mensagem do imóvel cita preço/cidade).
    if (/im[óo]vel exige/i.test(alvo)) return erroCatalogo("INCOMPLETO", M.imovelIncompleto);
    if (/im[óo]vel pertence a um perfil/i.test(alvo)) {
      return erroCatalogo("VALIDACAO", M.imovelSemPerfil);
    }
    if (/campos de im[óo]vel/i.test(alvo)) {
      return erroCatalogo("VALIDACAO", M.camposImovelForaDeImovel);
    }
    if (/fotos_extras|foto adicional repetida/i.test(alvo)) {
      return /repetida/i.test(alvo)
        ? erroCatalogo("VALIDACAO", M.fotoRepetida)
        : erroCatalogo("VALIDACAO", M.fotosExtrasLimite);
    }
    if (/foto adicional/i.test(alvo)) return erroCatalogo("VALIDACAO", M.imagemInvalida);
    if (
      /versao_(imovel_tipo|finalidade|area|quartos|banheiros|vagas|bairro|condominio|iptu)/i.test(
        alvo,
      )
    ) {
      return erroCatalogo("VALIDACAO", M.imovelInvalido);
    }
    if (/versao_preco|preco/i.test(alvo)) return erroCatalogo("VALIDACAO", M.precoInvalido);
    if (/versao_completa/i.test(alvo)) return erroCatalogo("INCOMPLETO", M.incompleto);
    if (/publicado_exige_aprovada/i.test(alvo)) return erroCatalogo("NAO_APROVADO", M.naoAprovado);
    if (/categoria/i.test(alvo)) return erroCatalogo("CATEGORIA_INVALIDA", M.categoriaInvalida);
    if (/cidade|localiza|_uf/i.test(alvo)) {
      return erroCatalogo("VALIDACAO", M.localizacaoInvalida);
    }
    if (/imagem|foto/i.test(alvo)) return erroCatalogo("VALIDACAO", M.imagemInvalida);
    return erroCatalogo("VALIDACAO", M.textoInvalido);
  }
  if (classe === "REFERENCIA") {
    if (/perfil/i.test(alvo)) return erroCatalogo("VALIDACAO", M.perfilInvalido);
    if (/categoria/i.test(alvo)) return erroCatalogo("CATEGORIA_INVALIDA", M.categoriaInvalida);
    return erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado);
  }
  if (classe === "PERMISSAO") {
    // Loja não liberada (gatilhos de catalogo_item e catalogo_item_versao): sem revelar mais nada.
    if (/loja/i.test(alvo)) return erroCatalogo("LOJA_NAO_LIBERADA", M.lojaNaoLiberada);
    // RLS/privilégio ou "versão não encontrada" (a função não revela se existe de outro dono).
    if (/imut|enviada|hist[óo]rico|identidade/i.test(alvo)) {
      return erroCatalogo("EM_ANALISE", M.emAnalise);
    }
    if (/n[ãa]o encontrad/i.test(alvo)) return erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado);
    return erroCatalogo("SEM_PERMISSAO", M.semPermissao);
  }
  if (classe === "NAO_ENCONTRADO") return erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado);
  if (classe === "ESTADO_INVALIDO") {
    if (/limite/i.test(alvo)) return erroCatalogo("LIMITE_SOLICITACOES", M.limiteSolicitacoes);
    if (/pedido j[áa] decidido/i.test(alvo)) {
      return erroCatalogo("ESTADO_INVALIDO", M.solicitacaoDecidida);
    }
    return erroCatalogo("ESTADO_INVALIDO", M.conflito);
  }
  if (classe === "DADO_INVALIDO") return erroCatalogo("VALIDACAO", M.motivoObrigatorio);
  return erroCatalogo("ERRO_INTERNO", M.generica);
}
