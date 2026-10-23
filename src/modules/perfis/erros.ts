import { alvoDoErro, classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_PERFIS = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  naoEncontrado: "Perfil não encontrado.",
  semPermissao: "Você não tem permissão para esta ação.",
  emAnalise: "Este perfil está em análise. Aguarde a decisão antes de editar.",
  naoAprovado: "Só é possível publicar um perfil depois de aprovado.",
  incompleto: "Preencha os campos obrigatórios antes de enviar para aprovação.",
  conflito: "Já existe uma edição em andamento neste perfil. Recarregue a página.",
  nenhumRascunho: "Não há rascunho para enviar. Edite o perfil e tente de novo.",
  slugIndisponivel: "Este endereço já está em uso. Escolha outro.",
  slugCongelado: "O endereço não pode mais ser alterado depois da primeira aprovação.",
  categoriaInvalida: "Confira as categorias escolhidas.",
  imagemInvalida: "Imagem inválida. Envie novamente.",
  informacoesSociais: "Informe apenas texto nas informações sociais: sem links nem @.",
  whatsappInvalido: "Informe um WhatsApp comercial válido.",
  siteInvalido: "Informe um endereço de site válido.",
  textoInvalido: "Confira os dados informados.",
} as const;

export type CodigoErroPerfis =
  | "VALIDACAO"
  | "INCOMPLETO"
  | "NAO_ENCONTRADO"
  | "SEM_PERMISSAO"
  | "EM_ANALISE"
  | "NAO_APROVADO"
  | "CONFLITO"
  | "SLUG_INDISPONIVEL"
  | "SLUG_RESERVADO"
  | "SLUG_INVALIDO"
  | "SLUG_CONGELADO"
  | "ESTADO_INVALIDO"
  | "ERRO_INTERNO";

export type ErroPerfis = {
  codigo: CodigoErroPerfis;
  mensagem: string;
  campos?: Record<string, string>;
  pendencias?: string[];
};

export const erroPerfis = (
  codigo: CodigoErroPerfis,
  mensagem: string,
  extra: Partial<Pick<ErroPerfis, "campos" | "pendencias">> = {},
): ErroPerfis => ({ codigo, mensagem, ...extra });

/** Mapeia erros do Postgres/funções para mensagens pt-BR genéricas (23505, 23514, 42501, P000x). */
export function mapearErroBancoPerfis(e: ErroBanco): ErroPerfis {
  const classe = classificarErroBanco(e);
  const alvo = alvoDoErro(e);
  const M = MENSAGENS_PERFIS;

  if (classe === "DUPLICADO") {
    if (/slug/i.test(alvo)) return erroPerfis("SLUG_INDISPONIVEL", M.slugIndisponivel);
    return erroPerfis("CONFLITO", M.conflito);
  }
  if (classe === "CHECK") {
    if (/sociais/i.test(alvo)) return erroPerfis("VALIDACAO", M.informacoesSociais);
    if (/completa/i.test(alvo)) return erroPerfis("INCOMPLETO", M.incompleto);
    if (/publicado_exige_aprovada/i.test(alvo)) return erroPerfis("NAO_APROVADO", M.naoAprovado);
    if (/slug/i.test(alvo)) {
      return erroPerfis(
        "SLUG_INVALIDO",
        "Endereço inválido. Use letras minúsculas, números e hífen.",
      );
    }
    if (/whatsapp/i.test(alvo)) return erroPerfis("VALIDACAO", M.whatsappInvalido);
    if (/categoria/i.test(alvo)) return erroPerfis("VALIDACAO", M.categoriaInvalida);
    if (/imagem|banners|fotos/i.test(alvo)) return erroPerfis("VALIDACAO", M.imagemInvalida);
    if (/site/i.test(alvo)) return erroPerfis("VALIDACAO", M.siteInvalido);
    return erroPerfis("VALIDACAO", M.textoInvalido);
  }
  if (classe === "REFERENCIA") {
    if (/categoria/i.test(alvo)) return erroPerfis("VALIDACAO", M.categoriaInvalida);
    return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
  }
  if (classe === "PERMISSAO") {
    if (/slug/i.test(alvo)) return erroPerfis("SLUG_CONGELADO", M.slugCongelado);
    if (/imut|enviada|hist[óo]rico|identidade/i.test(alvo)) {
      return erroPerfis("EM_ANALISE", M.emAnalise);
    }
    return erroPerfis("SEM_PERMISSAO", M.semPermissao);
  }
  if (classe === "NAO_ENCONTRADO") return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
  if (classe === "ESTADO_INVALIDO") return erroPerfis("ESTADO_INVALIDO", M.conflito);
  return erroPerfis("ERRO_INTERNO", M.generica);
}
