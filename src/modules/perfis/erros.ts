import { alvoDoErro, classificarErroBanco, lerTetoAtingido } from "@/shared/conteudo/erros-banco";
import type { ErroBanco } from "@/shared/conteudo/resultado";

/** Mensagens ao usuário (pt-BR). Nunca incluem texto vindo do banco. */
export const MENSAGENS_PERFIS = {
  generica: "Não foi possível concluir agora. Tente novamente em instantes.",
  naoEncontrado: "Site não encontrado.",
  semPermissao: "Você não tem permissão para esta ação.",
  emAnalise: "Este site está em análise. Aguarde a decisão antes de editar.",
  naoAprovado: "Só é possível publicar um site depois de aprovado.",
  incompleto: "Preencha os campos obrigatórios antes de enviar para aprovação.",
  conflito: "Já existe uma edição em andamento neste site. Recarregue a página.",
  nenhumRascunho: "Não há rascunho para enviar. Edite o site e tente de novo.",
  slugIndisponivel: "Este endereço já está em uso. Escolha outro.",
  slugCongelado: "O endereço não pode mais ser alterado depois da primeira aprovação.",
  categoriaInvalida: "Confira as categorias escolhidas.",
  imagemInvalida: "Imagem inválida. Envie novamente.",
  informacoesSociais: "Informe apenas texto nas informações sociais: sem links nem @.",
  whatsappInvalido: "Informe um WhatsApp comercial válido.",
  siteInvalido: "Informe um endereço de site válido.",
  textoInvalido: "Confira os dados informados.",
  limiteGenerico:
    "Você atingiu o limite de criação da sua conta. Para criar outro, fale com o suporte.",
} as const;

/** Tetos de criação por conta (D-035). Sem prometer exclusão: não existe excluir perfil. Só texto fixo + número. */
export function mensagemLimitePerfis(
  chave: "tetos_perfis_por_conta" | "tetos_rascunhos_abertos",
  limite: number | null,
): string {
  if (chave === "tetos_perfis_por_conta") {
    return limite === null
      ? "Você atingiu o limite de sites comerciais por conta. Para criar outro, fale com o suporte."
      : `Você atingiu o limite de ${limite} ${limite === 1 ? "site comercial" : "sites comerciais"} por conta. Para criar outro, fale com o suporte.`;
  }
  return limite === null
    ? "Você atingiu o limite de rascunhos abertos. Envie um para aprovação antes de criar outro, ou fale com o suporte."
    : `Você atingiu o limite de ${limite} ${limite === 1 ? "rascunho aberto" : "rascunhos abertos"}. Envie um para aprovação antes de criar outro, ou fale com o suporte.`;
}

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
  | "ESTILO_INDISPONIVEL"
  | "LIMITE_BANNERS"
  | "LIMITE_CONTA"
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
  const teto = lerTetoAtingido(e);
  if (e.code === "P0430") {
    if (teto?.chave === "tetos_perfis_por_conta" || teto?.chave === "tetos_rascunhos_abertos") {
      return erroPerfis("LIMITE_CONTA", mensagemLimitePerfis(teto.chave, teto.limite));
    }
    return erroPerfis("LIMITE_CONTA", MENSAGENS_PERFIS.limiteGenerico);
  }
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
    if (/n[ãa]o encontrad/i.test(alvo)) return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
    return erroPerfis("SEM_PERMISSAO", M.semPermissao);
  }
  if (classe === "NAO_ENCONTRADO") return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
  if (classe === "ESTADO_INVALIDO") {
    // perfis_gravar_versao recusa quando há versão pendente.
    if (/pendente/i.test(alvo)) return erroPerfis("EM_ANALISE", M.emAnalise);
    return erroPerfis("ESTADO_INVALIDO", M.conflito);
  }
  return erroPerfis("ERRO_INTERNO", M.generica);
}
