import { alvoDoErro, classificarErroBanco } from "@/shared/conteudo/erros-banco";
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
  imagemInvalida: "Imagem inválida. Envie novamente.",
  textoInvalido: "Confira os textos informados.",
  categoriaDuplicada: "Já existe uma categoria com este nome.",
  categoriaJaExiste: "Esta categoria já existe. Escolha-a na lista.",
  limiteSolicitacoes:
    "Você já tem pedidos de categoria em análise. Aguarde a resposta antes de pedir outra.",
  solicitacaoDecidida: "Este pedido já foi respondido.",
  motivoObrigatorio: "Informe o motivo.",
} as const;

export type CodigoErroCatalogo =
  | "VALIDACAO"
  | "INCOMPLETO"
  | "NAO_ENCONTRADO"
  | "SEM_PERMISSAO"
  | "EM_ANALISE"
  | "NAO_APROVADO"
  | "CONFLITO"
  | "CATEGORIA_INVALIDA"
  | "CATEGORIA_DUPLICADA"
  | "LIMITE_SOLICITACOES"
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
    if (/versao_preco|preco/i.test(alvo)) return erroCatalogo("VALIDACAO", M.precoInvalido);
    if (/versao_completa/i.test(alvo)) return erroCatalogo("INCOMPLETO", M.incompleto);
    if (/publicado_exige_aprovada/i.test(alvo)) return erroCatalogo("NAO_APROVADO", M.naoAprovado);
    if (/categoria/i.test(alvo)) return erroCatalogo("CATEGORIA_INVALIDA", M.categoriaInvalida);
    if (/imagem|foto/i.test(alvo)) return erroCatalogo("VALIDACAO", M.imagemInvalida);
    return erroCatalogo("VALIDACAO", M.textoInvalido);
  }
  if (classe === "REFERENCIA") {
    if (/perfil/i.test(alvo)) return erroCatalogo("VALIDACAO", M.perfilInvalido);
    if (/categoria/i.test(alvo)) return erroCatalogo("CATEGORIA_INVALIDA", M.categoriaInvalida);
    return erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado);
  }
  if (classe === "PERMISSAO") {
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
