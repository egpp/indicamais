import { describe, expect, it, vi } from "vitest";
import { criarContextoRelacionamento } from "./contexto-relacionamento";
import { caminhoDoAviso, curtirPerfil, marcarAvisoLido } from "./tratadores-relacionamento";

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const PERFIL = "0b6f1c1e-7d0e-4c55-8a53-0d2b9f5a1111";
const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const erro = (code: string) => async () => ({ dados: null, erro: { code } });

function ctx(curtir: () => Promise<{ dados: boolean | null; erro: { code: string } | null }>) {
  return criarContextoRelacionamento({
    bancoRelacionamento: {
      curtir,
      descurtir: ok(true),
      sairDaBase: ok(true),
      listarMeusMembros: ok([]),
      lerMeuResumo: ok([]),
      listarMinhasParticipacoes: ok([]),
    },
    bancoNotificacoes: {
      listarMeusAvisos: ok([]),
      contarNaoLidas: ok(0),
      marcarLida: ok(true),
      marcarTodasLidas: ok(0),
      listarQuemMeIndicou: ok([]),
      listarMinhasIndicacoes: ok([]),
    },
    leitura: {} as never,
    logado: true,
  });
}
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("tratadores de relacionamento (IM-043, IM-042)", () => {
  it("curtir com sucesso responde mensagem neutra, sem pontos nem ganho", async () => {
    const e = await curtirPerfil(ctx(ok(true)), form({ perfilId: PERFIL }));
    expect(e.sucesso).toBe("Você curtiu este site.");
    expect(JSON.stringify(e)).not.toMatch(/ponto|ganh|benef|comiss/i);
  });
  it.each([
    ["P0403", /próprio site/],
    ["P0429", /Muitas alterações/],
    ["P0002", /não está disponível/],
  ])("erro %s vira mensagem neutra do módulo", async (codigo, texto) => {
    const e = await curtirPerfil(ctx(erro(codigo)), form({ perfilId: PERFIL }));
    expect(e.erro).toMatch(texto);
  });
  it("id inválido é barrado pelo Zod do módulo", async () => {
    const e = await curtirPerfil(ctx(ok(true)), form({ perfilId: "x" }));
    expect(e.erro).toBeTruthy();
  });
  it("marcar aviso com origem inválida não chama o banco", async () => {
    const e = await marcarAvisoLido(ctx(ok(true)), form({ origem: "x", origemId: "y" }));
    expect(e.erro).toBeTruthy();
  });
});

describe("caminhoDoAviso (IM-052)", () => {
  const base = {
    origem: "curtida",
    origemId: "i",
    titulo: "",
    texto: "",
    atorNome: null,
    criadoEm: "",
    lida: false,
    lidaEm: null,
  } as const;
  const slug = async () => "minha-loja";
  it("responsável abre o próprio painel", async () => {
    const a = {
      ...base,
      tipo: "curtida",
      destino: { tipo: "perfil", id: "p1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(a, slug)).toBe("/meus-perfis/p1");
    const b = {
      ...base,
      tipo: "contato_valido",
      destino: { tipo: "item", id: "i1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(b, slug)).toBe("/meus-itens/i1");
  });
  it("banner aguardando aceite abre os banners do site (IM-093)", async () => {
    const a = {
      ...base,
      origem: "banner_aceite",
      tipo: "banner_aguardando_aceite",
      destino: { tipo: "perfil", id: "p1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(a, slug)).toBe("/meus-perfis/p1/banners");
  });
  it("avisos de inadimplência abrem a tela de comissões do papel certo (IM-072)", async () => {
    const dest = { tipo: "perfil", id: "p1", nome: "" };
    for (const tipo of ["inadimplencia_atraso_indicador", "inadimplencia_prazo_indicador"]) {
      const a = { ...base, origem: "inadimplencia", tipo, destino: dest } as never;
      expect(await caminhoDoAviso(a, slug)).toBe("/comissoes");
    }
    for (const tipo of ["inadimplencia_atraso_negocio", "inadimplencia_prazo_negocio"]) {
      const a = { ...base, origem: "inadimplencia", tipo, destino: dest } as never;
      expect(await caminhoDoAviso(a, slug)).toBe("/meus-perfis/p1/comissoes");
    }
  });
  it("indicador abre a página pública", async () => {
    const a = {
      ...base,
      tipo: "indicacao_valida",
      destino: { tipo: "perfil", id: "p1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(a, slug)).toBe("/perfil/minha-loja");
    const b = {
      ...base,
      tipo: "indicacao_valida",
      destino: { tipo: "item", id: "i1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(b, slug)).toBe("/item/i1");
  });
  it("destino fora do ar leva à mensagem amigável, não ao 404", async () => {
    const a = {
      ...base,
      tipo: "indicacao_valida",
      destino: { tipo: "item", id: "i1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(a, slug, async () => false)).toBe("/avisos?aviso=indisponivel");
    const b = {
      ...base,
      tipo: "indicacao_valida",
      destino: { tipo: "perfil", id: "p1", nome: "" },
    } as never;
    expect(await caminhoDoAviso(b, async () => null)).toBe("/avisos?aviso=indisponivel");
  });
  it("sem destino volta aos avisos", async () => {
    expect(await caminhoDoAviso({ ...base, tipo: "curtida", destino: null } as never, slug)).toBe(
      "/avisos",
    );
  });
});
