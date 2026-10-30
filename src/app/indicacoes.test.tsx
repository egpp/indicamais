// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VISITANTE,
  criarMundoIndicacoes,
  linhaFila,
  linhaPedido,
  type Usuario,
} from "../../tests/suporte/banco-indicacoes-memoria";
import { criarMundoPublico } from "../../tests/suporte/bancos-publicos-memoria";
import type { ContextoIndicacoes } from "./_lib/contexto-indicacoes";
import type { EstadoContato, EstadoLink } from "./_lib/estado-indicacoes";

const acaoContato = vi.fn<(e: EstadoContato, f: FormData) => Promise<EstadoContato>>();
const acaoLink = vi.fn<(e: EstadoLink, f: FormData) => Promise<EstadoLink>>();
const acaoRegistrar = vi.fn(async () => true);
const semAcao = vi.fn(async () => ({}));

vi.mock("./acoes-indicacoes", () => ({
  acaoEnviarContato: (e: EstadoContato, f: FormData) => acaoContato(e, f),
  acaoGerarLink: (e: EstadoLink, f: FormData) => acaoLink(e, f),
  acaoRegistrarCompartilhamento: (...a: unknown[]) => acaoRegistrar(...(a as [])),
  acaoPedirReenvio: (...a: unknown[]) => semAcao(...(a as [])),
  acaoReenviarComoAdmin: (...a: unknown[]) => semAcao(...(a as [])),
  acaoTratarAlerta: (...a: unknown[]) => semAcao(...(a as [])),
  acaoDefinirParametro: (...a: unknown[]) => semAcao(...(a as [])),
}));

vi.mock("./acoes-pontos", () => ({
  acaoDefinirParametroPontos: (...a: unknown[]) => semAcao(...(a as [])),
}));
// Fase 4: a página de parâmetros também lista os parâmetros de pontos (D-012), aqui com um serviço falso.
vi.mock("./_lib/contexto-pontos", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-pontos")>()),
  obterContextoPontos: async () => ({
    logado: true,
    ehAdministrador: async () => true,
    servico: {
      parametrosAtuais: async () => ({
        ok: true,
        valor: { pontosPorIndicacao: 10, intervaloDias: 30 },
      }),
    },
  }),
}));

let contextoAtual: ContextoIndicacoes;
vi.mock("./_lib/contexto-indicacoes", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-indicacoes")>()),
  obterContextoIndicacoes: async () => contextoAtual,
  obterContextoIndicacoesAberto: async () => contextoAtual,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { AcoesDoDestino } from "./_componentes/acoes-destino";
import { FormContato } from "./_componentes/form-contato";
import { IndicarDestino } from "./_componentes/indicar-destino";
import PaginaPedidosAdmin from "./administracao/pedidos/page";
import PaginaParametros from "./administracao/parametros/page";
import PaginaMinhasIndicacoes from "./minhas-indicacoes/page";
import PaginaPedidosDeContato from "./pedidos-de-contato/page";
import PaginaPolitica from "./politica-de-privacidade/page";

const CHAVE = "chave-de-teste-0123456789";
const URL_WA = "https://wa.me/5551988887777?text=Ol%C3%A1";

function contextoCom(usuario: Usuario | null) {
  const publico = criarMundoPublico();
  const mundo = criarMundoIndicacoes({ usuario });
  contextoAtual = mundo.contexto(publico.contexto().leitura);
  return { publico, mundo };
}

beforeEach(() => {
  contextoCom(null);
  vi.stubEnv("EMAIL_API_KEY", "");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

async function preencher(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText("Seu nome"), "Carla Visitante");
  await u.type(screen.getByLabelText("Seu WhatsApp"), "11987654321");
}

describe("formulário de contato do visitante (IM-026, IM-028)", () => {
  it("tem rótulos, e-mail e mensagem opcionais, máscara BR, aviso de uso dos dados e link da política", async () => {
    const u = userEvent.setup();
    render(<FormContato tipo="perfil" slug="padaria-da-ana" chave={CHAVE} />);
    expect(screen.getByLabelText("Seu nome")).toBeTruthy();
    expect(screen.getByLabelText(/Seu e-mail/).closest(".campo")?.textContent).toContain(
      "(opcional)",
    );
    expect(screen.getByLabelText(/Mensagem/).closest(".campo")?.textContent).toContain(
      "(opcional)",
    );
    await u.type(screen.getByLabelText("Seu WhatsApp"), "11987654321");
    expect((screen.getByLabelText("Seu WhatsApp") as HTMLInputElement).value).toBe(
      "(11) 98765-4321",
    );
    expect(screen.getByText(/serão enviados somente ao responsável/)).toBeTruthy();
    const politica = screen.getByRole("link", {
      name: /política de privacidade \(texto provisório\)/,
    });
    expect(politica.getAttribute("href")).toBe("/politica-de-privacidade");
  });

  it("valida no navegador com o schema do módulo, foca o campo e não envia", async () => {
    const u = userEvent.setup();
    render(<FormContato tipo="perfil" slug="padaria-da-ana" chave={CHAVE} />);
    await u.type(screen.getByLabelText("Seu WhatsApp"), "123");
    await u.type(screen.getByLabelText(/Seu e-mail/), "sem-arroba");
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    expect(await screen.findByText("Informe seu nome.")).toBeTruthy();
    expect(screen.getByText(/WhatsApp válido com DDD/)).toBeTruthy();
    expect(screen.getByText("E-mail inválido.")).toBeTruthy();
    expect(acaoContato).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Seu nome").getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Seu nome")));
  });

  it("trava o botão durante o envio e só envia uma vez (IM-028)", async () => {
    acaoContato.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => r({ sucesso: "Pedido enviado.", urlWhatsapp: URL_WA }), 150),
        ),
    );
    const u = userEvent.setup();
    render(<FormContato tipo="perfil" slug="padaria-da-ana" chave={CHAVE} />);
    await preencher(u);
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    const botao = await screen.findByRole("button", { name: "Enviando..." });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    await u.click(botao);
    expect(await screen.findByRole("link", { name: "Abrir WhatsApp" })).toBeTruthy();
    expect(acaoContato).toHaveBeenCalledTimes(1);
  });

  it("a mesma chave vai em todo reenvio do mesmo formulário e o ?ind segue como veio", async () => {
    acaoContato
      .mockResolvedValueOnce({
        erro: "Não foi possível concluir agora. Tente novamente em instantes.",
        valores: { nome: "Carla Visitante", whatsapp: "(11) 98765-4321" },
      })
      .mockResolvedValueOnce({ sucesso: "Pedido enviado.", urlWhatsapp: URL_WA });
    const u = userEvent.setup();
    const ind = "a".repeat(32);
    render(<FormContato tipo="item" id={randomUUID()} chave={CHAVE} ind={ind} />);
    await preencher(u);
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    expect(await screen.findByRole("link", { name: "Abrir WhatsApp" })).toBeTruthy();

    expect(acaoContato).toHaveBeenCalledTimes(2);
    const [a, b] = acaoContato.mock.calls.map((c) => c[1]);
    expect(a!.get("chave")).toBe(CHAVE);
    expect(b!.get("chave")).toBe(CHAVE);
    expect(a!.get("ind")).toBe(ind);
    expect(a!.get("tipo")).toBe("item");
  });

  it("depois do sucesso mostra a confirmação e o link do WhatsApp (só wa.me), sem o formulário", async () => {
    acaoContato.mockResolvedValue({ sucesso: "Pedido enviado.", urlWhatsapp: URL_WA });
    const u = userEvent.setup();
    render(<FormContato tipo="perfil" slug="padaria-da-ana" chave={CHAVE} />);
    await preencher(u);
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    const link = await screen.findByRole("link", { name: "Abrir WhatsApp" });
    expect(link.getAttribute("href")).toBe(URL_WA);
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Pedido enviado.")).toBeTruthy();
    expect(screen.queryByLabelText("Seu nome")).toBeNull();
  });

  it("endereço que não é wa.me nunca vira link nem redirecionamento", async () => {
    acaoContato.mockResolvedValue({
      sucesso: "Pedido enviado.",
      urlWhatsapp: "https://malicioso.exemplo/x",
    });
    const u = userEvent.setup();
    render(<FormContato tipo="perfil" slug="padaria-da-ana" chave={CHAVE} />);
    await preencher(u);
    await u.click(screen.getByRole("button", { name: "Enviar pedido de contato" }));
    await waitFor(() => expect(acaoContato).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "Abrir WhatsApp" })).toBeNull();
  });
});

describe("ações da página pública (IM-013, IM-024, IM-025)", () => {
  it("cada renderização gera uma chave nova e válida; o ?ind só entra se for um código", () => {
    const { container, rerender } = render(
      <AcoesDoDestino
        tipo="perfil"
        slug="padaria-da-ana"
        rotuloIndicar="Indique esta empresa"
        retorno="/perfil/padaria-da-ana"
        ind={"c".repeat(32)}
      />,
    );
    const chave1 = container.querySelector<HTMLInputElement>('input[name="chave"]')!.value;
    expect(chave1).toMatch(/^[0-9a-f-]{36}$/);
    expect(container.querySelector<HTMLInputElement>('input[name="ind"]')!.value).toBe(
      "c".repeat(32),
    );
    cleanup();
    const outro = render(
      <AcoesDoDestino
        tipo="perfil"
        slug="padaria-da-ana"
        rotuloIndicar="Indique esta empresa"
        retorno="/perfil/padaria-da-ana"
        ind="<script>alert(1)</script>"
      />,
    );
    expect(outro.container.querySelector('input[name="ind"]')).toBeNull();
    expect(outro.container.querySelector<HTMLInputElement>('input[name="chave"]')!.value).not.toBe(
      chave1,
    );
    void rerender;
  });

  it("nenhum código de indicação vai para cookie, localStorage ou sessionStorage (IM-025)", async () => {
    const u = userEvent.setup();
    render(
      <AcoesDoDestino
        tipo="perfil"
        slug="padaria-da-ana"
        rotuloIndicar="Indique esta empresa"
        retorno="/perfil/padaria-da-ana"
        ind={"d".repeat(32)}
      />,
    );
    await u.type(screen.getByLabelText("Seu nome"), "Carla");
    expect(document.cookie).toBe("");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("Indique (IM-024)", () => {
  const props = {
    tipo: "perfil",
    slug: "padaria-da-ana",
    rotulo: "Indique esta empresa",
    retorno: "/perfil/padaria-da-ana",
  } as const;
  const link = {
    codigo: "f".repeat(32),
    url: `https://app.exemplo/perfil/padaria-da-ana?ind=${"f".repeat(32)}`,
    texto: "Conheça a Padaria da Ana no IndicaMais: https://app.exemplo/x",
    urlWhatsapp: "https://wa.me/?text=Conhe%C3%A7a",
  };

  it("logado com WhatsApp: mostra o link, copia, compartilha no WhatsApp e registra os dois", async () => {
    acaoLink.mockResolvedValue({ link });
    const u = userEvent.setup();
    const escrever = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: escrever },
      configurable: true,
    });
    render(<IndicarDestino {...props} />);
    await u.click(screen.getByRole("button", { name: "Indique esta empresa" }));
    const campo = (await screen.findByLabelText("Seu link de indicação")) as HTMLInputElement;
    expect(campo.value).toBe(link.url);
    expect(campo.readOnly).toBe(true);

    await u.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(escrever).toHaveBeenCalledWith(link.url);
    expect(await screen.findByText("Link copiado.")).toBeTruthy();
    expect(acaoRegistrar).toHaveBeenCalledWith(link.codigo, "copiar");

    const wa = screen.getByRole("link", { name: "Compartilhar no WhatsApp" });
    expect(wa.getAttribute("href")).toBe(link.urlWhatsapp);
    expect(wa.getAttribute("target")).toBe("_blank");
    await u.click(wa);
    expect(acaoRegistrar).toHaveBeenCalledWith(link.codigo, "whatsapp");
    expect(acaoLink.mock.calls[0]![1].get("slug")).toBe("padaria-da-ana");
  });

  it("não logado: leva a entrar e voltar para a mesma página, ou a criar conta", async () => {
    acaoLink.mockResolvedValue({ erro: "Entre na sua conta para continuar.", passo: "entrar" });
    const u = userEvent.setup();
    render(<IndicarDestino {...props} />);
    await u.click(screen.getByRole("button", { name: "Indique esta empresa" }));
    expect(await screen.findByText("Entre na sua conta para continuar.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe(
      `/entrar?proximo=${encodeURIComponent("/perfil/padaria-da-ana")}`,
    );
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe(
      "/cadastro",
    );
  });

  it("sem WhatsApp: leva a Minha conta; dono: só a mensagem de autoindicação", async () => {
    const u = userEvent.setup();
    acaoLink.mockResolvedValueOnce({
      erro: "Cadastre seu WhatsApp na sua conta antes de indicar.",
      passo: "whatsapp",
    });
    const a = render(<IndicarDestino {...props} />);
    await u.click(screen.getByRole("button", { name: "Indique esta empresa" }));
    expect(
      (await screen.findByRole("link", { name: "Cadastrar meu WhatsApp" })).getAttribute("href"),
    ).toBe("/minha-conta");
    a.unmount();

    acaoLink.mockResolvedValueOnce({
      erro: "Você não pode gerar link de indicação para o seu próprio perfil ou anúncio.",
      passo: "autoindicacao",
    });
    render(<IndicarDestino {...props} />);
    await u.click(screen.getByRole("button", { name: "Indique esta empresa" }));
    expect(await screen.findByText(/seu próprio perfil ou anúncio/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Cadastrar meu WhatsApp" })).toBeNull();
    expect(screen.queryByLabelText("Seu link de indicação")).toBeNull();
  });
});

describe("Pedidos de contato do responsável (IM-027, IM-028)", () => {
  it("lista com nome, WhatsApp (wa.me), e-mail, mensagem, data em Brasília, origem e legenda de e-mail não configurado", async () => {
    const { mundo } = contextoCom({ id: randomUUID() });
    mundo.definirMeusPedidos([
      linhaPedido({ veio_por_indicacao: true }),
      linhaPedido({
        id: randomUUID(),
        nome: "Outro",
        criado_em: "2026-10-29T01:00:00Z",
        notificacao_estado: "falhou",
        email: null,
        mensagem: null,
      }),
    ]);
    const { container } = render(await PaginaPedidosDeContato());
    expect(screen.getByRole("heading", { level: 1, name: "Pedidos de contato" })).toBeTruthy();
    const wa = screen.getAllByRole("link", { name: "(11) 98765-4321" })[0]!;
    expect(wa.getAttribute("href")).toBe("https://wa.me/5511987654321");
    expect(screen.getByRole("link", { name: "carla@exemplo.com" })).toBeTruthy();
    expect(screen.getByText("Quero encomendar um bolo.")).toBeTruthy();
    // 15:30 UTC = 12:30 em Brasília; 01:00 UTC do dia 29 = 22:00 do dia 28.
    expect(container.textContent).toContain("30/10/2026 12:30");
    expect(container.textContent).toContain("28/10/2026 22:00");
    expect(screen.getByText("Veio por indicação")).toBeTruthy();
    expect(screen.getByText("Contato direto")).toBeTruthy();
    expect(
      screen.getAllByText("Aviso por e-mail ainda não configurado: veja aqui no painel").length,
    ).toBe(1);
    expect(screen.getByText("O aviso por e-mail falhou")).toBeTruthy();
    // Só o pedido que falhou tem "Pedir reenvio".
    expect(screen.getAllByRole("button", { name: "Pedir reenvio" })).toHaveLength(1);
    // O responsável não vê o último erro técnico nem tentativas.
    expect(container.textContent).not.toMatch(/Tentativas|Último erro/);
  });

  it("com provedor configurado a legenda muda para 'pendente'", async () => {
    vi.stubEnv("EMAIL_API_KEY", "chave");
    const { mundo } = contextoCom({ id: randomUUID() });
    mundo.definirMeusPedidos([linhaPedido()]);
    render(await PaginaPedidosDeContato());
    expect(screen.getByText("Aviso por e-mail pendente")).toBeTruthy();
    expect(screen.queryByText(/ainda não configurado/)).toBeNull();
  });

  it("sem pedidos: mensagem amigável", async () => {
    contextoCom({ id: randomUUID() });
    render(await PaginaPedidosDeContato());
    expect(screen.getByText("Você ainda não recebeu pedidos de contato.")).toBeTruthy();
  });
});

describe("Minhas indicações: privacidade do indicador (IM-029)", () => {
  it("mostra links e indicações recebidas SEM nenhum dado do visitante", async () => {
    const { mundo } = contextoCom({ id: randomUUID(), comWhatsapp: true });
    const destinoId = randomUUID();
    mundo.definirMeusLinks([
      {
        id: randomUUID(),
        codigo: "a".repeat(32),
        destino_tipo: "perfil",
        destino_id: destinoId,
        destino_nome: "Padaria da Ana",
        disponivel: true,
        criado_em: "2026-10-30T12:00:00Z",
      },
      {
        id: randomUUID(),
        codigo: "b".repeat(32),
        destino_tipo: "item",
        destino_id: randomUUID(),
        destino_nome: "Bolo velho",
        disponivel: false,
        criado_em: "2026-10-29T12:00:00Z",
      },
    ]);
    // A linha da visão "vaza" campos privados de propósito: o modelo e a tela precisam descartá-los.
    mundo.definirMinhasIndicacoes([
      {
        id: randomUUID(),
        destino_tipo: "perfil",
        destino_id: destinoId,
        destino_nome: "Padaria da Ana",
        criado_em: "2026-10-30T15:30:00Z",
        status: "recebido",
        nome: VISITANTE.nome,
        whatsapp_e164: "+5511987654321",
        email: "carla@exemplo.com",
        mensagem: "Quero encomendar um bolo.",
      } as never,
    ]);
    const { container } = render(await PaginaMinhasIndicacoes());
    expect(screen.getByRole("heading", { level: 1, name: "Minhas indicações" })).toBeTruthy();
    const links = screen.getByRole("heading", { name: "Links que gerei" }).closest("section")!;
    expect(
      within(links).getByRole("button", { name: "Copiar ou compartilhar de novo" }),
    ).toBeTruthy();
    expect(within(links).getByText("Indisponível no momento")).toBeTruthy();
    // Link indisponível não oferece copiar nem compartilhar.
    expect(within(links).getAllByRole("button")).toHaveLength(1);
    const recebidas = screen
      .getByRole("heading", { name: "Indicações recebidas" })
      .closest("section")!;
    expect(within(recebidas).getByText("Pedido de contato recebido")).toBeTruthy();
    expect(within(recebidas).getByText(/Em 30\/10\/2026 12:30/)).toBeTruthy();

    const html = container.innerHTML + container.textContent;
    for (const privado of [
      VISITANTE.nome,
      "98765",
      "5511987654321",
      "carla@exemplo.com",
      "encomendar um bolo",
      "wa.me",
      "mailto:",
    ]) {
      expect(html).not.toContain(privado);
    }
  });
});

describe("Administração dos pedidos e dos parâmetros (IM-028, IM-034)", () => {
  const args = (busca: Record<string, string> = {}) =>
    ({ params: Promise.resolve({}), searchParams: Promise.resolve(busca) }) as never;

  it("quem não é administrador recebe 404 nas duas telas", async () => {
    contextoCom({ id: randomUUID() });
    await expect(PaginaPedidosAdmin(args())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PaginaParametros()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("fila: suspeita de autoindicação, tentativas, erro, alerta; filtro de alertas abertos; reenviar e tratar alerta com motivo", async () => {
    const { mundo } = contextoCom({ id: randomUUID(), admin: true });
    mundo.definirFila([
      linhaFila({
        nome: "Pedido com alarme",
        notificacao_estado: "falhou",
        alerta_estado: "aberto",
        tentativas: 3,
        ultimo_erro: "limite de tentativas atingido",
        autoindicacao_suspeita: true,
      }),
      linhaFila({ nome: "Pedido tranquilo", alerta_estado: "nenhum" }),
    ]);
    const todos = render(await PaginaPedidosAdmin(args()));
    expect(screen.getByText("Pedido com alarme")).toBeTruthy();
    expect(screen.getByText("Pedido tranquilo")).toBeTruthy();
    expect(screen.getByText("Suspeita de autoindicação")).toBeTruthy();
    expect(screen.getByText("limite de tentativas atingido")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Reenviar" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Tratar alerta" })).toHaveLength(1);
    expect(screen.getAllByLabelText("Motivo do reenvio").length).toBe(2);
    expect(screen.getByRole("link", { name: "Só alertas abertos" }).getAttribute("href")).toBe(
      "/administracao/pedidos?alertas=abertos",
    );
    todos.unmount();

    render(await PaginaPedidosAdmin(args({ alertas: "abertos" })));
    expect(screen.getByText("Pedido com alarme")).toBeTruthy();
    expect(screen.queryByText("Pedido tranquilo")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Só alertas abertos" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("reenviar sem motivo é barrado no navegador com o mesmo texto do servidor", async () => {
    const { mundo } = contextoCom({ id: randomUUID(), admin: true });
    mundo.definirFila([linhaFila({ alerta_estado: "aberto", notificacao_estado: "falhou" })]);
    const u = userEvent.setup();
    render(await PaginaPedidosAdmin(args()));
    await u.click(screen.getByRole("button", { name: "Reenviar" }));
    expect(await screen.findByText("Informe o motivo.")).toBeTruthy();
    expect(semAcao).not.toHaveBeenCalled();
  });

  it("parâmetros: lista valor, mínimo e máximo, e o formulário pede valor e motivo", async () => {
    contextoCom({ id: randomUUID(), admin: true });
    const u = userEvent.setup();
    render(await PaginaParametros());
    expect(screen.getByText("contato_limite_por_hora")).toBeTruthy();
    expect(screen.getByText("Valor atual")).toBeTruthy();
    expect(screen.getByText("Mínimo")).toBeTruthy();
    expect(screen.getByText("Máximo")).toBeTruthy();
    expect(screen.getByText("Entre 1 e 50.")).toBeTruthy();
    await u.clear(screen.getByLabelText("Novo valor"));
    await u.type(screen.getByLabelText("Novo valor"), "abc");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe um número inteiro.")).toBeTruthy();
    expect(screen.getByText("Informe o motivo.")).toBeTruthy();
    expect(semAcao).not.toHaveBeenCalled();
  });
});

describe("política de privacidade provisória", () => {
  it("está claramente marcada como provisória", () => {
    render(<PaginaPolitica />);
    expect(screen.getAllByText(/provisório/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeTruthy();
  });
});
