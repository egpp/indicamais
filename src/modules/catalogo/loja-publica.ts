import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import { errosPorCampo, semControle, uuidSchema } from "@/shared/conteudo/zod-util";
import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type { ErroBanco, RespostaBanco, Resultado } from "@/shared/conteudo/resultado";
import { ufSchema } from "@/shared/conteudo/ufs";
import { erroCatalogo, MENSAGENS_CATALOGO, type ErroCatalogo } from "./erros";
import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "./imovel";
import { conteudoDeVersao, paraItemExibicao, type ItemExibicao } from "./modelos";
import { TIPOS_ITEM } from "./schemas";

/**
 * Leitura PÚBLICA da Loja (IM-097, IM-098, D-020) e consulta "esta conta tem a Loja liberada neste perfil".
 * Lê só `loja_item_publico`, `loja_listar_imoveis` e `loja_liberacao`. Os cartões saem campo a campo: sem conta,
 * responsável, telefone, e-mail nem endereço exato (a coluna nem existe no banco). Sem carrinho nem venda (IM-090).
 */

export type ResultadoLoja<T> = Resultado<T, ErroCatalogo>;

/** Linha da visão loja_item_publico. */
export type LinhaLojaItemPublico = {
  id: string | null;
  perfil_id: string | null;
  perfil_slug: string | null;
  tipo: string | null;
  nome: string | null;
  descricao: string | null;
  foto_path: string | null;
  fotos_extras_paths: string[] | null;
  categoria_principal_id: string | null;
  categoria_secundaria_1_id: string | null;
  categoria_secundaria_2_id: string | null;
  preco_modo: string | null;
  preco_centavos: number | string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  imovel_tipo: string | null;
  finalidade: string | null;
  area_m2: number | string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  condominio_centavos: number | string | null;
  iptu_centavos: number | string | null;
  aceita_financiamento: boolean | null;
  criado_em: string | null;
};

/** Linha de loja_listar_imoveis (rpc). */
export type LinhaImovelListado = {
  o_id: string;
  o_perfil_id: string | null;
  o_perfil_slug: string | null;
  o_nome: string | null;
  o_descricao: string | null;
  o_foto_path: string | null;
  o_fotos_extras_paths: string[] | null;
  o_imovel_tipo: string | null;
  o_finalidade: string | null;
  o_preco_modo: string | null;
  o_preco_centavos: number | string | null;
  o_area_m2: number | string | null;
  o_quartos: number | null;
  o_banheiros: number | null;
  o_vagas: number | null;
  o_bairro: string | null;
  o_cidade: string | null;
  o_uf: string | null;
  o_condominio_centavos: number | string | null;
  o_iptu_centavos: number | string | null;
  o_aceita_financiamento: boolean | null;
  o_total: number | string | null;
};

/** Cartão público da Loja: o modelo de exibição do item, mais os links. Sem dado de pessoa. */
export type CartaoLoja = ItemExibicao & {
  perfilSlug: string | null;
  /** Página pública do item (a interface a atende; imóvel não tem página no catálogo simples). */
  link: string;
  /** Página do perfil dono. */
  perfilLink: string | null;
  /** Descrição cortada em 200 caracteres para listas. */
  descricaoCurta: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DESCRICAO_CURTA_MAX = 200;
const aparar = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const cortar = (t: string | null) =>
  t === null
    ? null
    : t.length > DESCRICAO_CURTA_MAX
      ? `${t.slice(0, DESCRICAO_CURTA_MAX - 1)}…`
      : t;

/** null quando a linha é inutilizável (id, tipo ou nome inválidos; imóvel sem perfil): some em vez de quebrar a página. */
export function paraCartaoLoja(l: LinhaLojaItemPublico): CartaoLoja | null {
  const nome = aparar(l.nome);
  const tipo = (TIPOS_ITEM as readonly string[]).includes(l.tipo ?? "")
    ? (l.tipo as (typeof TIPOS_ITEM)[number])
    : null;
  if (!nome || !tipo || typeof l.id !== "string" || !UUID.test(l.id)) return null;
  const perfilId = aparar(l.perfil_id);
  const perfilSlug = aparar(l.perfil_slug);
  if (tipo === "imovel" && (!perfilId || !perfilSlug)) return null;
  const id = l.id.toLowerCase();
  const item = paraItemExibicao(
    { id, perfil_id: perfilId, tipo },
    conteudoDeVersao({
      id: "",
      item_id: id,
      situacao: "aprovada",
      nome,
      descricao: l.descricao,
      foto_path: l.foto_path,
      categoria_principal_id: l.categoria_principal_id,
      categoria_secundaria_1_id: l.categoria_secundaria_1_id,
      categoria_secundaria_2_id: l.categoria_secundaria_2_id,
      preco_modo: l.preco_modo,
      preco_centavos: l.preco_centavos,
      cidade: l.cidade,
      uf: l.uf,
      imovel_tipo: l.imovel_tipo,
      finalidade: l.finalidade,
      area_m2: l.area_m2,
      quartos: l.quartos,
      banheiros: l.banheiros,
      vagas: l.vagas,
      bairro: l.bairro,
      condominio_centavos: l.condominio_centavos,
      iptu_centavos: l.iptu_centavos,
      aceita_financiamento: l.aceita_financiamento,
      fotos_extras_paths: l.fotos_extras_paths,
      criado_em: l.criado_em ?? "",
      enviada_em: null,
    }),
  );
  return {
    ...item,
    perfilSlug,
    link: ROTAS_PUBLICAS.item(id),
    perfilLink: perfilSlug ? ROTAS_PUBLICAS.perfil(perfilSlug) : null,
    descricaoCurta: cortar(item.descricao),
  };
}

export function paraCartaoImovel(l: LinhaImovelListado): CartaoLoja | null {
  return paraCartaoLoja({
    id: l.o_id,
    perfil_id: l.o_perfil_id,
    perfil_slug: l.o_perfil_slug,
    tipo: "imovel",
    nome: l.o_nome,
    descricao: l.o_descricao,
    foto_path: l.o_foto_path,
    fotos_extras_paths: l.o_fotos_extras_paths,
    categoria_principal_id: null,
    categoria_secundaria_1_id: null,
    categoria_secundaria_2_id: null,
    preco_modo: l.o_preco_modo,
    preco_centavos: l.o_preco_centavos,
    cidade: l.o_cidade,
    uf: l.o_uf,
    bairro: l.o_bairro,
    imovel_tipo: l.o_imovel_tipo,
    finalidade: l.o_finalidade,
    area_m2: l.o_area_m2,
    quartos: l.o_quartos,
    banheiros: l.o_banheiros,
    vagas: l.o_vagas,
    condominio_centavos: l.o_condominio_centavos,
    iptu_centavos: l.o_iptu_centavos,
    aceita_financiamento: l.o_aceita_financiamento,
    criado_em: null,
  });
}

// Filtros --------------------------------------------------------------------------------------------------

/** "" e null viram "sem filtro". */
const semFiltro = (v: unknown) => (v === "" || v === null ? undefined : v);
const inteiroFiltro = (v: unknown) => {
  const x = semFiltro(v);
  return typeof x === "string" && /^\d{1,12}$/.test(x.trim()) ? Number(x.trim()) : x;
};

const MSG_PRECO = "Informe um valor de preço válido, em centavos.";
const MSG_PAGINA = `A página deve ficar entre 1 e ${LIMITES.busca.paginaMax}.`;
const MSG_LIMITE = `O limite deve ficar entre 1 e ${LIMITES.busca.limiteMax}.`;
const texto80 = z
  .string({ error: "Texto inválido." })
  .trim()
  .max(LIMITES.busca.cidadeMax, { error: `Use até ${LIMITES.busca.cidadeMax} caracteres.` })
  .refine(semControle, { error: "O texto tem caracteres inválidos." });

/**
 * Filtros da listagem de imóveis, espelhando as validações do banco (loja_listar_imoveis). Valor inválido é
 * RECUSADO (não ignorado): o chamador mostra a mensagem. Preço em centavos de BRL.
 */
export const filtrosImoveisSchema = z
  .object({
    finalidade: z.preprocess(
      semFiltro,
      z.enum(FINALIDADES_IMOVEL, { error: "Finalidade inválida." }).optional(),
    ),
    tipo: z.preprocess(
      semFiltro,
      z.enum(TIPOS_IMOVEL, { error: "Tipo de imóvel inválido." }).optional(),
    ),
    precoMinCentavos: z.preprocess(
      inteiroFiltro,
      z
        .number({ error: MSG_PRECO })
        .int({ error: MSG_PRECO })
        .min(0, { error: MSG_PRECO })
        .max(LIMITES.preco.maxCentavos, { error: MSG_PRECO })
        .optional(),
    ),
    precoMaxCentavos: z.preprocess(
      inteiroFiltro,
      z
        .number({ error: MSG_PRECO })
        .int({ error: MSG_PRECO })
        .min(0, { error: MSG_PRECO })
        .max(LIMITES.preco.maxCentavos, { error: MSG_PRECO })
        .optional(),
    ),
    quartosMin: z.preprocess(
      inteiroFiltro,
      z
        .number({ error: "Quartos inválido." })
        .int({ error: "Quartos inválido." })
        .min(0, { error: "Quartos inválido." })
        .max(LIMITES.imovel.contagemMax, { error: "Quartos inválido." })
        .optional(),
    ),
    uf: z.preprocess(
      (v) => (semFiltro(v) === undefined ? null : v),
      ufSchema.transform((u) => u ?? undefined),
    ),
    cidade: z.preprocess(semFiltro, texto80.optional()),
    bairro: z.preprocess(semFiltro, texto80.optional()),
    perfilId: z.preprocess(semFiltro, uuidSchema.optional()),
    limite: z.preprocess(
      inteiroFiltro,
      z
        .number({ error: MSG_LIMITE })
        .int({ error: MSG_LIMITE })
        .min(1, { error: MSG_LIMITE })
        .max(LIMITES.busca.limiteMax, { error: MSG_LIMITE })
        .default(LIMITES.busca.limitePadrao),
    ),
    pagina: z.preprocess(
      inteiroFiltro,
      z
        .number({ error: MSG_PAGINA })
        .int({ error: MSG_PAGINA })
        .min(1, { error: MSG_PAGINA })
        .max(LIMITES.busca.paginaMax, { error: MSG_PAGINA })
        .default(1),
    ),
  })
  .superRefine((v, ctx) => {
    if (
      v.precoMinCentavos !== undefined &&
      v.precoMaxCentavos !== undefined &&
      v.precoMinCentavos > v.precoMaxCentavos
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["precoMinCentavos"],
        message: "O preço mínimo não pode ser maior que o máximo.",
      });
    }
  });
export type FiltrosImoveis = z.infer<typeof filtrosImoveisSchema>;

/** Parâmetros de loja_listar_imoveis (nomes = parâmetros da função); só os informados. */
export type ParamsListarImoveis = {
  p_finalidade?: string;
  p_imovel_tipo?: string;
  p_preco_min?: number;
  p_preco_max?: number;
  p_quartos_min?: number;
  p_uf?: string;
  p_cidade?: string;
  p_bairro?: string;
  p_perfil_id?: string;
  p_limite: number;
  p_pagina: number;
};

export function paraParamsListarImoveis(f: FiltrosImoveis): ParamsListarImoveis {
  return {
    ...(f.finalidade ? { p_finalidade: f.finalidade } : {}),
    ...(f.tipo ? { p_imovel_tipo: f.tipo } : {}),
    ...(f.precoMinCentavos !== undefined ? { p_preco_min: f.precoMinCentavos } : {}),
    ...(f.precoMaxCentavos !== undefined ? { p_preco_max: f.precoMaxCentavos } : {}),
    ...(f.quartosMin !== undefined ? { p_quartos_min: f.quartosMin } : {}),
    ...(f.uf ? { p_uf: f.uf } : {}),
    ...(f.cidade ? { p_cidade: f.cidade } : {}),
    ...(f.bairro ? { p_bairro: f.bairro } : {}),
    ...(f.perfilId ? { p_perfil_id: f.perfilId.toLowerCase() } : {}),
    p_limite: f.limite,
    p_pagina: f.pagina,
  };
}

// Serviço --------------------------------------------------------------------------------------------------

export type LinhaLiberacaoLoja = { perfil_id: string; liberada: boolean };

/**
 * Banco injetado, SEM service_role. O adaptador usa a sessão em uso (anônima nas páginas públicas, do dono na
 * consulta de liberação). Falha de rede/erro do banco chega como `erro`.
 */
export interface ClienteBancoLoja {
  /** select perfil_id, liberada em loja_liberacao dos perfis informados (a RLS devolve só o que a sessão pode ver). */
  lerLiberacoes(perfilIds: string[]): Promise<RespostaBanco<LinhaLiberacaoLoja[]>>;
  /** select em loja_item_publico por perfil_id, mais recentes primeiro (limite 50). */
  listarItensDoPerfil(perfilId: string): Promise<RespostaBanco<LinhaLojaItemPublico[]>>;
  /** select em loja_item_publico por id. `dados: null` sem erro = não existe ou fora do ar. */
  buscarItemPorId(id: string): Promise<RespostaBanco<LinhaLojaItemPublico>>;
  /** rpc loja_listar_imoveis. */
  listarImoveis(p: ParamsListarImoveis): Promise<RespostaBanco<LinhaImovelListado[]>>;
}

export type PaginaImoveis = {
  itens: CartaoLoja[];
  total: number;
  pagina: number;
  limite: number;
  temAnterior: boolean;
  temProxima: boolean;
};

/** Texto do banco nunca sai: 22023 (filtro rejeitado pelo banco) e o resto viram mensagens neutras. */
export function mapearErroBancoLoja(e: ErroBanco): ErroCatalogo {
  return classificarErroBanco(e) === "DADO_INVALIDO"
    ? erroCatalogo("VALIDACAO", MENSAGENS_CATALOGO.filtrosInvalidos)
    : erroCatalogo("ERRO_INTERNO", MENSAGENS_CATALOGO.generica);
}

const LIMITE_PERFIS_CONSULTA = 100;

export function criarServicoLoja(banco: ClienteBancoLoja) {
  const interno = (): { ok: false; erro: ErroCatalogo } => ({
    ok: false,
    erro: erroCatalogo("ERRO_INTERNO", MENSAGENS_CATALOGO.generica),
  });

  /** perfilId -> Loja liberada. Falha FECHADA: erro, id inválido ou sem linha = false (a interface esconde a Loja). */
  async function lojasLiberadas(perfilIds: string[]): Promise<Record<string, boolean>> {
    const ids = [
      ...new Set(
        perfilIds.filter((i) => typeof i === "string" && UUID.test(i)).map((i) => i.toLowerCase()),
      ),
    ].slice(0, LIMITE_PERFIS_CONSULTA);
    const saida: Record<string, boolean> = Object.fromEntries(ids.map((i) => [i, false]));
    if (ids.length === 0) return saida;
    try {
      const r = await banco.lerLiberacoes(ids);
      if (r.erro) return saida;
      for (const l of r.dados ?? []) {
        const id = typeof l.perfil_id === "string" ? l.perfil_id.toLowerCase() : "";
        if (id in saida && l.liberada === true) saida[id] = true;
      }
    } catch {
      // falha fechada
    }
    return saida;
  }

  return {
    /**
     * A Loja está liberada neste perfil? Para a interface esconder/mostrar a Loja do dono (IM-099). Só informa;
     * quem impede de verdade é o banco (gatilhos). Falha fechada: na dúvida, false.
     */
    lojaLiberada: async (perfilId: string): Promise<boolean> =>
      (await lojasLiberadas([perfilId]))[String(perfilId).toLowerCase()] === true,

    lojasLiberadas,

    /**
     * Itens da Loja (produtos, serviços e imóveis) de um perfil, no ar. Lista vazia se a Loja não está liberada:
     * nesse caso a página usa o catálogo simples de hoje.
     */
    listarItensDoPerfil: async (perfilId: string): Promise<ResultadoLoja<CartaoLoja[]>> => {
      if (!uuidSchema.safeParse(perfilId).success) return { ok: true, valor: [] };
      try {
        const r = await banco.listarItensDoPerfil(perfilId.toLowerCase());
        if (r.erro) return interno();
        return {
          ok: true,
          valor: (r.dados ?? []).map(paraCartaoLoja).filter((c): c is CartaoLoja => c !== null),
        };
      } catch {
        return interno();
      }
    },

    /** Um item da Loja por id (página do imóvel). null = não existe, não está no ar ou a Loja foi retirada. */
    buscarItem: async (itemId: string): Promise<ResultadoLoja<CartaoLoja | null>> => {
      if (!uuidSchema.safeParse(itemId).success) return { ok: true, valor: null };
      try {
        const r = await banco.buscarItemPorId(itemId.toLowerCase());
        if (r.erro) return interno();
        return { ok: true, valor: r.dados ? paraCartaoLoja(r.dados) : null };
      } catch {
        return interno();
      }
    },

    /** Listagem pública de imóveis com filtros (IM-098). Filtro inválido é recusado ANTES de chamar o banco. */
    listarImoveis: async (entrada: unknown): Promise<ResultadoLoja<PaginaImoveis>> => {
      const p = filtrosImoveisSchema.safeParse(entrada ?? {});
      if (!p.success) {
        const campos = errosPorCampo(p.error);
        return {
          ok: false,
          erro: erroCatalogo(
            "VALIDACAO",
            Object.values(campos)[0] ?? MENSAGENS_CATALOGO.filtrosInvalidos,
            { campos },
          ),
        };
      }
      const f = p.data;
      try {
        const r = await banco.listarImoveis(paraParamsListarImoveis(f));
        if (r.erro) return { ok: false, erro: mapearErroBancoLoja(r.erro) };
        const linhas = r.dados ?? [];
        const total = linhas.length > 0 ? Number(linhas[0]!.o_total) : 0;
        const totalSeguro = Number.isFinite(total) && total >= 0 ? total : linhas.length;
        return {
          ok: true,
          valor: {
            itens: linhas.map(paraCartaoImovel).filter((c): c is CartaoLoja => c !== null),
            total: totalSeguro,
            pagina: f.pagina,
            limite: f.limite,
            temAnterior: f.pagina > 1,
            temProxima: f.pagina * f.limite < totalSeguro,
          },
        };
      } catch {
        return interno();
      }
    },
  };
}
export type ServicoLoja = ReturnType<typeof criarServicoLoja>;
