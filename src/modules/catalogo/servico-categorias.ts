import type { ZodError } from "zod";
import { slugificar } from "@/shared/formatacao/slug";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import {
  erroCatalogo,
  mapearErroBancoCatalogo,
  MENSAGENS_CATALOGO,
  type ErroCatalogo,
} from "./erros";
import type { LinhaCategoria, LinhaSolicitacao } from "./modelos";
import {
  alterarCategoriaSchema,
  criarCategoriaSchema,
  decidirSolicitacaoSchema,
  solicitarCategoriaSchema,
} from "./schemas";

type Resultado<T> = ResultadoBase<T, ErroCatalogo>;

/** Banco injetado para categorias. Sessão do usuário; as funções administrativas checam o papel no banco. */
export interface ClienteBancoCategorias {
  readonly contaId: string;
  /** select em catalogo_categoria. Para o usuário comum a RLS devolve só as ativas. */
  listarCategorias(): Promise<RespostaBanco<LinhaCategoria[]>>;
  /**
   * rpc administracao_eh_admin (sem parâmetros; usa auth.uid()). OPCIONAL por compatibilidade; sem ela,
   * `listarTodas` falha fechado (SEM_PERMISSAO).
   */
  ehAdministrador?(): Promise<boolean>;
  /**
   * Administrador: TODAS as categorias, inclusive inativas (select sem filtro de `ativa`, liberado só ao
   * admin pela RLS). O serviço confere `ehAdministrador` antes de chamar.
   */
  listarTodasCategorias?(): Promise<RespostaBanco<LinhaCategoria[]>>;
  inserirSolicitacao(c: {
    solicitante_id: string;
    nome_sugerido: string;
    justificativa: string | null;
  }): Promise<RespostaBanco<LinhaSolicitacao>>;
  listarMinhasSolicitacoes(): Promise<RespostaBanco<LinhaSolicitacao[]>>;
  /** Administrador: todas as pendentes. */
  listarSolicitacoesPendentes(): Promise<RespostaBanco<LinhaSolicitacao[]>>;
  /** rpc catalogo_criar_categoria; devolve o id criado. */
  criarCategoria(a: {
    nome: string;
    slug: string;
    ordem: number;
  }): Promise<{ id: string | null; erro: ErroBanco | null }>;
  /** rpc catalogo_alterar_categoria. */
  alterarCategoria(a: {
    id: string;
    nome: string;
    ativa: boolean;
    ordem: number;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc catalogo_decidir_solicitacao. */
  decidirSolicitacao(a: {
    id: string;
    atendida: boolean;
    motivo: string | null;
    categoriaId: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
}

export type Categoria = { id: string; nome: string; slug: string; ordem: number };

/** Categoria na visão do administrador: inclui o estado (ativa/inativa). */
export type CategoriaAdmin = Categoria & { ativa: boolean };

export type Solicitacao = {
  id: string;
  nomeSugerido: string;
  justificativa: string | null;
  situacao: "pendente" | "atendida" | "recusada";
  categoriaId: string | null;
  /** Motivo da recusa (ou observação do atendimento). */
  motivoResposta: string | null;
  decididaEm: string | null;
  criadoEm: string;
};

const M = MENSAGENS_CATALOGO;
const falha = (erro: ErroCatalogo): { ok: false; erro: ErroCatalogo } => ({ ok: false, erro });
const normalizarNome = (n: string) =>
  n.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export function paraCategoria(l: LinhaCategoria): Categoria {
  return { id: l.id, nome: l.nome, slug: l.slug, ordem: l.ordem };
}

export function paraSolicitacao(l: LinhaSolicitacao): Solicitacao {
  return {
    id: l.id,
    nomeSugerido: l.nome_sugerido,
    justificativa: l.justificativa,
    situacao: l.situacao,
    categoriaId: l.categoria_id,
    motivoResposta: l.motivo_resposta,
    decididaEm: l.decidida_em,
    criadoEm: l.criado_em,
  };
}

function falhaValidacao(erro: ZodError): { ok: false; erro: ErroCatalogo } {
  const campos = errosPorCampo(erro);
  return falha(erroCatalogo("VALIDACAO", Object.values(campos)[0] ?? M.textoInvalido, { campos }));
}

export function criarServicoCategorias(banco: ClienteBancoCategorias) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroCatalogo("ERRO_INTERNO", M.generica));
    }
  }

  async function ativas(): Promise<Resultado<Categoria[]>> {
    const r = await banco.listarCategorias();
    if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
    const lista = (r.dados ?? [])
      .filter((c) => c.ativa)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
      .map(paraCategoria);
    return { ok: true, valor: lista };
  }

  return {
    /** Categorias ativas, na ordem de exibição (IM-016). Inativas nunca aparecem aqui. */
    listarAtivas: () => seguro(ativas),

    /**
     * Administrador: todas as categorias, inclusive inativas (para reativar). Não administrador recebe
     * SEM_PERMISSAO e o banco nem é consultado. Ordem: ativas primeiro? Não: ordem de exibição, depois nome.
     */
    listarTodasCategorias: (): Promise<Resultado<CategoriaAdmin[]>> =>
      seguro(async () => {
        if (!banco.ehAdministrador || !banco.listarTodasCategorias) {
          return falha(erroCatalogo("SEM_PERMISSAO", M.semPermissao));
        }
        let admin = false;
        try {
          admin = (await banco.ehAdministrador()) === true;
        } catch {
          admin = false;
        }
        if (!admin) return falha(erroCatalogo("SEM_PERMISSAO", M.semPermissao));
        const r = await banco.listarTodasCategorias();
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        const lista = [...(r.dados ?? [])]
          .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
          .map((c) => ({ ...paraCategoria(c), ativa: c.ativa }));
        return { ok: true, valor: lista };
      }),

    /** O responsável pede uma categoria nova (IM-016). Não cria nada na lista. */
    solicitar: (entrada: unknown): Promise<Resultado<Solicitacao>> =>
      seguro(async () => {
        const p = solicitarCategoriaSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const lista = await ativas();
        if (!lista.ok) return lista;
        const novo = normalizarNome(p.data.nome);
        if (lista.valor.some((c) => normalizarNome(c.nome) === novo)) {
          return falha(erroCatalogo("CATEGORIA_DUPLICADA", M.categoriaJaExiste));
        }
        const r = await banco.inserirSolicitacao({
          solicitante_id: banco.contaId,
          nome_sugerido: p.data.nome,
          justificativa: p.data.justificativa ?? null,
        });
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        if (!r.dados) return falha(erroCatalogo("ERRO_INTERNO", M.generica));
        return { ok: true, valor: paraSolicitacao(r.dados) };
      }),

    listarMinhasSolicitacoes: (): Promise<Resultado<Solicitacao[]>> =>
      seguro(async () => {
        const r = await banco.listarMinhasSolicitacoes();
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        const minhas = (r.dados ?? []).filter((s) => s.solicitante_id === banco.contaId);
        return { ok: true, valor: minhas.map(paraSolicitacao) };
      }),

    // Administrador (o banco recusa quem não é; mensagem genérica de permissão) ---------------------------

    criarCategoria: (entrada: unknown): Promise<Resultado<{ id: string; slug: string }>> =>
      seguro(async () => {
        const p = criarCategoriaSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const slug = slugificar(p.data.nome, 60);
        if (slug.length < 2) {
          return falha(
            erroCatalogo("VALIDACAO", "O nome precisa ter ao menos 2 letras ou números.", {
              campos: { nome: "O nome precisa ter ao menos 2 letras ou números." },
            }),
          );
        }
        const r = await banco.criarCategoria({ nome: p.data.nome, slug, ordem: p.data.ordem ?? 0 });
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        if (!r.id) return falha(erroCatalogo("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { id: r.id, slug } };
      }),

    /** Alterar exige motivo (vai para a auditoria). */
    alterarCategoria: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = alterarCategoriaSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.alterarCategoria(p.data);
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        return { ok: true, valor: null };
      }),

    listarSolicitacoesPendentes: (): Promise<Resultado<Solicitacao[]>> =>
      seguro(async () => {
        const r = await banco.listarSolicitacoesPendentes();
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        return { ok: true, valor: (r.dados ?? []).map(paraSolicitacao) };
      }),

    /** Atender exige a categoria criada; recusar exige motivo. */
    decidirSolicitacao: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = decidirSolicitacaoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const d = p.data;
        const r = await banco.decidirSolicitacao({
          id: d.id,
          atendida: d.atendida,
          motivo: d.motivo ?? null,
          categoriaId: d.atendida ? d.categoriaId : null,
        });
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        return { ok: true, valor: null };
      }),
  };
}

export type ServicoCategorias = ReturnType<typeof criarServicoCategorias>;
