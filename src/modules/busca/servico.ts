import { paraCategoria, type Categoria, type LinhaCategoria } from "@/modules/catalogo";
import { UFS } from "@/shared/conteudo/ufs";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type { RespostaBanco, Resultado as ResultadoBase } from "@/shared/conteudo/resultado";
import { erroBusca, mapearErroBancoBusca, MENSAGENS_BUSCA, type ErroBusca } from "./erros";
import { paraPagina, type CardBusca, type LinhaBusca, type PaginaBusca } from "./modelos";
import { filtrosBuscaSchema, secaoSchema, type TipoBusca } from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroBusca>;

/** Parâmetros de `busca_publica`. Filtro ausente = chave omitida (a função tem default para todos). */
export type ParamsBuscaPublica = {
  p_termo?: string;
  p_tipo?: TipoBusca;
  p_categoria_id?: string;
  p_uf?: string;
  p_cidade?: string;
  p_limite: number;
  p_pagina: number;
};

/**
 * Banco injetado. Leitura pública: funciona com a sessão do visitante (anon) ou do usuário; nunca service_role.
 * As duas leituras só alcançam conteúdo aprovado, publicado e disponível (IM-079), por visões e RLS.
 */
export interface ClienteBancoBusca {
  /** rpc busca_publica(p_termo, p_tipo, p_categoria_id, p_uf, p_cidade, p_limite, p_pagina). */
  buscar(params: ParamsBuscaPublica): Promise<RespostaBanco<LinhaBusca[]>>;
  /** select em catalogo_categoria (id, nome, slug, ativa, ordem); a RLS já devolve só as ativas ao público. */
  listarCategorias(): Promise<RespostaBanco<LinhaCategoria[]>>;
}

export type FiltrosDisponiveis = {
  categorias: Categoria[];
  ufs: readonly string[];
  tipos: readonly TipoBusca[];
};

export type SecaoProdutosEServicos = { produtos: CardBusca[]; servicos: CardBusca[] };

const M = MENSAGENS_BUSCA;
const falha = (erro: ErroBusca): { ok: false; erro: ErroBusca } => ({ ok: false, erro });

export function criarServicoBusca(banco: ClienteBancoBusca) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroBusca("ERRO_INTERNO", M.generica));
    }
  }

  async function consultar(params: ParamsBuscaPublica): Promise<Resultado<PaginaBusca>> {
    const r = await banco.buscar(params);
    if (r.erro) return falha(mapearErroBancoBusca(r.erro));
    return { ok: true, valor: paraPagina(r.dados ?? [], params.p_pagina, params.p_limite) };
  }

  return {
    /** IM-019: busca por nome com filtros. Entrada inválida não chega ao banco. */
    buscar: (entrada: unknown): Promise<Resultado<PaginaBusca>> =>
      seguro(async () => {
        const p = filtrosBuscaSchema.safeParse(entrada ?? {});
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroBusca("VALIDACAO", Object.values(campos)[0] ?? M.filtrosInvalidos, campos),
          );
        }
        const f = p.data;
        const params: ParamsBuscaPublica = { p_limite: f.limite, p_pagina: f.pagina };
        if (f.termo) params.p_termo = f.termo;
        if (f.tipo) params.p_tipo = f.tipo;
        if (f.categoriaId) params.p_categoria_id = f.categoriaId;
        if (f.uf) params.p_uf = f.uf;
        if (f.cidade) params.p_cidade = f.cidade;
        return consultar(params);
      }),

    /** Categorias ativas (IM-016) e UFs para montar os filtros. */
    listarFiltros: (): Promise<Resultado<FiltrosDisponiveis>> =>
      seguro(async () => {
        const r = await banco.listarCategorias();
        if (r.erro) return falha(mapearErroBancoBusca(r.erro));
        const categorias = (r.dados ?? [])
          .filter((c) => c.ativa)
          .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
          .map(paraCategoria);
        return {
          ok: true,
          valor: { categorias, ufs: [...UFS].sort(), tipos: ["perfil", "produto", "servico"] },
        };
      }),

    /** IM-019: seção "Produtos e serviços" da home: primeiras `quantidade` linhas de cada tipo. */
    secaoProdutosEServicos: (quantidade?: unknown): Promise<Resultado<SecaoProdutosEServicos>> =>
      seguro(async () => {
        const q = secaoSchema.safeParse(quantidade);
        if (!q.success) return falha(erroBusca("VALIDACAO", M.filtrosInvalidos));
        const [produtos, servicos] = await Promise.all([
          consultar({ p_tipo: "produto", p_limite: q.data, p_pagina: 1 }),
          consultar({ p_tipo: "servico", p_limite: q.data, p_pagina: 1 }),
        ]);
        if (!produtos.ok) return produtos;
        if (!servicos.ok) return servicos;
        return {
          ok: true,
          valor: { produtos: produtos.valor.cards, servicos: servicos.valor.cards },
        };
      }),
  };
}

export type ServicoBusca = ReturnType<typeof criarServicoBusca>;
