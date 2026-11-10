import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RSA-06 (D-033, IM-086): toda Server Action administrativa confere o papel de administrador NO SERVIDOR antes de
 * montar o contexto do módulo ou chamar qualquer função de negócio do banco. Aqui o banco é um espião: um usuário
 * comum só pode ter feito UMA chamada (a leitura administracao_eh_admin), e nenhum contexto de módulo é montado.
 */
const estado = vi.hoisted(() => ({
  usuario: { id: "u1" } as { id: string } | null,
  admin: false as boolean,
  erroAoConferir: false,
  chamadasRpc: [] as string[],
}));

vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    rpc: async (nome: string) => {
      estado.chamadasRpc.push(nome);
      if (estado.erroAoConferir) return { data: null, error: { code: "XX000" } };
      return { data: estado.admin, error: null };
    },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`NEXT_REDIRECT:${u}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const contextos = vi.hoisted(() => {
  const alcancado = () => {
    throw new Error("CONTEXTO_ALCANCADO");
  };
  const espiao = () => vi.fn(alcancado);
  return {
    patrocinadores: espiao(),
    comissoes: espiao(),
    pontos: espiao(),
    home: espiao(),
    loja: espiao(),
    aparencia: espiao(),
    sessao: espiao(),
    cicloVida: espiao(),
    cicloVidaAberto: espiao(),
    indicacoes: espiao(),
  };
});
vi.mock("./_lib/contexto-patrocinadores", () => ({
  obterContextoPatrocinadores: contextos.patrocinadores,
}));
vi.mock("./_lib/contexto-comissoes", () => ({ obterContextoComissoes: contextos.comissoes }));
vi.mock("./_lib/contexto-pontos", () => ({ obterContextoPontos: contextos.pontos }));
vi.mock("./_lib/contexto-home", () => ({ obterContextoHomeAdmin: contextos.home }));
vi.mock("./_lib/contexto-loja", () => ({ obterContextoLojaAdmin: contextos.loja }));
vi.mock("./_lib/contexto-aparencia", () => ({ obterContextoAparencia: contextos.aparencia }));
vi.mock("./_lib/contexto-indicacoes", () => ({ obterContextoIndicacoes: contextos.indicacoes }));
vi.mock("./_lib/contexto-sessao", () => ({ obterContexto: contextos.sessao }));
vi.mock("./_lib/contexto-localizacao", () => ({ obterServicoLocalizacao: vi.fn() }));
vi.mock("./_lib/contexto-ciclo-vida", () => ({
  obterContextoCicloVida: contextos.cicloVida,
  obterContextoCicloVidaAberto: contextos.cicloVidaAberto,
  obterContextoDenunciaPublica: contextos.cicloVidaAberto,
}));
vi.mock("./_lib/cache-home", () => ({ revalidarSecoesDaHome: vi.fn() }));
vi.mock("@/shared/supabase/acesso-conta", () => ({
  bloquearAcessoNoAuth: vi.fn(),
  liberarAcessoNoAuth: vi.fn(),
}));

import * as aparencia from "./acoes-aparencia";
import * as cicloVida from "./acoes-ciclo-vida";
import * as comissoes from "./acoes-comissoes";
import * as conteudo from "./acoes-conteudo";
import * as indicacoes from "./acoes-indicacoes";
import * as home from "./acoes-home";
import * as loja from "./acoes-loja";
import * as patrocinadores from "./acoes-patrocinadores";
import * as pontos from "./acoes-pontos";

type Acao = (estado: never, f: FormData) => Promise<unknown>;

const ADMINISTRATIVAS: [string, Acao, keyof typeof contextos][] = [
  ["acaoCriarPatrocinador", patrocinadores.acaoCriarPatrocinador as Acao, "patrocinadores"],
  ["acaoAlterarPatrocinador", patrocinadores.acaoAlterarPatrocinador as Acao, "patrocinadores"],
  [
    "acaoDefinirPatrocinadorAtivo",
    patrocinadores.acaoDefinirPatrocinadorAtivo as Acao,
    "patrocinadores",
  ],
  ["acaoDefinirPrazoInadimplencia", comissoes.acaoDefinirPrazoInadimplencia as Acao, "comissoes"],
  ["acaoDefinirAntecedenciaAviso", comissoes.acaoDefinirAntecedenciaAviso as Acao, "comissoes"],
  ["acaoDefinirHabilitacao", comissoes.acaoDefinirHabilitacao as Acao, "comissoes"],
  ["acaoRegistrarVinculo", comissoes.acaoRegistrarVinculo as Acao, "comissoes"],
  ["acaoRegistrarAssinatura", comissoes.acaoRegistrarAssinatura as Acao, "comissoes"],
  ["acaoCancelarAssinatura", comissoes.acaoCancelarAssinatura as Acao, "comissoes"],
  ["acaoConfirmarPagamento", comissoes.acaoConfirmarPagamento as Acao, "comissoes"],
  ["acaoEstornarPagamento", comissoes.acaoEstornarPagamento as Acao, "comissoes"],
  ["acaoReverterComissao", comissoes.acaoReverterComissao as Acao, "comissoes"],
  ["acaoAvancarRepasse", comissoes.acaoAvancarRepasse as Acao, "comissoes"],
  ["acaoEncerrarVinculo", comissoes.acaoEncerrarVinculo as Acao, "comissoes"],
  ["acaoDefinirParametroPontos", pontos.acaoDefinirParametroPontos as Acao, "pontos"],
  ["acaoDefinirParametroContato", indicacoes.acaoDefinirParametroContato as Acao, "indicacoes"],
  ["acaoDescartarNotificacoes", indicacoes.acaoDescartarNotificacoes as Acao, "indicacoes"],
  ["acaoReverterCredito", pontos.acaoReverterCredito as Acao, "pontos"],
  ["acaoReprocessarPedido", pontos.acaoReprocessarPedido as Acao, "pontos"],
  ["acaoDecidirBeneficio", pontos.acaoDecidirBeneficio as Acao, "pontos"],
  ["acaoCadastrarBeneficioAdmin", pontos.acaoCadastrarBeneficioAdmin as Acao, "pontos"],
  ["acaoEditarPropostaAdmin", pontos.acaoEditarPropostaAdmin as Acao, "pontos"],
  ["acaoAlterarSecaoHome", home.acaoAlterarSecaoHome as Acao, "home"],
  ["acaoDefinirLiberacaoLoja", loja.acaoDefinirLiberacaoLoja as Acao, "loja"],
  ["acaoHabilitarEstilo", aparencia.acaoHabilitarEstilo as Acao, "aparencia"],
  ["acaoAdicionarBannerAdmin", aparencia.acaoAdicionarBannerAdmin as Acao, "aparencia"],
  ["acaoRemoverBannerAdmin", aparencia.acaoRemoverBannerAdmin as Acao, "aparencia"],
  ["acaoDecidirRevisao", conteudo.acaoDecidirRevisao as Acao, "sessao"],
  ["acaoCriarCategoria", conteudo.acaoCriarCategoria as Acao, "sessao"],
  ["acaoAlterarCategoria", conteudo.acaoAlterarCategoria as Acao, "sessao"],
  ["acaoDecidirSolicitacao", conteudo.acaoDecidirSolicitacao as Acao, "sessao"],
  ["acaoConcederPermissao", cicloVida.acaoConcederPermissao as Acao, "cicloVida"],
  ["acaoRevogarPermissao", cicloVida.acaoRevogarPermissao as Acao, "cicloVida"],
];

const chamar = (a: Acao) => a({} as never, new FormData());
const contextosAlcancados = () =>
  Object.values(contextos).reduce((n, c) => n + c.mock.calls.length, 0);

beforeEach(() => {
  vi.clearAllMocks();
  estado.usuario = { id: "u1" };
  estado.admin = false;
  estado.erroAoConferir = false;
  estado.chamadasRpc.length = 0;
});

describe("ações administrativas conferem o papel no servidor (RSA-06, IM-086)", () => {
  it("cobre as ações administrativas conhecidas", () => {
    expect(ADMINISTRATIVAS.length).toBe(33);
    for (const [, fn] of ADMINISTRATIVAS) expect(typeof fn).toBe("function");
  });

  it.each(ADMINISTRATIVAS)(
    "%s: usuário comum é recusado (404) antes de qualquer contexto ou chamada de negócio ao banco",
    async (_nome, acao) => {
      await expect(chamar(acao)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(contextosAlcancados()).toBe(0);
      // Única chamada ao banco: a conferência do papel.
      expect(estado.chamadasRpc).toEqual(["administracao_eh_admin"]);
    },
  );

  it.each(ADMINISTRATIVAS)("%s: erro ao conferir o papel falha fechado", async (_nome, acao) => {
    estado.erroAoConferir = true;
    await expect(chamar(acao)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(contextosAlcancados()).toBe(0);
  });

  it.each(ADMINISTRATIVAS)(
    "%s: sem sessão leva a /entrar, sem consultar o banco",
    async (_nome, acao) => {
      estado.usuario = null;
      await expect(chamar(acao)).rejects.toThrow(/NEXT_REDIRECT:\/entrar\?aviso=sessao/);
      expect(contextosAlcancados()).toBe(0);
      expect(estado.chamadasRpc).toEqual([]);
    },
  );

  it.each(ADMINISTRATIVAS)(
    "%s: administrador passa da conferência e segue para o módulo (o banco continua decidindo)",
    async (_nome, acao, contexto) => {
      estado.admin = true;
      await chamar(acao).catch(() => undefined);
      expect(contextos[contexto]).toHaveBeenCalledTimes(1);
      expect(estado.chamadasRpc).toEqual(["administracao_eh_admin"]);
    },
  );

  it("ação do responsável (não administrativa) não exige o papel: segue ao módulo sem a conferência", async () => {
    await chamar(comissoes.acaoCriarOferta as Acao).catch(() => undefined);
    expect(contextos.comissoes).toHaveBeenCalledTimes(1);
    expect(estado.chamadasRpc).toEqual([]);
    await chamar(aparencia.acaoSalvarEstilo as Acao).catch(() => undefined);
    expect(contextos.aparencia).toHaveBeenCalledTimes(1);
    expect(estado.chamadasRpc).toEqual([]);
  });
});
