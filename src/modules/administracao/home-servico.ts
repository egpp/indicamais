import { CHAVES_SECAO_HOME, type ChaveSecaoHome } from "@/modules/busca";
import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import { erroAdm, MENSAGENS_ADMINISTRACAO, type ErroAdministracao } from "./erros";
import { alterarSecaoHomeSchema } from "./home-schemas";

export type ResultadoHomeAdm<T> = ResultadoBase<T, ErroAdministracao>;

/** Linha de `busca_home_secao` (select; a RLS entrega as inativas só ao administrador). */
export type LinhaSecaoHomeAdmin = {
  chave: string;
  titulo: string;
  ativa: boolean;
  ordem: number;
  minimo_itens: number;
  limite_padrao: number;
  tipo_item: string;
  atualizado_em: string;
};

export type SecaoHomeAdmin = {
  chave: ChaveSecaoHome;
  titulo: string;
  ativa: boolean;
  ordem: number;
  minimoItens: number;
  limitePadrao: number;
  tipoItem: string;
  atualizadoEm: string;
};

/** Parâmetros de `administracao_alterar_home_secao` (nomes = parâmetros da função). */
export type ParamsAlterarSecaoHome = {
  p_chave: string;
  p_titulo: string;
  p_ativa: boolean;
  p_ordem: number;
  p_minimo_itens: number;
  p_limite_padrao: number;
  p_motivo: string;
};

/**
 * Banco injetado, com a sessão do usuário (nunca service_role). O banco confere de novo o papel de administrador
 * geral e grava a auditoria na mesma transação.
 */
export interface ClienteBancoHomeAdmin {
  /** rpc administracao_eh_admin. */
  ehAdministrador(): Promise<boolean>;
  /** select das 8 colunas acima em busca_home_secao, ordenado por ordem. */
  listarSecoes(): Promise<RespostaBanco<LinhaSecaoHomeAdmin[]>>;
  /** rpc administracao_alterar_home_secao. */
  alterarSecao(p: ParamsAlterarSecaoHome): Promise<{ erro: ErroBanco | null }>;
}

export const MENSAGENS_HOME_ADMIN = {
  semPermissao: "Somente o administrador geral pode editar as seções da página inicial.",
  naoEncontrada: "Seção não encontrada.",
  motivo: "Informe o motivo e preencha todos os campos da seção.",
  regras: "Confira o título, a ordem, o mínimo e o limite de itens da seção.",
} as const;

/** 42501, 22023, 23514 e P0002 viram mensagens neutras; o texto do banco nunca sai. */
export function mapearErroBancoHomeAdmin(e: ErroBanco): ErroAdministracao {
  switch (classificarErroBanco(e)) {
    case "PERMISSAO":
      return erroAdm("SEM_PERMISSAO", MENSAGENS_HOME_ADMIN.semPermissao);
    case "DADO_INVALIDO":
      return erroAdm("MOTIVO_OBRIGATORIO", MENSAGENS_HOME_ADMIN.motivo);
    case "CHECK":
      return erroAdm("VALIDACAO", MENSAGENS_HOME_ADMIN.regras);
    case "NAO_ENCONTRADO":
      return erroAdm("NAO_ENCONTRADO", MENSAGENS_HOME_ADMIN.naoEncontrada);
    default:
      return erroAdm("ERRO_INTERNO", MENSAGENS_ADMINISTRACAO.generica);
  }
}

/** null quando a chave não é uma das cinco (linha inutilizável some em vez de quebrar a tela). */
export function paraSecaoHomeAdmin(l: LinhaSecaoHomeAdmin): SecaoHomeAdmin | null {
  if (!(CHAVES_SECAO_HOME as readonly string[]).includes(l.chave)) return null;
  return {
    chave: l.chave as ChaveSecaoHome,
    titulo: l.titulo,
    ativa: l.ativa === true,
    ordem: Number(l.ordem),
    minimoItens: Number(l.minimo_itens),
    limitePadrao: Number(l.limite_padrao),
    tipoItem: l.tipo_item,
    atualizadoEm: l.atualizado_em,
  };
}

const M = MENSAGENS_ADMINISTRACAO;
const falha = (erro: ErroAdministracao): { ok: false; erro: ErroAdministracao } => ({
  ok: false,
  erro,
});

export function criarServicoHomeAdmin(banco: ClienteBancoHomeAdmin) {
  async function ehAdmin(): Promise<boolean> {
    try {
      return (await banco.ehAdministrador()) === true;
    } catch {
      return false;
    }
  }
  async function seguro<T>(f: () => Promise<ResultadoHomeAdm<T>>): Promise<ResultadoHomeAdm<T>> {
    try {
      return await f();
    } catch {
      return falha(erroAdm("ERRO_INTERNO", M.generica));
    }
  }
  const semPermissao = () => falha(erroAdm("SEM_PERMISSAO", MENSAGENS_HOME_ADMIN.semPermissao));

  return {
    /** Todas as seções, inclusive as inativas, em ordem. Falha fechado para quem não é administrador. */
    listarSecoesHome: (): Promise<ResultadoHomeAdm<SecaoHomeAdmin[]>> =>
      seguro(async () => {
        if (!(await ehAdmin())) return semPermissao();
        const r = await banco.listarSecoes();
        if (r.erro) return falha(mapearErroBancoHomeAdmin(r.erro));
        const secoes = (r.dados ?? [])
          .map(paraSecaoHomeAdmin)
          .filter((s): s is SecaoHomeAdmin => s !== null)
          .sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave));
        return { ok: true, valor: secoes };
      }),

    /**
     * Substitui título, ativação, ordem, mínimo e limite de uma seção (IM-096). Motivo obrigatório. A auditoria
     * (autor, data, motivo, valor anterior e novo) é gravada pelo banco na mesma transação.
     */
    alterarSecaoHome: (entrada: unknown): Promise<ResultadoHomeAdm<{ chave: ChaveSecaoHome }>> =>
      seguro(async () => {
        if (!(await ehAdmin())) return semPermissao();
        const p = alterarSecaoHomeSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroAdm(
              "motivo" in campos ? "MOTIVO_OBRIGATORIO" : "VALIDACAO",
              Object.values(campos)[0] ?? M.dadosInvalidos,
              campos,
            ),
          );
        }
        const d = p.data;
        const r = await banco.alterarSecao({
          p_chave: d.chave,
          p_titulo: d.titulo,
          p_ativa: d.ativa,
          p_ordem: d.ordem,
          p_minimo_itens: d.minimoItens,
          p_limite_padrao: d.limitePadrao,
          p_motivo: d.motivo,
        });
        if (r.erro) return falha(mapearErroBancoHomeAdmin(r.erro));
        return { ok: true, valor: { chave: d.chave } };
      }),
  };
}

export type ServicoHomeAdmin = ReturnType<typeof criarServicoHomeAdmin>;
