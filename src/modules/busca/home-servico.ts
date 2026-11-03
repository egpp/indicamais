import type { RespostaBanco, Resultado as ResultadoBase } from "@/shared/conteudo/resultado";
import { erroBusca, mapearErroBancoBusca, MENSAGENS_BUSCA, type ErroBusca } from "./erros";
import {
  paraCardDaHome,
  paraParametroSecao,
  type LinhaPerfilHome,
  type LinhaSecaoHome,
  type PerfilParaCidade,
  type SecaoHome,
} from "./home-modelos";
import { validarLocalizacaoHome, type LocalizacaoHome } from "./home-schemas";

export type ResultadoHome<T> = ResultadoBase<T, ErroBusca>;

/** Parâmetros de `busca_home_secoes`. Chaves ausentes = sem cidade. */
export type ParamsHomeSecoes = { p_cidade?: string; p_uf?: string };
/** Parâmetros de `busca_home_secao_perfis`. Sem `p_limite`, o banco usa o limite padrão da seção. */
export type ParamsHomeSecaoPerfis = {
  p_chave: string;
  p_cidade?: string;
  p_uf?: string;
  p_limite?: number;
};

/** Banco injetado: funções públicas (anon ou usuário), nunca service_role. */
export interface ClienteBancoHome {
  /** rpc busca_home_secoes. */
  listarSecoes(p: ParamsHomeSecoes): Promise<RespostaBanco<LinhaSecaoHome[]>>;
  /** rpc busca_home_secao_perfis. */
  listarPerfisDaSecao(p: ParamsHomeSecaoPerfis): Promise<RespostaBanco<LinhaPerfilHome[]>>;
}

/**
 * Cidade e UF da pessoa para "Na sua cidade" (D-018). Prioridade: a busca (cidade e UF escolhidas); depois o primeiro
 * perfil comercial PUBLICADO da própria pessoa que tenha cidade e UF válidas na versão no ar; senão null (a seção some).
 * Só a localização sai daqui: nenhum outro dado do perfil, e a lista de perfis é do próprio usuário (sessão dele).
 */
export function escolherLocalizacaoHome(
  busca: { cidade?: unknown; uf?: unknown } | null | undefined,
  meusPerfis: readonly PerfilParaCidade[] | null | undefined,
): LocalizacaoHome | null {
  const daBusca = validarLocalizacaoHome(busca);
  if (daBusca) return daBusca;
  for (const p of meusPerfis ?? []) {
    if (!p.publicado || !p.conteudoNoAr) continue;
    const loc = validarLocalizacaoHome(p.conteudoNoAr);
    if (loc) return loc;
  }
  return null;
}

const M = MENSAGENS_BUSCA;

export function criarServicoHome(banco: ClienteBancoHome) {
  async function carregarSecao(
    chave: SecaoHome["chave"],
    loc: LocalizacaoHome | null,
  ): Promise<SecaoHome["itens"] | null> {
    try {
      const r = await banco.listarPerfisDaSecao({
        p_chave: chave,
        ...(loc ? { p_cidade: loc.cidade, p_uf: loc.uf } : {}),
      });
      if (r.erro) return null;
      const itens = [];
      for (const l of r.dados ?? []) {
        const c = paraCardDaHome(l);
        if (c) itens.push(c);
      }
      return itens;
    } catch {
      return null;
    }
  }

  return {
    /**
     * Monta as seções da home (IM-095, IM-096): só as ativas, em ordem, com `o_exibir` verdadeiro e com itens
     * suficientes (>= mínimo da seção). "Na sua cidade" sem cidade e UF válidas some, sem chamar o banco por ela.
     * Localização inválida é descartada (as outras seções seguem). Falha numa seção a omite; falha na lista de
     * seções devolve erro neutro. Não depende de quem está logado: o mesmo resultado serve a todos da mesma cidade.
     */
    async obterSecoesDaHome(
      entrada?: { cidade?: unknown; uf?: unknown } | null,
    ): Promise<ResultadoHome<SecaoHome[]>> {
      try {
        const loc = validarLocalizacaoHome(entrada);
        const r = await banco.listarSecoes(loc ? { p_cidade: loc.cidade, p_uf: loc.uf } : {});
        if (r.erro) return { ok: false, erro: mapearErroBancoBusca(r.erro) };
        const parametros = (r.dados ?? [])
          .map(paraParametroSecao)
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .filter((p) => p.exibir && (p.chave !== "na_sua_cidade" || loc !== null))
          .sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave));
        const carregadas = await Promise.all(parametros.map((p) => carregarSecao(p.chave, loc)));
        const secoes: SecaoHome[] = [];
        parametros.forEach((p, i) => {
          const itens = carregadas[i];
          if (itens && itens.length >= p.minimoItens) {
            secoes.push({ chave: p.chave, titulo: p.titulo, tipoItem: "perfil", itens });
          }
        });
        return { ok: true, valor: secoes };
      } catch {
        return { ok: false, erro: erroBusca("ERRO_INTERNO", M.generica) };
      }
    },
  };
}

export type ServicoHome = ReturnType<typeof criarServicoHome>;
