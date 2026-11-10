// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstadoLink } from "./_lib/estado-indicacoes";

const acao = vi.fn<(e: EstadoLink, f: FormData) => Promise<EstadoLink>>();
vi.mock("./acoes-indicacoes", () => ({
  acaoDescartarNotificacoes: (e: EstadoLink, f: FormData) => acao(e, f),
}));

const A = "abcdef12-3456-4789-8abc-def012345678";
const B = "12345678-3456-4789-8abc-def012345678";
let ehAdmin = true;
let itens: unknown[] = [];
let total = 0;
const listar = vi.fn(async (a: { estado?: string; pagina?: number }) => ({
  ok: true as const,
  valor: { itens, total, pagina: a.pagina ?? 1, porPagina: 50 },
}));
vi.mock("./_lib/contexto-indicacoes", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-indicacoes")>()),
  obterContextoIndicacoes: async () => ({
    logado: true,
    ehAdministrador: async () => ehAdmin,
    servico: { listarNotificacoesDescartaveis: listar },
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

import PaginaNotificacoesPendentes from "./administracao/notificacoes-pendentes/page";
import { itensAdministracao } from "./_componentes/menu-painel-dados";
import { legendaNotificacao } from "./_componentes/pedidos";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  ehAdmin = true;
  itens = [];
  total = 0;
});

const item = (id: string, estado: "pendente" | "falhou", destinoNome: string) => ({
  id,
  criadoEm: "2026-11-09T15:00:00Z",
  estado,
  tentativas: estado === "falhou" ? 3 : 0,
  destinoNome,
});
const abrir = async (busca: Record<string, string> = {}) =>
  render(await PaginaNotificacoesPendentes({ searchParams: Promise.resolve(busca) }));

const MOTIVO = "Notificações de teste antigas";

async function preencherEEnviar(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText("Motivo do descarte"), MOTIVO);
  await u.click(screen.getByLabelText(/Confirmo que quero descartar/));
  await u.click(screen.getByRole("button", { name: "Descartar selecionadas" }));
}

describe("Notificações pendentes (IM-103, IM-027, IM-028)", () => {
  it("quem não é administrador recebe 404", async () => {
    ehAdmin = false;
    await expect(
      PaginaNotificacoesPendentes({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listar).not.toHaveBeenCalled();
  });

  it("lista vazia mostra o estado vazio e nenhum formulário", async () => {
    await abrir();
    expect(screen.getByText(/Nenhuma notificação pendente ou com falha/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Descartar selecionadas" })).toBeNull();
  });

  it("lista destino, data, estado e tentativas; nada do visitante", async () => {
    itens = [item(A, "falhou", "Padaria da Ana"), item(B, "pendente", "Loja do Beto")];
    total = 2;
    const { container } = await abrir({ estado: "falhou" });
    expect(listar).toHaveBeenCalledWith({ estado: "falhou", pagina: 1 });
    expect(screen.getByText("Padaria da Ana")).toBeTruthy();
    expect(screen.getByText("Falhou")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getAllByText("09/11/2026 12:00").length).toBeGreaterThan(0);
    expect(screen.getByText("abcdef12")).toBeTruthy();
    expect(container.textContent).not.toContain(A);
    expect(screen.getByRole("link", { name: "Com falha" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Pendentes" }).getAttribute("href")).toBe(
      "/administracao/notificacoes-pendentes?estado=pendente",
    );
  });

  it("paginação mantém o filtro; estado inválido é ignorado", async () => {
    itens = [item(A, "falhou", "Padaria")];
    total = 120;
    await abrir({ estado: "falhou", pagina: "2" });
    expect(screen.getByText("Página 2 de 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")).toBe(
      "/administracao/notificacoes-pendentes?estado=falhou&pagina=3",
    );
    cleanup();
    await abrir({ estado: "enviada" });
    expect(listar).toHaveBeenLastCalledWith({ pagina: 1 });
  });

  it("sem seleção, motivo curto e sem confirmação: barra no navegador e não chama a ação", async () => {
    itens = [item(A, "falhou", "Padaria da Ana")];
    total = 1;
    const u = userEvent.setup();
    await abrir();
    await u.type(screen.getByLabelText("Motivo do descarte"), "curto");
    await u.click(screen.getByRole("button", { name: "Descartar selecionadas" }));
    expect(await screen.findByText("Selecione ao menos uma notificação.")).toBeTruthy();
    expect(screen.getByText("O motivo deve ter ao menos 10 caracteres.")).toBeTruthy();
    expect(screen.getByText(/Marque a confirmação/)).toBeTruthy();
    expect(acao).not.toHaveBeenCalled();
  });

  it("seleção em lote com motivo e confirmação envia os ids; mostra a contagem devolvida", async () => {
    itens = [item(A, "falhou", "Padaria da Ana"), item(B, "pendente", "Loja do Beto")];
    total = 2;
    acao.mockResolvedValue({ sucesso: "2 notificações descartadas." });
    const u = userEvent.setup();
    await abrir();
    await u.click(screen.getByLabelText("Selecionar todas desta página"));
    expect(screen.getByText("2 notificações selecionadas.")).toBeTruthy();
    await preencherEEnviar(u);
    await vi.waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const f = acao.mock.calls[0]![1];
    expect(f.getAll("pedidoIds")).toEqual([A, B]);
    expect(f.get("motivo")).toBe(MOTIVO);
    expect(f.get("confirmo")).toBe("sim");
    expect((await screen.findByText("2 notificações descartadas.")).getAttribute("role")).toBe(
      "status",
    );
  });

  it("escolha individual envia só o item marcado", async () => {
    itens = [item(A, "falhou", "Padaria da Ana"), item(B, "pendente", "Loja do Beto")];
    total = 2;
    acao.mockResolvedValue({ sucesso: "1 notificação descartada." });
    const u = userEvent.setup();
    await abrir();
    await u.click(screen.getByLabelText(/Loja do Beto/));
    await preencherEEnviar(u);
    await vi.waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acao.mock.calls[0]![1].getAll("pedidoIds")).toEqual([B]);
  });

  it("erro do servidor aparece como alerta, sem texto do banco", async () => {
    itens = [item(A, "falhou", "Padaria da Ana")];
    total = 1;
    acao.mockResolvedValue({
      erro: "Não foi possível concluir agora. Tente novamente em instantes.",
    });
    const u = userEvent.setup();
    const { container } = await abrir();
    await u.click(screen.getByLabelText(/Padaria da Ana/));
    await preencherEEnviar(u);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível concluir");
    expect(container.textContent).not.toMatch(/relation|SQLSTATE/);
  });

  it("erro de leitura mostra a mensagem do módulo", async () => {
    listar.mockResolvedValueOnce({
      ok: false,
      erro: { mensagem: "Você não tem permissão para esta ação." },
    } as never);
    await abrir();
    expect(screen.getByRole("alert").textContent).toContain("Você não tem permissão");
  });

  it("aparece no menu só para o administrador geral; legenda Descartada", () => {
    const href = "/administracao/notificacoes-pendentes";
    const geral = itensAdministracao({ geral: true, permissoes: [] });
    const comum = itensAdministracao({ geral: false, permissoes: [] });
    expect(geral.some((i) => i.href === href)).toBe(true);
    expect(comum.some((i) => i.href === href)).toBe(false);
    expect(legendaNotificacao("descartada", true)).toBe("Descartada");
  });
});
