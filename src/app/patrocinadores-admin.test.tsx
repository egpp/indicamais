// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarMundoPublico, type MundoPublico } from "../../tests/suporte/bancos-publicos-memoria";
import { formulario } from "../../tests/suporte/bancos-memoria";
import {
  criarContextoPatrocinadores,
  type ContextoPatrocinadores,
} from "./_lib/contexto-patrocinadores";

let contextoAtual: ContextoPatrocinadores;
const acaoLenta = vi.fn(
  () => new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 200)),
);

vi.mock("./_lib/contexto-patrocinadores", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-patrocinadores")>()),
  obterContextoPatrocinadores: async () => contextoAtual,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("./acoes-patrocinadores", () => ({
  acaoCriarPatrocinador: (...a: unknown[]) => acaoLenta(...(a as [])),
  acaoAlterarPatrocinador: (...a: unknown[]) => acaoLenta(...(a as [])),
  acaoDefinirPatrocinadorAtivo: (...a: unknown[]) => acaoLenta(...(a as [])),
}));
vi.mock("./acoes-conteudo", () => ({}));

import PaginaPatrocinadores from "./administracao/patrocinadores/page";
import PaginaPatrocinador from "./administracao/patrocinadores/[id]/page";
import {
  FormAtivarPatrocinador,
  FormEditarPatrocinador,
  FormNovoPatrocinador,
} from "./_componentes/form-patrocinador";
import { brasiliaParaIsoUtc, isoUtcParaBrasilia } from "./_lib/data-fuso";
import {
  alterarPatrocinador,
  criarPatrocinador,
  definirPatrocinadorAtivo,
} from "./_lib/tratadores-patrocinadores";
import {
  validarAlterarPatrocinador,
  validarCriarPatrocinador,
  validarDefinirAtivo,
} from "./_lib/validacao-patrocinadores";

let m: MundoPublico;
beforeEach(() => {
  m = criarMundoPublico({ agora: new Date("2026-10-28T15:00:00Z") });
  contextoAtual = criarContextoPatrocinadores({
    bancoPatrocinadores: m.bancoPatrocinadores,
    bancoBusca: m.bancoBusca,
    assinarImagens: async (c) =>
      Object.fromEntries(c.map((x) => [x, `https://storage.exemplo/assinada/${x}`])),
  });
  acaoLenta.mockClear();
});
afterEach(() => cleanup());

const args = (params: Record<string, string> = {}, busca: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params), searchParams: Promise.resolve(busca) }) as never;

const imagemDe = (id: string) => `patrocinador/${id}/${randomUUID()}.webp`;

describe("datas no fuso de Brasília (IM-005)", () => {
  it("converte horário de Brasília para ISO em UTC e de volta", () => {
    expect(brasiliaParaIsoUtc("2026-11-05T14:30")).toBe("2026-11-05T17:30:00.000Z");
    expect(brasiliaParaIsoUtc("2026-01-15T23:00")).toBe("2026-01-16T02:00:00.000Z");
    expect(isoUtcParaBrasilia("2026-11-05T17:30:00.000Z")).toBe("2026-11-05T14:30");
    expect(isoUtcParaBrasilia("2026-01-16T02:00:00Z")).toBe("2026-01-15T23:00");
    expect(isoUtcParaBrasilia("2026-11-05T17:30:00Z")).toBe("2026-11-05T14:30");
  });

  it("vazio é sem limite; texto que não é data real volta como veio para o schema recusar", () => {
    expect(brasiliaParaIsoUtc("")).toBeNull();
    expect(brasiliaParaIsoUtc("   ")).toBeNull();
    expect(brasiliaParaIsoUtc("2026-13-40T10:00")).toBe("2026-13-40T10:00");
    expect(brasiliaParaIsoUtc("2026-02-31T10:00")).toBe("2026-02-31T10:00");
    expect(brasiliaParaIsoUtc("amanhã")).toBe("amanhã");
    expect(isoUtcParaBrasilia(null)).toBe("");
    expect(isoUtcParaBrasilia("lixo")).toBe("");
  });
});

describe("validação do formulário (mesmos schemas do servidor)", () => {
  const id = randomUUID();
  const base = () => ({
    id,
    titulo: "Padaria em destaque",
    imagemPath: imagemDe(id),
    textoDestino: "Pão quente",
    ordem: "1",
  });

  it("aceita texto de destino; recusa título curto, link, sem destino, dois destinos e período invertido", () => {
    expect(validarCriarPatrocinador(base())).toBeNull();
    expect(validarCriarPatrocinador({ ...base(), titulo: "A" })?.titulo).toMatch(/de 2 a 60/);
    expect(
      validarCriarPatrocinador({ ...base(), textoDestino: "veja https://x.com" }),
    ).toHaveProperty("textoDestino");
    expect(validarCriarPatrocinador({ ...base(), textoDestino: "www.loja.com.br" })).toHaveProperty(
      "textoDestino",
    );
    expect(validarCriarPatrocinador({ ...base(), textoDestino: "" })).toHaveProperty(
      "perfilDestinoId",
    );
    expect(validarCriarPatrocinador({ ...base(), perfilDestinoId: randomUUID() })).toHaveProperty(
      "textoDestino",
    );
    expect(
      validarCriarPatrocinador({
        ...base(),
        inicioEm: "2026-11-10T10:00",
        fimEm: "2026-11-09T10:00",
      })?.fimEm,
    ).toBe("O fim deve ser depois do início.");
    expect(validarCriarPatrocinador({ ...base(), inicioEm: "2026-13-40T10:00" })?.inicioEm).toBe(
      "Data e hora inválidas.",
    );
    expect(validarCriarPatrocinador({ ...base(), imagemPath: "" })?.imagemPath).toBeTruthy();
    expect(
      validarCriarPatrocinador({ ...base(), imagemPath: imagemDe(randomUUID()) })?.imagemPath,
    ).toBe("Imagem inválida. Envie novamente.");
  });

  it("alterar e ativar/desativar exigem motivo", () => {
    expect(validarAlterarPatrocinador({ ...base(), motivo: "" })?.motivo).toBe("Informe o motivo.");
    expect(validarAlterarPatrocinador({ ...base(), motivo: "ajuste do texto" })).toBeNull();
    expect(validarDefinirAtivo({ id, ativo: "nao", motivo: "" })?.motivo).toBe("Informe o motivo.");
    expect(validarDefinirAtivo({ id, ativo: "nao", motivo: "fim da campanha" })).toBeNull();
  });
});

describe("tratadores (administrador)", () => {
  const campos = (id: string, extra: Record<string, string> = {}) => ({
    id,
    titulo: "Padaria em destaque",
    imagemPath: imagemDe(id),
    textoDestino: "Pão quente",
    ordem: "3",
    inicioEm: "2026-11-05T14:30",
    fimEm: "2026-11-30T23:59",
    ...extra,
  });

  it("criar: horário de Brasília vira ISO UTC, id vem do formulário e a lista passa a mostrar", async () => {
    m.definirAdmin(true);
    const id = randomUUID();
    const r = await criarPatrocinador(contextoAtual, formulario(campos(id, { ativo: "sim" })));
    expect(r.destino).toBe("/administracao/patrocinadores?aviso=criado");
    const rpc = m.chamadas.rpcs.find((x) => x.nome === "administracao_criar_patrocinador")!;
    expect(rpc.args).toMatchObject({
      p_id: id,
      p_titulo: "Padaria em destaque",
      p_texto_destino: "Pão quente",
      p_perfil_destino_id: null,
      p_ordem: 3,
      p_ativo: true,
      p_inicio_em: "2026-11-05T17:30:00.000Z",
      p_fim_em: "2026-12-01T02:59:00.000Z",
    });
    expect(m.patrocinadores).toHaveLength(1);
  });

  it("criar com destino perfil e sem ativar: nasce inativo", async () => {
    m.definirAdmin(true);
    const perfil = m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    const id = randomUUID();
    const r = await criarPatrocinador(
      contextoAtual,
      formulario(campos(id, { textoDestino: "", perfilDestinoId: perfil.id })),
    );
    expect(r.destino).toBeDefined();
    expect(m.patrocinadores[0]).toMatchObject({ perfil_destino_id: perfil.id, ativo: false });
  });

  it("criar recusa erros com mensagem em português por campo e não chama o banco", async () => {
    m.definirAdmin(true);
    const id = randomUUID();
    const r = await criarPatrocinador(
      contextoAtual,
      formulario(campos(id, { textoDestino: "https://golpe.com", titulo: "A" })),
    );
    expect(r.destino).toBeUndefined();
    expect(r.erros?.titulo).toMatch(/de 2 a 60/);
    expect(m.chamadas.rpcs).toHaveLength(0);
    const semImagem = await criarPatrocinador(
      contextoAtual,
      formulario(campos(id, { imagemPath: "" })),
    );
    expect(semImagem.erros?.imagemPath).toBeTruthy();
  });

  it("não administrador não cria, não altera e não ativa (nada chega ao banco)", async () => {
    m.definirAdmin(false);
    const id = randomUUID();
    const a = await criarPatrocinador(contextoAtual, formulario(campos(id)));
    expect(a.erro).toBe("Esta ação é restrita a administradores.");
    const b = await alterarPatrocinador(contextoAtual, formulario(campos(id, { motivo: "x" })));
    expect(b.erro).toBe("Esta ação é restrita a administradores.");
    const c = await definirPatrocinadorAtivo(
      contextoAtual,
      formulario({ id, ativo: "sim", motivo: "x" }),
    );
    expect(c.erro).toBe("Esta ação é restrita a administradores.");
    expect(m.chamadas.rpcs).toHaveLength(0);
  });

  it("alterar exige motivo; com motivo grava e limpa o campo", async () => {
    m.definirAdmin(true);
    const p = m.novoPatrocinador({ titulo: "Antigo" });
    const sem = await alterarPatrocinador(contextoAtual, formulario(campos(p.id)));
    expect(sem.erros?.motivo).toBe("Informe o motivo.");
    const ok = await alterarPatrocinador(
      contextoAtual,
      formulario(campos(p.id, { titulo: "Novo título", motivo: "correção" })),
    );
    expect(ok.sucesso).toBe("Patrocinador atualizado.");
    expect(ok.valores?.motivo).toBe("");
    expect(m.patrocinadores[0]!.titulo).toBe("Novo título");
    const rpc = m.chamadas.rpcs.find((x) => x.nome === "administracao_alterar_patrocinador")!;
    expect(rpc.args).toMatchObject({ p_motivo: "correção" });
  });

  it("ativar e desativar exigem motivo", async () => {
    m.definirAdmin(true);
    const p = m.novoPatrocinador({ titulo: "X", ativo: true });
    const sem = await definirPatrocinadorAtivo(
      contextoAtual,
      formulario({ id: p.id, ativo: "nao", motivo: "" }),
    );
    expect(sem.erros?.motivo ?? sem.erro).toBeTruthy();
    expect(p.ativo).toBe(true);
    const off = await definirPatrocinadorAtivo(
      contextoAtual,
      formulario({ id: p.id, ativo: "nao", motivo: "fim da campanha" }),
    );
    expect(off.sucesso).toBe("Patrocinador desativado.");
    expect(p.ativo).toBe(false);
    const on = await definirPatrocinadorAtivo(
      contextoAtual,
      formulario({ id: p.id, ativo: "sim", motivo: "nova campanha" }),
    );
    expect(on.sucesso).toBe("Patrocinador ativado.");
    expect(p.ativo).toBe(true);
  });
});

describe("páginas de administração", () => {
  it("não administrador recebe 404 na lista e no detalhe", async () => {
    m.definirAdmin(false);
    const p = m.novoPatrocinador({ titulo: "Segredo de campanha" });
    await expect(PaginaPatrocinadores(args())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PaginaPatrocinador(args({ id: p.id }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("administrador vê a situação: inativo, agendado, no ar e encerrado", async () => {
    m.definirAdmin(true);
    m.novoPatrocinador({ titulo: "Em campanha" });
    m.novoPatrocinador({ titulo: "Pausado", ativo: false });
    m.novoPatrocinador({ titulo: "Futuro", inicio_em: "2026-12-01T00:00:00Z" });
    m.novoPatrocinador({ titulo: "Passado", fim_em: "2026-10-01T00:00:00Z" });
    // A página usa o relógio real; fixa o "agora" para a situação ser determinística.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T15:00:00Z"));
    try {
      render(await PaginaPatrocinadores(args()));
    } finally {
      vi.useRealTimers();
    }
    const cartao = (t: string) => screen.getByRole("link", { name: t }).closest("li")!;
    expect(within(cartao("Em campanha")).getByText("No ar")).toBeTruthy();
    expect(within(cartao("Pausado")).getByText("Inativo")).toBeTruthy();
    expect(within(cartao("Futuro")).getByText("Agendado")).toBeTruthy();
    expect(within(cartao("Passado")).getByText("Encerrado")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Novo patrocinador" })).toBeTruthy();
    // Sem preço, plano, cobrança nem URL externa.
    expect(
      document.querySelector("[name*=preco], [name*=plano], [name*=cobranca], [name*=url]"),
    ).toBeNull();
    expect(document.querySelector("a[href^=http]")).toBeNull();
  });

  it("detalhe: mostra o formulário com valores em horário de Brasília e o botão de desativar", async () => {
    m.definirAdmin(true);
    const p = m.novoPatrocinador({
      titulo: "Em campanha",
      inicio_em: "2026-11-05T17:30:00.000Z",
    });
    render(await PaginaPatrocinador(args({ id: p.id })));
    expect(screen.getByRole("heading", { level: 1, name: "Em campanha" })).toBeTruthy();
    expect((screen.getByLabelText(/^Início/) as HTMLInputElement).value).toBe("2026-11-05T14:30");
    expect(screen.getByRole("button", { name: "Desativar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeTruthy();
    await expect(PaginaPatrocinador(args({ id: randomUUID() }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("formulários de patrocinador", () => {
  const usuario = () => userEvent.setup({ applyAccept: false });

  it("novo: campos com rótulo, destino por perfil ou texto, datas e nenhum campo de preço ou URL", () => {
    const novoId = randomUUID();
    const { container } = render(
      <FormNovoPatrocinador
        novoId={novoId}
        perfis={[{ id: randomUUID(), nome: "Padaria da Ana" }]}
      />,
    );
    expect(screen.getByLabelText("Título")).toBeTruthy();
    expect(screen.getByLabelText(/^Perfil de destino/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Padaria da Ana" })).toBeTruthy();
    expect(screen.getByLabelText(/^Texto de destino/)).toBeTruthy();
    expect((screen.getByLabelText(/^Início/) as HTMLInputElement).type).toBe("datetime-local");
    expect(screen.getByLabelText("Colocar no ar ao criar")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="id"]')!.value).toBe(novoId);
    expect(container.querySelector('input[name="preco"], input[name="url"]')).toBeNull();
  });

  it("novo: mostra erros em português e só envia depois de válido", async () => {
    const u = usuario();
    render(<FormNovoPatrocinador novoId={randomUUID()} perfis={[]} />);
    await u.click(screen.getByRole("button", { name: "Criar patrocinador" }));
    expect(await screen.findByText(/O título deve ter de 2 a 60/)).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
  });

  it("alterar: motivo obrigatório aparece como erro do campo", async () => {
    const u = usuario();
    const id = randomUUID();
    render(
      <FormEditarPatrocinador
        id={id}
        inicial={{ titulo: "Padaria em destaque", textoDestino: "Pão quente", ordem: "1" }}
        imagem={[{ caminho: imagemDe(id), url: "https://storage.exemplo/x.webp" }]}
        perfis={[]}
      />,
    );
    await u.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Informe o motivo.")).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
    await u.type(screen.getByLabelText(/^Motivo/), "ajuste");
    await u.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(acaoLenta).toHaveBeenCalledTimes(1));
  });

  it("botão trava durante o envio e não duplica (IM-028)", async () => {
    const u = usuario();
    render(<FormAtivarPatrocinador id={randomUUID()} ativo />);
    await u.type(screen.getByLabelText(/^Motivo/), "fim da campanha");
    const botao = screen.getByRole("button", { name: "Desativar" });
    await u.click(botao);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Desativando..." })).toBeTruthy(),
    );
    expect(
      (screen.getByRole("button", { name: "Desativando..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await u.click(screen.getByRole("button", { name: "Desativando..." }));
    expect(acaoLenta).toHaveBeenCalledTimes(1);
  });
});
