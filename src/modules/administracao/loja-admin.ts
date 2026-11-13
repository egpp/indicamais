import { z } from "zod";
import { LIMITES } from "@/shared/config/limites";
import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import { errosPorCampo, uuidSchema } from "@/shared/conteudo/zod-util";
import {
  BUSCA_NEGOCIOS_MAX,
  POR_PAGINA_NEGOCIOS,
  escaparCuringasLike,
  paraNegocioConsultado,
  type LinhaConsultaNegocio,
} from "./consulta-negocios";
import { erroAdm, MENSAGENS_ADMINISTRACAO, type ErroAdministracao } from "./erros";

/**
 * Liberação da Loja por perfil pelo administrador geral (IM-097, IM-099, D-020). Só para testes: sem plano e sem
 * cobrança (planos são futuros, IM-060). Motivo obrigatório; a auditoria (autor, data, motivo, valor anterior e novo)
 * é gravada pelo banco, na mesma transação, em loja_definir_liberacao. Não mexe em pontos, comissões nem relacionamento.
 */

export type ResultadoLojaAdm<T> = ResultadoBase<T, ErroAdministracao>;

export const MENSAGENS_LOJA_ADMIN = {
  semPermissao: "Somente o administrador geral pode liberar ou retirar a Loja.",
  motivo: "Informe o motivo.",
  dados: "Confira o site, se a Loja será liberada ou retirada, e o motivo.",
  perfilNaoEncontrado: "Site não encontrado.",
  liberada: "Loja liberada para o site.",
  retirada: "Loja retirada do site.",
} as const;

// Entradas -------------------------------------------------------------------------------------------------

/** Formulário manda "true"/"on"/"false"/"off"; qualquer outra coisa é recusada. */
const booleano = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const t = v.trim().toLowerCase();
    if (["true", "on", "1"].includes(t)) return true;
    if (["false", "off", "0"].includes(t)) return false;
    return v;
  },
  z.boolean({ error: "Informe se a Loja será liberada ou retirada." }),
);

export const definirLiberacaoLojaSchema = z.object({
  perfilId: uuidSchema,
  liberada: booleano,
  motivo: z
    .string({ error: MENSAGENS_LOJA_ADMIN.motivo })
    .trim()
    .min(1, { error: MENSAGENS_LOJA_ADMIN.motivo })
    .max(LIMITES.revisao.motivoMax, {
      error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
    }),
});
export type DefinirLiberacaoLoja = z.infer<typeof definirLiberacaoLojaSchema>;

export const SITUACOES_LOJA_FILTRO = ["liberadas"] as const;

/** Entrada da tela de listagem. Valor desconhecido vira "sem filtro" em vez de erro. */
export const filtroPerfisLojaSchema = z.object({
  busca: z
    .string()
    .trim()
    .max(BUSCA_NEGOCIOS_MAX)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v : undefined)),
  loja: z.enum(SITUACOES_LOJA_FILTRO).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(10000).optional().catch(1),
});
export type FiltroPerfisLojaEntrada = {
  busca?: string | undefined;
  loja?: string | undefined;
  pagina?: string | number | undefined;
};

// Banco ----------------------------------------------------------------------------------------------------

export type LinhaLiberacaoLojaAdmin = {
  perfil_id: string;
  liberada: boolean;
  atualizado_em: string;
};

export type ConsultaPerfisLoja = {
  /** Busca já escapada (sem os %); o adaptador monta `%...%`. */
  buscaLike?: string;
  /** Restringe a estes perfis (filtro "só com a Loja liberada"). */
  ids?: string[];
  /** range() inclusivo, mais recentemente atualizados primeiro. */
  de: number;
  ate: number;
};

/**
 * Banco injetado, com a sessão do administrador (nunca service_role). Perfis e nomes vêm da visão
 * administracao_consulta_negocios (alvo_tipo = 'perfil'); o estado da Loja vem de loja_liberacao (política de
 * leitura do administrador). Não exige migração nova.
 */
export interface ClienteBancoLojaAdmin {
  /** rpc administracao_eh_admin; falha = false. */
  ehAdministrador(): Promise<boolean>;
  /** select na visão administracao_consulta_negocios com alvo_tipo = 'perfil'. */
  consultarPerfis(c: ConsultaPerfisLoja): Promise<RespostaBanco<LinhaConsultaNegocio[]>>;
  /** select perfil_id, liberada, atualizado_em em loja_liberacao; sem ids = todas. */
  listarLiberacoes(ids?: string[]): Promise<RespostaBanco<LinhaLiberacaoLojaAdmin[]>>;
  /** rpc loja_definir_liberacao. */
  definirLiberacao(p: {
    p_perfil_id: string;
    p_liberada: boolean;
    p_motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
}

// Modelos --------------------------------------------------------------------------------------------------

export type PerfilComLoja = {
  perfilId: string;
  nome: string;
  slug: string | null;
  local: string | null;
  publicacaoRotulo: string;
  situacaoRotulo: string;
  /** Página pública do perfil, só quando disponível. */
  hrefPublico: string | null;
  lojaLiberada: boolean;
  /** Última mudança da liberação; null se nunca foi tocada (padrão: desligada). */
  lojaAtualizadaEm: string | null;
};

export type PaginaPerfisLoja = {
  itens: PerfilComLoja[];
  pagina: number;
  temAnterior: boolean;
  temProxima: boolean;
};

export function paraPerfilComLoja(
  l: LinhaConsultaNegocio,
  liberacao: LinhaLiberacaoLojaAdmin | undefined,
): PerfilComLoja | null {
  const n = paraNegocioConsultado(l);
  if (!n || n.tipo !== "perfil") return null;
  return {
    perfilId: l.alvo_id!,
    nome: n.nome,
    slug: l.slug,
    local: n.local,
    publicacaoRotulo: n.publicacaoRotulo,
    situacaoRotulo: n.situacaoRotulo,
    hrefPublico: n.hrefPublico,
    lojaLiberada: liberacao?.liberada === true,
    lojaAtualizadaEm: liberacao?.atualizado_em ?? null,
  };
}

/** 42501, 22023 e P0002 viram mensagens neutras; o texto do banco nunca sai. */
export function mapearErroBancoLojaAdmin(e: ErroBanco): ErroAdministracao {
  switch (classificarErroBanco(e)) {
    case "PERMISSAO":
      return erroAdm("SEM_PERMISSAO", MENSAGENS_LOJA_ADMIN.semPermissao);
    case "DADO_INVALIDO":
      return erroAdm("MOTIVO_OBRIGATORIO", MENSAGENS_LOJA_ADMIN.motivo);
    case "NAO_ENCONTRADO":
      return erroAdm("NAO_ENCONTRADO", MENSAGENS_LOJA_ADMIN.perfilNaoEncontrado);
    default:
      return erroAdm("ERRO_INTERNO", MENSAGENS_ADMINISTRACAO.generica);
  }
}

// Serviço --------------------------------------------------------------------------------------------------

const falha = (erro: ErroAdministracao): { ok: false; erro: ErroAdministracao } => ({
  ok: false,
  erro,
});

export function criarServicoLojaAdmin(banco: ClienteBancoLojaAdmin) {
  async function ehAdmin(): Promise<boolean> {
    try {
      return (await banco.ehAdministrador()) === true;
    } catch {
      return false;
    }
  }
  async function seguro<T>(f: () => Promise<ResultadoLojaAdm<T>>): Promise<ResultadoLojaAdm<T>> {
    try {
      return await f();
    } catch {
      return falha(erroAdm("ERRO_INTERNO", MENSAGENS_ADMINISTRACAO.generica));
    }
  }
  const semPermissao = () => falha(erroAdm("SEM_PERMISSAO", MENSAGENS_LOJA_ADMIN.semPermissao));

  return {
    /**
     * Perfis com o status da Loja (20 por página). Filtro "liberadas" lista só os perfis com a Loja ligada.
     * Falha fechada para quem não é administrador.
     */
    listarPerfis: (
      entrada: FiltroPerfisLojaEntrada = {},
    ): Promise<ResultadoLojaAdm<PaginaPerfisLoja>> =>
      seguro(async () => {
        if (!(await ehAdmin())) return semPermissao();
        const f = filtroPerfisLojaSchema.parse(entrada ?? {});
        const pagina = f.pagina ?? 1;
        const de = (pagina - 1) * POR_PAGINA_NEGOCIOS;

        let ids: string[] | undefined;
        if (f.loja === "liberadas") {
          const todas = await banco.listarLiberacoes();
          if (todas.erro) return falha(mapearErroBancoLojaAdmin(todas.erro));
          ids = (todas.dados ?? []).filter((x) => x.liberada === true).map((x) => x.perfil_id);
          if (ids.length === 0) {
            return {
              ok: true,
              valor: { itens: [], pagina, temAnterior: pagina > 1, temProxima: false },
            };
          }
        }

        const r = await banco.consultarPerfis({
          ...(f.busca ? { buscaLike: escaparCuringasLike(f.busca) } : {}),
          ...(ids ? { ids } : {}),
          de,
          ate: de + POR_PAGINA_NEGOCIOS,
        });
        if (r.erro) return falha(mapearErroBancoLojaAdmin(r.erro));
        const linhas = r.dados ?? [];
        const daPagina = linhas.slice(0, POR_PAGINA_NEGOCIOS);
        const idsPagina = daPagina.map((l) => l.alvo_id).filter((i): i is string => !!i);
        const lib =
          idsPagina.length > 0
            ? await banco.listarLiberacoes(idsPagina)
            : { dados: [], erro: null };
        if (lib.erro) return falha(mapearErroBancoLojaAdmin(lib.erro));
        const porPerfil = new Map((lib.dados ?? []).map((x) => [x.perfil_id, x]));
        const itens = daPagina
          .map((l) => paraPerfilComLoja(l, l.alvo_id ? porPerfil.get(l.alvo_id) : undefined))
          .filter((x): x is PerfilComLoja => x !== null);
        return {
          ok: true,
          valor: {
            itens,
            pagina,
            temAnterior: pagina > 1,
            temProxima: linhas.length > POR_PAGINA_NEGOCIOS,
          },
        };
      }),

    /**
     * Libera ou retira a Loja de um perfil. Motivo obrigatório. Repetir o estado atual não muda nada e não grava
     * auditoria nova (idempotente no banco).
     */
    definirLiberacao: (
      entrada: unknown,
    ): Promise<ResultadoLojaAdm<{ perfilId: string; liberada: boolean }>> =>
      seguro(async () => {
        if (!(await ehAdmin())) return semPermissao();
        const p = definirLiberacaoLojaSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroAdm(
              "motivo" in campos ? "MOTIVO_OBRIGATORIO" : "VALIDACAO",
              Object.values(campos)[0] ?? MENSAGENS_LOJA_ADMIN.dados,
              campos,
            ),
          );
        }
        const d = p.data;
        const perfilId = d.perfilId.toLowerCase();
        const r = await banco.definirLiberacao({
          p_perfil_id: perfilId,
          p_liberada: d.liberada,
          p_motivo: d.motivo,
        });
        if (r.erro) return falha(mapearErroBancoLojaAdmin(r.erro));
        return { ok: true, valor: { perfilId, liberada: d.liberada } };
      }),
  };
}
export type ServicoLojaAdmin = ReturnType<typeof criarServicoLojaAdmin>;
