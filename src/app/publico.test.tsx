// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMINHO_PUBLICO,
  SEGREDOS,
  criarMundoPublico,
  type MundoPublico,
} from "../../tests/suporte/bancos-publicos-memoria";
import type { ContextoPublico } from "./_lib/contexto-publico";

let contextoAtual: ContextoPublico;

vi.mock("./_lib/contexto-publico", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-publico")>()),
  obterContextoPublico: () => contextoAtual,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import PaginaItem, { generateMetadata as metadadosItem } from "./item/[id]/page";
import Home, { generateMetadata as metadadosHome } from "./page";
import PaginaPerfil, { generateMetadata as metadadosPerfil } from "./perfil/[slug]/page";
import NaoEncontrada from "./not-found";

let m: MundoPublico;
beforeEach(() => {
  m = criarMundoPublico();
  contextoAtual = m.contexto();
  vi.unstubAllEnvs();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const args = (params: Record<string, string> = {}, busca: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params), searchParams: Promise.resolve(busca) }) as never;

/** O HTML nunca pode conter dado privado (IM-029): nem em atributo, nem em texto, nem em metadados. */
function conferirSemDadosPrivados(html: string) {
  for (const segredo of Object.values(SEGREDOS)) expect(html).not.toContain(segredo);
  // O formulário de contato tem o rótulo "WhatsApp", mas nenhum número, wa.me, e-mail ou id do responsável.
  expect(html).not.toMatch(
    /wa\.me|\+55\d{8,}|\b\d{10,11}\b|responsavel_id|conta_id|owner|mailto:/i,
  );
  expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
}

/** IM-043 (D-013): listagens não têm "Curtir"; perfil e item só mostram o convite a entrar a quem não tem login. */
function conferirSemCurtir() {
  const curtir = /curtir|curtida|curti/i;
  expect(screen.queryAllByRole("button", { name: curtir })).toEqual([]);
  expect(screen.queryAllByRole("link", { name: curtir })).toEqual([]);
}

/** IM-013: a home e a busca não têm ações de contato nem de indicar (só perfil e item têm). */
function conferirSemAcoesNaListagem() {
  conferirSemCurtir();
  const acoes = /contato|indicar|indique/i;
  expect(screen.queryAllByRole("button", { name: acoes })).toEqual([]);
  expect(screen.queryAllByRole("link", { name: acoes })).toEqual([]);
}

/** IM-013: perfil e item têm "Quero entrar em contato" e "Indique ..."; visitante não tem botão de curtir. */
function conferirAcoesDaFase3(rotuloIndicar: string) {
  expect(screen.queryAllByRole("button", { name: /curtir|curtida|curti/i })).toEqual([]);
  for (const l of screen.queryAllByRole("link", { name: /curt/i })) {
    expect(l.textContent).toBe("Entrar para curtir");
  }
  expect(screen.getByRole("link", { name: "Quero entrar em contato" }).getAttribute("href")).toBe(
    "#contato",
  );
  expect(screen.getByRole("button", { name: rotuloIndicar })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enviar pedido de contato" })).toBeTruthy();
}

const cabecalho = () => document.body.innerHTML;

describe("página inicial pública (IM-019, IM-020)", () => {
  it("mostra título, busca, filtros, cards com imagem e descrição, e produtos e serviços", async () => {
    const perfil = m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    m.novoItem({
      nome: "Bolo de cenoura",
      tipo: "produto",
      perfil_id: perfil.id,
      descricao: "Bolo caseiro.",
    });
    m.novoItem({ nome: "Entrega rápida", tipo: "servico", perfil_id: perfil.id });
    m.novoItem({ nome: "Bicicleta aro 29", tipo: "produto", cidade: "Canoas", uf: "RS" });
    render(await Home(args()));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Encontre/);
    // Busca e filtros com rótulo.
    expect(screen.getByLabelText("Buscar pelo nome")).toBeTruthy();
    expect(screen.getByLabelText("Tipo")).toBeTruthy();
    expect(screen.getByLabelText("Categoria")).toBeTruthy();
    expect(screen.getByLabelText("UF")).toBeTruthy();
    expect(screen.getByLabelText("Cidade")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeTruthy();
    expect((screen.getByLabelText("UF") as HTMLSelectElement).options.length).toBe(28);
    expect(within(screen.getByLabelText("Categoria")).getByText("Alimentação")).toBeTruthy();

    // Cards com imagem assinada no servidor, descrição, preço em R$ e local.
    const link = screen.getByRole("link", { name: "Padaria da Ana" });
    expect(link.getAttribute("href")).toBe("/perfil/padaria-da-ana");
    expect(screen.getByRole("link", { name: "Bolo de cenoura" })).toBeTruthy();
    expect(screen.getAllByText(/R\$\s125,50/).length).toBeGreaterThan(0);
    expect(screen.getByText("Bolo caseiro.")).toBeTruthy();
    // O logotipo (arquivo estático em /marca/) não é imagem do conteúdo e fica fora da conferência.
    const imagens = Array.from(document.querySelectorAll("img:not([src^='/marca/'])")).map((i) =>
      i.getAttribute("src"),
    );
    expect(imagens.length).toBeGreaterThan(2);
    expect(imagens.every((s) => s?.startsWith(CAMINHO_PUBLICO))).toBe(true);
    expect(screen.getByRole("heading", { name: "Produtos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Serviços" })).toBeTruthy();
    expect(screen.getByText("Anúncio particular")).toBeTruthy();
    expect(screen.getAllByText(/Canoas - RS/).length).toBeGreaterThan(0);

    conferirSemDadosPrivados(cabecalho());
    conferirSemAcoesNaListagem();
  });

  it("vazio: mensagens amigáveis, sem quebrar", async () => {
    render(await Home(args()));
    expect(screen.getByText("Ainda não há empresas ou profissionais publicados.")).toBeTruthy();
    expect(screen.getByText("Ainda não há produtos publicados.")).toBeTruthy();
    expect(screen.queryByText("Patrocinado")).toBeNull();
  });

  it("carrossel: cada patrocinador mostra o rótulo Patrocinado; destino perfil ou texto, sem link externo e sem preço", async () => {
    const perfil = m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    m.novoPatrocinador({ titulo: "Padaria em destaque", perfil_destino_id: perfil.id, ordem: 1 });
    m.novoPatrocinador({ titulo: "Feira de sábado", texto_destino: "Venha conhecer", ordem: 2 });
    m.novoPatrocinador({ titulo: "Inativo", ativo: false });
    m.novoPatrocinador({ titulo: "Encerrado", fim_em: "2026-10-01T00:00:00Z" });
    m.novoPatrocinador({ titulo: "Agendado", inicio_em: "2026-12-01T00:00:00Z" });
    render(await Home(args()));

    const regiao = screen.getByRole("region", { name: "Patrocinados" });
    const selos = within(regiao).getAllByText("Patrocinado");
    expect(selos).toHaveLength(2);
    expect(within(regiao).getByText("Padaria em destaque")).toBeTruthy();
    expect(within(regiao).getByText("Feira de sábado")).toBeTruthy();
    expect(within(regiao).getByText("Venha conhecer")).toBeTruthy();
    expect(within(regiao).queryByText("Inativo")).toBeNull();
    expect(within(regiao).queryByText("Encerrado")).toBeNull();
    expect(within(regiao).queryByText("Agendado")).toBeNull();
    const links = within(regiao).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/perfil/padaria-da-ana"]);
    expect(regiao.textContent).not.toMatch(/R\$|http|www\./);
    conferirSemDadosPrivados(cabecalho());
  });

  it("perfil de destino despublicado some do carrossel", async () => {
    const perfil = m.novoPerfil({ nome: "Fora do ar", slug: "fora-do-ar", publicado: false });
    m.novoPatrocinador({ titulo: "Não deve aparecer", perfil_destino_id: perfil.id });
    render(await Home(args()));
    expect(screen.queryByText("Não deve aparecer")).toBeNull();
    expect(screen.queryByText("Patrocinado")).toBeNull();
  });

  it("não mostra o que não está aprovado e publicado", async () => {
    m.novoPerfil({ nome: "Rascunho", slug: "rascunho", aprovado: false, publicado: false });
    m.novoPerfil({ nome: "Despublicado", slug: "despublicado", publicado: false });
    const ok = m.novoPerfil({ nome: "Perfil no ar", slug: "no-ar" });
    m.novoItem({ nome: "Item de perfil fora", tipo: "produto", perfil_id: m.perfis[1]!.id });
    m.novoItem({ nome: "Item pendente", tipo: "produto", aprovado: false });
    m.novoItem({ nome: "Item despublicado", tipo: "produto", publicado: false });
    m.novoItem({ nome: "Item no ar", tipo: "produto", perfil_id: ok.id });
    render(await Home(args()));
    expect(screen.getByText("Perfil no ar")).toBeTruthy();
    expect(screen.getByText("Item no ar")).toBeTruthy();
    for (const nome of [
      "Rascunho",
      "Despublicado",
      "Item de perfil fora",
      "Item pendente",
      "Item despublicado",
    ]) {
      expect(screen.queryByText(nome)).toBeNull();
    }
  });

  it("busca por nome com filtros: resultados, contagem e paginação mantendo os filtros", async () => {
    for (let n = 1; n <= 14; n++) {
      m.novoItem({
        nome: `Bicicleta ${String(n).padStart(2, "0")}`,
        tipo: "produto",
        uf: "RS",
        cidade: "Canoas",
      });
    }
    m.novoItem({ nome: "Violão", tipo: "produto", uf: "SP", cidade: "Santos" });
    render(await Home(args({}, { termo: "bicicleta", uf: "RS", cidade: "canoas" })));

    expect(screen.getByRole("heading", { name: "Resultados" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("14 resultados.");
    expect(screen.queryByText("Violão")).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(12);
    const prox = screen.getByRole("link", { name: "Próxima" });
    expect(prox.getAttribute("href")).toBe("/?termo=bicicleta&uf=RS&cidade=canoas&pagina=2");
    // Os valores voltam para o formulário.
    expect((screen.getByLabelText("Buscar pelo nome") as HTMLInputElement).value).toBe("bicicleta");
    expect((screen.getByLabelText("UF") as HTMLSelectElement).value).toBe("RS");

    cleanup();
    render(await Home(args({}, { termo: "bicicleta", uf: "RS", cidade: "canoas", pagina: "2" })));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Anterior" }).getAttribute("href")).toBe(
      "/?termo=bicicleta&uf=RS&cidade=canoas",
    );
    expect(screen.queryByText("Patrocinado")).toBeNull();
  });

  it("filtro por categoria e tipo; sem resultado mostra aviso e link para limpar", async () => {
    const tec = m.categorias[1]!;
    m.novoItem({ nome: "Notebook", tipo: "produto", categoria_principal_id: tec.id });
    m.novoItem({ nome: "Bolo", tipo: "produto" });
    m.novoPerfil({ nome: "Loja de bolos", slug: "loja-de-bolos" });
    render(await Home(args({}, { categoriaId: tec.id, tipo: "produto" })));
    expect(screen.getByText("Notebook")).toBeTruthy();
    expect(screen.queryByText("Bolo")).toBeNull();
    cleanup();
    render(await Home(args({}, { termo: "zzzzzz" })));
    expect(screen.getByText("Nenhum resultado.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Limpar filtros" }).getAttribute("href")).toBe("/");
  });

  it("filtro inválido mostra mensagem em português e não quebra a página", async () => {
    render(await Home(args({}, { uf: "XX" })));
    expect(screen.getByRole("alert").textContent).toBe("Escolha uma UF válida.");
    expect(m.chamadas.rpcs.filter((r) => r.nome === "busca_publica")).toHaveLength(0);
  });

  it("noindex por padrão; só PUBLICO_INDEXAVEL=sim libera; busca filtrada nunca é indexada", async () => {
    expect((await metadadosHome(args())).robots).toEqual({ index: false, follow: false });
    vi.stubEnv("PUBLICO_INDEXAVEL", "true");
    expect((await metadadosHome(args())).robots).toEqual({ index: false, follow: false });
    vi.stubEnv("PUBLICO_INDEXAVEL", "sim");
    expect((await metadadosHome(args())).robots).toEqual({ index: true, follow: true });
    expect((await metadadosHome(args({}, { termo: "x" }))).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});

describe("perfil público (IM-011, IM-012, IM-014, IM-079)", () => {
  function perfilCompleto() {
    const p = m.novoPerfil({
      nome: "Padaria da Ana",
      slug: "padaria-da-ana",
      descricao_breve: "Pães e bolos feitos todo dia.",
      endereco: "Rua das Flores, 100",
      areas_atendidas: ["Centro", "Moinhos"],
      site: "padariadaana.com.br",
      informacoes_sociais: "Instagram da padaria: arroba padariadaana",
    });
    p.fotos_paths = [`perfil/${p.id}/${randomUUID()}.webp`];
    p.banners_paths = [`perfil/${p.id}/${randomUUID()}.webp`];
    m.novoItem({ nome: "Bolo de cenoura", tipo: "produto", perfil_id: p.id });
    return p;
  }

  it("mostra nome, descrição, categoria, cidade/UF, dados opcionais, fotos e os itens do perfil", async () => {
    perfilCompleto();
    render(await PaginaPerfil(args({ slug: "padaria-da-ana" })));
    expect(screen.getByRole("heading", { level: 1, name: "Padaria da Ana" })).toBeTruthy();
    expect(screen.getByText("Pães e bolos feitos todo dia.")).toBeTruthy();
    expect(screen.getAllByText("Alimentação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Porto Alegre - RS").length).toBeGreaterThan(0);
    expect(screen.getByText("Rua das Flores, 100")).toBeTruthy();
    expect(screen.getByText("Centro, Moinhos")).toBeTruthy();
    expect(screen.getByText("padariadaana.com.br")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Produtos e serviços" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bolo de cenoura" }).getAttribute("href")).toMatch(
      /^\/item\/[0-9a-f-]{36}$/,
    );
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(3);
    // Sem link externo (IM-012): site e redes são só texto.
    expect(
      Array.from(document.querySelectorAll("a")).every((a) =>
        /^[/#]/.test(a.getAttribute("href")!),
      ),
    ).toBe(true);
    conferirSemDadosPrivados(cabecalho());
    conferirAcoesDaFase3("Indique esta empresa");
  });

  it("404 genérico para inexistente, rascunho, não aprovado, despublicado e slug inválido", async () => {
    m.novoPerfil({ nome: "Rascunho", slug: "rascunho", aprovado: false, publicado: false });
    m.novoPerfil({ nome: "Pendente", slug: "pendente", aprovado: false });
    m.novoPerfil({ nome: "Despublicado", slug: "despublicado", publicado: false });
    for (const slug of ["rascunho", "pendente", "despublicado", "nao-existe", "A/../b", "%00"]) {
      await expect(PaginaPerfil(args({ slug }))).rejects.toThrow("NEXT_NOT_FOUND");
      const meta = await metadadosPerfil(args({ slug }));
      expect(meta.title).toBe("Página não encontrada | IndicaMais");
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(JSON.stringify(meta)).not.toMatch(/Rascunho|Pendente|Despublicado/);
    }
  });

  it("o 404 é o mesmo texto genérico em português", () => {
    render(<NaoEncontrada />);
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toBeTruthy();
  });

  it("metadados: título, descrição, Open Graph e Twitter com imagem absoluta; noindex por padrão", async () => {
    const p = perfilCompleto();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://indicamais.exemplo/");
    const meta = await metadadosPerfil(args({ slug: "padaria-da-ana" }));
    expect(meta.title).toBe("Padaria da Ana | IndicaMais");
    expect(meta.description).toBe("Pães e bolos feitos todo dia.");
    expect(meta.robots).toEqual({ index: false, follow: false });
    const og = meta.openGraph as Record<string, unknown> & { images: { url: string }[] };
    expect(og.title).toBe("Padaria da Ana | IndicaMais");
    expect(og.description).toBe("Pães e bolos feitos todo dia.");
    expect(og.locale).toBe("pt_BR");
    expect(og.url).toBe("https://indicamais.exemplo/perfil/padaria-da-ana");
    expect(meta.alternates?.canonical).toBe("https://indicamais.exemplo/perfil/padaria-da-ana");
    expect(p.imagem_path).toBeTruthy();
    expect(og.images[0]!.url).toBe("https://indicamais.exemplo/og/perfil/padaria-da-ana");
    expect(JSON.stringify(meta)).not.toContain("token=");
    const tw = meta.twitter as { card: string; images: string[] };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.images[0]).toBe(og.images[0]!.url);
    conferirSemDadosPrivados(JSON.stringify(meta));
  });

  it("sem NEXT_PUBLIC_APP_URL (ou inválida) não inventa URL: fallback seguro, só a imagem assinada", async () => {
    perfilCompleto();
    for (const valor of ["", "isto nao e url", "ftp://x.com"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", valor);
      const meta = await metadadosPerfil(args({ slug: "padaria-da-ana" }));
      expect((meta.openGraph as { url?: string }).url).toBeUndefined();
      expect(meta.alternates).toBeUndefined();
      expect((meta.openGraph as { images?: unknown }).images).toBeUndefined();
      expect(meta.title).toBe("Padaria da Ana | IndicaMais");
    }
  });

  it("perfil sem imagem usa o cartão pequeno (sem imagem na prévia) e descrição de reserva", async () => {
    m.novoPerfil({ nome: "Sem foto", slug: "sem-foto", imagem_path: null, descricao_breve: null });
    const meta = await metadadosPerfil(args({ slug: "sem-foto" }));
    expect((meta.openGraph as { images?: unknown }).images).toBeUndefined();
    expect((meta.twitter as { card: string }).card).toBe("summary");
    expect(meta.description).toBe("Sem foto em Porto Alegre - RS. Veja no IndicaMais.");
  });

  it("a descrição da prévia é cortada em 160 caracteres e sem quebras de linha", async () => {
    m.novoPerfil({
      nome: "Longo",
      slug: "longo",
      descricao_breve: `${"palavra ".repeat(60)}\n\nfim`,
    });
    const meta = await metadadosPerfil(args({ slug: "longo" }));
    expect(meta.description!.length).toBeLessThanOrEqual(160);
    expect(meta.description).toMatch(/…$/);
    expect(meta.description).not.toContain("\n");
  });
});

describe("item e anúncio particular públicos (IM-014, IM-015, IM-079)", () => {
  it("anúncio particular: foto, preço em R$, categoria, cidade/UF e descrição; sem dono", async () => {
    const i = m.novoItem({
      nome: "Bicicleta aro 29",
      tipo: "produto",
      cidade: "Canoas",
      uf: "RS",
      descricao: "Pouco usada.\nTroco por notebook.",
      preco_centavos: 125050,
    });
    render(await PaginaItem(args({ id: i.id })));
    expect(screen.getByRole("heading", { level: 1, name: "Bicicleta aro 29" })).toBeTruthy();
    expect(screen.getByText("R$ 1.250,50")).toBeTruthy();
    expect(screen.getByText("Anúncio particular")).toBeTruthy();
    expect(screen.getByText("Canoas - RS")).toBeTruthy();
    expect(screen.getByText("Alimentação")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto de Bicicleta aro 29" })).toBeTruthy();
    expect(screen.queryByText(/Oferecido por/)).toBeNull();
    conferirSemDadosPrivados(cabecalho());
    conferirAcoesDaFase3("Indique este anúncio");
  });

  it("item de perfil: tipo, localização do perfil e link para o perfil; sob consulta e a partir de", async () => {
    const p = m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    const a = m.novoItem({
      nome: "Consultoria",
      tipo: "servico",
      perfil_id: p.id,
      preco_modo: "sob_consulta",
      preco_centavos: null,
    });
    render(await PaginaItem(args({ id: a.id })));
    expect(screen.getByText("Serviço")).toBeTruthy();
    expect(screen.getByText("Sob consulta")).toBeTruthy();
    expect(screen.getByText("Porto Alegre - RS")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Padaria da Ana" }).getAttribute("href")).toBe(
      "/perfil/padaria-da-ana",
    );
    cleanup();
    const b = m.novoItem({
      nome: "Bolo",
      tipo: "produto",
      perfil_id: p.id,
      preco_modo: "a_partir_de",
      preco_centavos: 3000,
    });
    render(await PaginaItem(args({ id: b.id })));
    expect(screen.getByText(/A partir de R\$\s30,00/)).toBeTruthy();
  });

  it("404 genérico: inexistente, id inválido, não aprovado, despublicado e item de perfil indisponível", async () => {
    const fora = m.novoPerfil({ nome: "Fora", slug: "fora", publicado: false });
    const casos = [
      m.novoItem({ nome: "Pendente", tipo: "produto", aprovado: false }).id,
      m.novoItem({ nome: "Despublicado", tipo: "produto", publicado: false }).id,
      m.novoItem({ nome: "Do perfil fora", tipo: "produto", perfil_id: fora.id }).id,
      randomUUID(),
      "nao-e-uuid",
      "1; drop table",
    ];
    for (const id of casos) {
      await expect(PaginaItem(args({ id }))).rejects.toThrow("NEXT_NOT_FOUND");
      const meta = await metadadosItem(args({ id }));
      expect(meta.title).toBe("Página não encontrada | IndicaMais");
    }
  });

  it("anúncio particular segue público mesmo sem perfil comercial", async () => {
    const i = m.novoItem({ nome: "Sofá", tipo: "produto", cidade: "Canoas", uf: "RS" });
    const meta = await metadadosItem(args({ id: i.id }));
    expect(meta.title).toBe("Sofá | IndicaMais");
  });

  it("metadados do item: título, descrição, imagem absoluta, preço e local na reserva; sem dados privados", async () => {
    const i = m.novoItem({
      nome: "Bicicleta",
      tipo: "produto",
      cidade: "Canoas",
      uf: "RS",
      descricao: "Pouco usada.",
    });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://indicamais.exemplo");
    const meta = await metadadosItem(args({ id: i.id }));
    expect(meta.description).toBe("Pouco usada.");
    const og = meta.openGraph as { url: string; images: { url: string }[]; title: string };
    expect(og.url).toBe(`https://indicamais.exemplo/item/${i.id}`);
    expect(og.images[0]!.url).toBe(`https://indicamais.exemplo/og/item/${i.id}`);
    expect(meta.robots).toEqual({ index: false, follow: false });
    conferirSemDadosPrivados(JSON.stringify(meta));

    const sem = m.novoItem({
      nome: "Violão",
      tipo: "produto",
      descricao: "",
      cidade: "Santos",
      uf: "SP",
    });
    const reserva = await metadadosItem(args({ id: sem.id }));
    expect(reserva.description).toBe("Violão. R$ 125,50 · Santos - SP.");
  });
});

describe("ações da página e ?ind (IM-013, IM-024, IM-025)", () => {
  const COD = "a1".repeat(16);
  const campo = (nome: string) =>
    document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${nome}"]`);

  it("perfil: ?ind vai só ao formulário de contato do perfil e nunca a links, cookies ou armazenamento", async () => {
    m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    render(await PaginaPerfil(args({ slug: "padaria-da-ana" }, { ind: COD })));
    expect(campo("ind")?.value).toBe(COD);
    expect(campo("slug")?.value).toBe("padaria-da-ana");
    // Nenhum link da página leva o código a outro destino (IM-025).
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h?.includes(COD))).toBe(false);
    expect(document.cookie).toBe("");
    expect(localStorage.length + sessionStorage.length).toBe(0);
    conferirAcoesDaFase3("Indique esta empresa");
    conferirSemDadosPrivados(cabecalho());
  });

  it("item: ?ind malformado é ignorado; sem ?ind não há campo; botão 'Indique este produto/serviço'", async () => {
    const item = m.novoItem({ nome: "Bolo de cenoura", tipo: "produto" });
    const a = render(await PaginaItem(args({ id: item.id }, { ind: "<script>x</script>" })));
    expect(campo("ind")).toBeNull();
    expect(campo("id")?.value).toBe(item.id);
    conferirAcoesDaFase3("Indique este anúncio");
    a.unmount();
    const perfil = m.novoPerfil({ nome: "Loja", slug: "loja" });
    const comPerfil = m.novoItem({ nome: "Serviço X", tipo: "servico", perfil_id: perfil.id });
    render(await PaginaItem(args({ id: comPerfil.id }, { ind: COD })));
    expect(campo("ind")?.value).toBe(COD);
    expect(screen.getByRole("button", { name: "Indique este produto/serviço" })).toBeTruthy();
  });

  it("a chave de idempotência muda a cada página renderizada e tem o formato aceito pelo módulo", async () => {
    m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    const a = render(await PaginaPerfil(args({ slug: "padaria-da-ana" })));
    const k1 = campo("chave")!.value;
    a.unmount();
    render(await PaginaPerfil(args({ slug: "padaria-da-ana" })));
    const k2 = campo("chave")!.value;
    expect(k1).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
    expect(k2).not.toBe(k1);
  });

  it("metadados da prévia continuam: título, descrição, noindex e imagem", async () => {
    m.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.exemplo");
    const meta = await metadadosPerfil(args({ slug: "padaria-da-ana" }, { ind: COD }));
    expect(String(meta.title)).toContain("Padaria da Ana");
    expect(meta.robots).toMatchObject({ index: false });
    expect(JSON.stringify(meta)).toContain("/og/perfil/padaria-da-ana");
    // O código de indicação não entra no endereço canônico nem na prévia.
    expect(JSON.stringify(meta)).not.toContain(COD);
  });
});
