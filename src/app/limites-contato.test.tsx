// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstadoLink } from "./_lib/estado-indicacoes";

const acao = vi.fn<(e: EstadoLink, f: FormData) => Promise<EstadoLink>>();
vi.mock("./acoes-indicacoes", () => ({
  acaoDefinirParametroContato: (e: EstadoLink, f: FormData) => acao(e, f),
}));

const ID_ALVO = "abcdef12-3456-4789-8abc-def012345678";
const param = (chave: string, valor: number, minimo: number, maximo: number) => ({
  chave,
  valor,
  minimo,
  maximo,
  descricao: `Descrição de ${chave}`,
  atualizadoEm: "2026-11-09T15:30:00Z",
});
let recusa = 0;
let alarmes: unknown[] = [];
let ehAdmin = true;
const listarAlarmesContato = vi.fn(async (a: { tipo?: string; pagina?: number }) => ({
  ok: true as const,
  valor: { itens: alarmes, total: alarmes.length, pagina: a.pagina ?? 1, porPagina: 50 },
}));
vi.mock("./_lib/contexto-indicacoes", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-indicacoes")>()),
  obterContextoIndicacoes: async () => ({
    logado: true,
    ehAdministrador: async () => ehAdmin,
    servico: {
      listarParametrosContato: async () => ({
        ok: true,
        valor: [
          param("contato_recusar_excesso", recusa, 0, 1),
          param("contato_limite_por_link_hora", 10, 1, 100),
          param("contato_limite_por_destino_hora", 30, 1, 500),
          param("contato_limite_global_hora", 200, 1, 5000),
        ],
      }),
      listarAlarmesContato: listarAlarmesContato,
    },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import PaginaLimitesContato from "./administracao/limites-contato/page";
import { itensAdministracao } from "./_componentes/menu-painel-dados";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  recusa = 0;
  alarmes = [];
  ehAdmin = true;
});

const args = (busca: Record<string, string> = {}) => Promise.resolve(busca);
const abrir = async (busca: Record<string, string> = {}) =>
  render(await PaginaLimitesContato({ searchParams: args(busca) }));

describe("Limites do contato (D-034 item 1; IM-076, IM-086)", () => {
  it("quem não é administrador recebe 404", async () => {
    ehAdmin = false;
    await expect(PaginaLimitesContato({ searchParams: args() })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("mostra os três limites com valor atual e faixa, e o estado vazio dos alarmes", async () => {
    await abrir();
    expect(screen.getByRole("heading", { level: 1, name: "Limites do contato" })).toBeTruthy();
    expect(screen.getByText("de 1 a 100")).toBeTruthy();
    expect(screen.getByText("de 1 a 5000")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
    expect(screen.getByText(/Nenhum alarme de excesso registrado/)).toBeTruthy();
    expect(screen.getAllByLabelText("Novo limite por hora")).toHaveLength(3);
    expect(screen.getAllByLabelText("Motivo da alteração")).toHaveLength(3);
  });

  it("recusa desligada: aviso destacado e ligar exige confirmação e motivo", async () => {
    const u = userEvent.setup();
    await abrir();
    expect(screen.getByText("Desligada")).toBeTruthy();
    expect(screen.getByText(/Só ligue com o Turnstile no ar/)).toBeTruthy();
    expect(screen.getByText(/Muitos pedidos em pouco tempo/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Ligar recusa de excesso" }));
    expect(
      await screen.findByText("Confirme que o Turnstile está no ar antes de ligar."),
    ).toBeTruthy();
    expect(screen.getByText("Informe o motivo.")).toBeTruthy();
    expect(acao).not.toHaveBeenCalled();
  });

  it("recusa desligada: com confirmação e motivo envia valor 1", async () => {
    acao.mockResolvedValue({ sucesso: "Parâmetro atualizado." });
    const u = userEvent.setup();
    await abrir();
    await u.click(screen.getByLabelText(/Confirmo que o Turnstile está no ar/));
    await u.type(screen.getByLabelText("Motivo para ligar"), "Turnstile ativo desde hoje");
    await u.click(screen.getByRole("button", { name: "Ligar recusa de excesso" }));
    await vi.waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const f = acao.mock.calls[0]![1];
    expect(f.get("chave")).toBe("contato_recusar_excesso");
    expect(f.get("valor")).toBe("1");
    expect((await screen.findByText("Parâmetro atualizado.")).getAttribute("role")).toBe("status");
  });

  it("recusa ligada: desligar não pede confirmação, só motivo", async () => {
    recusa = 1;
    await abrir();
    expect(screen.getByText("Ligada")).toBeTruthy();
    expect(screen.queryByLabelText(/Confirmo que o Turnstile/)).toBeNull();
    expect(screen.getByRole("button", { name: "Desligar recusa de excesso" })).toBeTruthy();
  });

  it("limite fora da faixa e motivo curto são barrados no navegador; erro do servidor sai com role=alert", async () => {
    const u = userEvent.setup();
    await abrir();
    const valor = screen.getAllByLabelText("Novo limite por hora")[0]!;
    await u.clear(valor);
    await u.type(valor, "500");
    await u.type(screen.getAllByLabelText("Motivo da alteração")[0]!, "curto");
    await u.click(screen.getAllByRole("button", { name: "Salvar limite" })[0]!);
    expect(await screen.findByText("Informe um valor entre 1 e 100.")).toBeTruthy();
    expect(screen.getByText("O motivo deve ter ao menos 10 caracteres.")).toBeTruthy();
    expect(acao).not.toHaveBeenCalled();

    acao.mockResolvedValue({ erro: "Não foi possível salvar." });
    await u.clear(valor);
    await u.type(valor, "20");
    await u.type(screen.getAllByLabelText("Motivo da alteração")[0]!, "{Control>}a{/Control}");
    await u.clear(screen.getAllByLabelText("Motivo da alteração")[0]!);
    await u.type(screen.getAllByLabelText("Motivo da alteração")[0]!, "Ajuste após revisão");
    await u.click(screen.getAllByRole("button", { name: "Salvar limite" })[0]!);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível salvar.");
  });

  it("lista alarmes com alvo abreviado, níveis e filtro por tipo; sem dado pessoal", async () => {
    alarmes = [
      {
        id: 1,
        tipo: "link",
        janela: "2026-11-09T15:00:00Z",
        alvoId: ID_ALVO,
        nivel: 1,
        quantidade: 20,
        limite: 10,
        criadoEm: "2026-11-09T15:30:00Z",
      },
      {
        id: 2,
        tipo: "global",
        janela: "2026-11-09T15:00:00Z",
        alvoId: null,
        nivel: 2,
        quantidade: 800,
        limite: 200,
        criadoEm: "2026-11-09T15:40:00Z",
      },
    ];
    const { container } = await abrir({ tipo: "link" });
    expect(listarAlarmesContato).toHaveBeenCalledWith({ tipo: "link", pagina: 1 });
    expect(screen.getByText("abcdef12")).toBeTruthy();
    expect(container.textContent).not.toContain(ID_ALVO);
    expect(screen.getByText("2 vezes o limite")).toBeTruthy();
    expect(screen.getByText("4 vezes o limite")).toBeTruthy();
    expect(screen.getAllByText("09/11/2026 12:00")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Por link" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Global" }).getAttribute("href")).toBe(
      "/administracao/limites-contato?tipo=global",
    );
  });

  it("paginação mantém o filtro; tipo inválido é ignorado", async () => {
    alarmes = Array.from({ length: 1 }, (_, i) => ({
      id: i,
      tipo: "destino",
      janela: "2026-11-09T15:00:00Z",
      alvoId: ID_ALVO,
      nivel: 0,
      quantidade: 30,
      limite: 30,
      criadoEm: "2026-11-09T15:30:00Z",
    }));
    listarAlarmesContato.mockResolvedValueOnce({
      ok: true,
      valor: { itens: alarmes, total: 120, pagina: 2, porPagina: 50 },
    });
    await abrir({ tipo: "destino", pagina: "2" });
    expect(screen.getByText("Página 2 de 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Página anterior" }).getAttribute("href")).toBe(
      "/administracao/limites-contato?tipo=destino",
    );
    expect(screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")).toBe(
      "/administracao/limites-contato?tipo=destino&pagina=3",
    );
    cleanup();
    await abrir({ tipo: "lixo" });
    expect(listarAlarmesContato).toHaveBeenLastCalledWith({ pagina: 1 });
  });

  it("aparece no menu da Administração só para o administrador geral", () => {
    const href = "/administracao/limites-contato";
    expect(itensAdministracao({ geral: true, permissoes: [] }).some((i) => i.href === href)).toBe(
      true,
    );
    expect(itensAdministracao({ geral: false, permissoes: [] }).some((i) => i.href === href)).toBe(
      false,
    );
  });
});
