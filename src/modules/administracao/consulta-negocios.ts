import { z } from "zod";
import type { ErroBanco, RespostaBanco } from "@/shared/conteudo/resultado";
import { erroAdm, MENSAGENS_ADMINISTRACAO, type ErroAdministracao } from "./erros";

/** Consulta somente leitura de perfis e itens (D-009, IM-021, IM-077 parte). Sem ações, sem dado privado. */

export const POR_PAGINA_NEGOCIOS = 20;
export const BUSCA_NEGOCIOS_MAX = 80;

export const SITUACOES_NEGOCIO = ["rascunho", "pendente", "aprovada", "rejeitada"] as const;
export const TIPOS_NEGOCIO = ["perfil", "item"] as const;

/** Entrada da tela (query string). Valores desconhecidos viram "sem filtro" em vez de erro. */
export const filtroNegociosSchema = z.object({
  busca: z
    .string()
    .trim()
    .max(BUSCA_NEGOCIOS_MAX)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v : undefined)),
  situacao: z.enum(SITUACOES_NEGOCIO).optional().catch(undefined),
  tipo: z.enum(TIPOS_NEGOCIO).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(10000).optional().catch(1),
});
export type FiltroNegociosEntrada = {
  busca?: string | undefined;
  situacao?: string | undefined;
  tipo?: string | undefined;
  pagina?: string | number | undefined;
};

/** Escapa os curingas do LIKE (barra, % e _) para a busca ser literal. */
export function escaparCuringasLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Linha de public.administracao_consulta_negocios (as colunas são anuláveis nos tipos gerados). */
export type LinhaConsultaNegocio = {
  alvo_tipo: string | null;
  alvo_id: string | null;
  dono_id: string | null;
  versao_id: string | null;
  nome: string | null;
  categoria: string | null;
  cidade: string | null;
  uf: string | null;
  situacao: string | null;
  tem_versao_aprovada: boolean | null;
  publicado: boolean | null;
  disponivel: boolean | null;
  item_tipo: string | null;
  perfil_id: string | null;
  slug: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type ConsultaBanco = {
  /** Busca já escapada (sem os %); o adaptador monta `%...%`. */
  buscaLike?: string;
  situacao?: (typeof SITUACOES_NEGOCIO)[number];
  tipo?: (typeof TIPOS_NEGOCIO)[number];
  /** range() inclusivo, ordenado por atualizado_em desc. */
  de: number;
  ate: number;
};

export type ClienteBancoConsultaNegocios = {
  /** rpc administracao_eh_admin; falha = false. */
  ehAdministrador(): Promise<boolean>;
  /** select na visão administracao_consulta_negocios com os filtros e o range. */
  consultarNegocios(c: ConsultaBanco): Promise<RespostaBanco<LinhaConsultaNegocio[]>>;
};

export type NegocioConsultado = {
  chave: string;
  tipo: "perfil" | "item";
  tipoRotulo: string;
  nome: string;
  categoria: string | null;
  local: string | null;
  donoId: string | null;
  situacaoRotulo: string;
  publicacaoRotulo: string;
  indisponivel: boolean;
  /** Página pública, só quando disponível. */
  hrefPublico: string | null;
  /** Tela de revisão, só quando há versão pendente e não há página pública. */
  hrefRevisao: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

export type PaginaNegocios = {
  itens: NegocioConsultado[];
  pagina: number;
  temAnterior: boolean;
  temProxima: boolean;
};

export function rotuloSituacaoNegocio(situacao: string | null, temVersaoAprovada: boolean): string {
  switch (situacao) {
    case "rascunho":
      return "Rascunho";
    case "pendente":
      return temVersaoAprovada ? "Pendente — já tem versão no ar" : "Pendente";
    case "aprovada":
      return "Aprovado";
    case "rejeitada":
      return temVersaoAprovada ? "Rejeitado — a versão anterior segue no ar" : "Rejeitado";
    default:
      return "Sem versão";
  }
}

function rotuloTipo(tipo: "perfil" | "item", itemTipo: string | null): string {
  if (tipo === "perfil") return "Perfil";
  if (itemTipo === "servico") return "Serviço";
  if (itemTipo === "produto") return "Produto";
  return "Produto ou serviço";
}

export function paraNegocioConsultado(l: LinhaConsultaNegocio): NegocioConsultado | null {
  if (!l.alvo_id || (l.alvo_tipo !== "perfil" && l.alvo_tipo !== "item")) return null;
  const tipo = l.alvo_tipo;
  const disponivel = l.disponivel === true;
  const local = [l.cidade, l.uf].filter(Boolean).join("/") || null;
  let hrefPublico: string | null = null;
  if (disponivel) {
    if (tipo === "item") hrefPublico = `/item/${l.alvo_id}`;
    else if (l.slug) hrefPublico = `/perfil/${encodeURIComponent(l.slug)}`;
  }
  const hrefRevisao =
    !hrefPublico && l.situacao === "pendente" && l.versao_id
      ? `/administracao/revisao/${tipo}/${l.versao_id}`
      : null;
  return {
    chave: `${tipo}:${l.alvo_id}`,
    tipo,
    tipoRotulo: rotuloTipo(tipo, l.item_tipo),
    nome: l.nome?.trim() || (tipo === "perfil" ? "Perfil sem nome" : "Item sem nome"),
    categoria: l.categoria,
    local,
    donoId: l.dono_id,
    situacaoRotulo: rotuloSituacaoNegocio(l.situacao, l.tem_versao_aprovada === true),
    publicacaoRotulo: l.publicado === true ? "Publicado" : "Despublicado",
    indisponivel: !disponivel,
    hrefPublico,
    hrefRevisao,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

export type ResultadoConsulta<T> = { ok: true; valor: T } | { ok: false; erro: ErroAdministracao };

function erroDoBanco(e: ErroBanco): ErroAdministracao {
  return e.code === "42501"
    ? erroAdm("SEM_PERMISSAO", MENSAGENS_ADMINISTRACAO.semPermissao)
    : erroAdm("ERRO_INTERNO", MENSAGENS_ADMINISTRACAO.generica);
}

export function criarServicoConsultaNegocios(banco: ClienteBancoConsultaNegocios) {
  async function ehAdministrador(): Promise<boolean> {
    try {
      return (await banco.ehAdministrador()) === true;
    } catch {
      return false;
    }
  }

  return {
    ehAdministrador,

    /** Lista paginada (20 por página). Pede uma linha a mais para saber se existe próxima página. */
    consultar: async (
      entrada: FiltroNegociosEntrada,
    ): Promise<ResultadoConsulta<PaginaNegocios>> => {
      try {
        if (!(await ehAdministrador())) {
          return {
            ok: false,
            erro: erroAdm("SEM_PERMISSAO", MENSAGENS_ADMINISTRACAO.semPermissao),
          };
        }
        const f = filtroNegociosSchema.parse(entrada ?? {});
        const pagina = f.pagina ?? 1;
        const de = (pagina - 1) * POR_PAGINA_NEGOCIOS;
        const r = await banco.consultarNegocios({
          ...(f.busca ? { buscaLike: escaparCuringasLike(f.busca) } : {}),
          ...(f.situacao ? { situacao: f.situacao } : {}),
          ...(f.tipo ? { tipo: f.tipo } : {}),
          de,
          ate: de + POR_PAGINA_NEGOCIOS,
        });
        if (r.erro) return { ok: false, erro: erroDoBanco(r.erro) };
        const linhas = r.dados ?? [];
        const itens = linhas
          .slice(0, POR_PAGINA_NEGOCIOS)
          .map(paraNegocioConsultado)
          .filter((n): n is NegocioConsultado => n !== null);
        return {
          ok: true,
          valor: {
            itens,
            pagina,
            temAnterior: pagina > 1,
            temProxima: linhas.length > POR_PAGINA_NEGOCIOS,
          },
        };
      } catch {
        return { ok: false, erro: erroAdm("ERRO_INTERNO", MENSAGENS_ADMINISTRACAO.generica) };
      }
    },
  };
}
export type ServicoConsultaNegocios = ReturnType<typeof criarServicoConsultaNegocios>;
