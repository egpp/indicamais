/**
 * Fase 10 · Loja (IM-097, IM-098, IM-099, D-020) no DEV, em desktop e celular (Pixel 7), em série.
 * Fluxo: administrador libera a Loja do perfil do dono (motivo obrigatório); sem a Loja o dono não vê campos de imóvel;
 * com a Loja o dono cria o rascunho de um imóvel, envia fotos, manda para aprovação; o administrador aprova; o dono
 * publica; a página pública mostra a Loja (chips, bairro/cidade, filtros, galeria) sem dado privado. Ao final o dono
 * despublica o imóvel e a Loja volta ao estado inicial (retirada se não estava liberada). O rascunho/versão criado
 * permanece no DEV (não há exclusão pela interface); o nome começa com "E2E Loja".
 * Contas E2E_* do .env.local; nada de service_role; rodar com --workers=1.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { credenciais, exigirConta } from "./contas";
import { gerarPng } from "./png";
import { limparItensDeTestePorNome } from "../suporte/limpar-imagens-item";

const SLUG = "perfil-1";
const SUFIXO = Date.now().toString(36);

type Sessoes = { dono?: Page; admin?: Page; anon?: Page; ctxs: BrowserContext[] };
const s: Sessoes = { ctxs: [] };
const estado = {
  perfilId: "",
  perfilNome: "",
  itemId: "",
  itemNome: "",
  lojaInicial: false,
  publicou: false,
};

async function abrir(
  browser: Browser,
  opcoes: Record<string, unknown>,
  papel?: "dono" | "admin",
): Promise<Page> {
  const ctx = await browser.newContext(opcoes);
  s.ctxs.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(120_000);
  if (papel) await entrarComEspera(page, papel);
  return page;
}

/** Como `entrar` de contas.ts, mas com espera maior: o servidor de desenvolvimento compila as rotas no primeiro acesso. */
async function entrarComEspera(page: Page, papel: "dono" | "admin") {
  const { email, senha } = credenciais(papel);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/^(?!.*\/entrar)/, { timeout: 90_000 });
}

function cartaoDoPerfil(admin: Page) {
  return admin.locator('li[data-testid="perfil-loja"]', { hasText: estado.perfilNome }).first();
}

async function abrirAdminLoja(admin: Page) {
  await admin.goto(`/administracao/loja?busca=${encodeURIComponent(estado.perfilNome)}`);
  await expect(cartaoDoPerfil(admin)).toBeVisible({ timeout: 60_000 });
}

async function definirLoja(admin: Page, liberar: boolean) {
  await abrirAdminLoja(admin);
  const cartao = cartaoDoPerfil(admin);
  const jaLiberada = (await cartao.getByText("Loja liberada", { exact: true }).count()) > 0;
  if (jaLiberada === liberar) return;
  await cartao
    .getByLabel(/Motivo para/)
    .fill(`E2E Fase 10: ${liberar ? "liberar" : "retirar"} a Loja para teste`);
  await cartao.getByRole("button", { name: liberar ? "Liberar a Loja" : "Retirar a Loja" }).click();
  await expect(
    cartao.getByText(liberar ? "Loja liberada para o perfil." : "Loja retirada do perfil."),
  ).toBeVisible({ timeout: 60_000 });
}

async function enviarFotos(
  page: Page,
  grupo: string,
  quantas: number,
  cor: [number, number, number],
) {
  const campo = page.getByRole("group", { name: grupo, exact: true });
  const arquivos = Array.from({ length: quantas }, (_, i) => ({
    name: `e2e-${i}.png`,
    mimeType: "image/png",
    buffer: gerarPng(320 + i * 10, 240, cor),
  }));
  await campo.locator('input[type="file"]').setInputFiles(arquivos);
  await expect(campo.locator("ul.lista-imagens li")).toHaveCount(quantas, { timeout: 90_000 });
}

test.describe.configure({ mode: "serial" });
test.describe("Fase 10 · Loja (DEV)", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async ({ browser }, info) => {
    test.setTimeout(240_000);
    if (!process.env.E2E_DONO_EMAIL || !process.env.E2E_ADMIN_EMAIL) return;
    const opcoes = { ...info.project.use } as Record<string, unknown>;
    s.dono = await abrir(browser, opcoes, "dono");
    s.admin = await abrir(browser, opcoes, "admin");
    s.anon = await abrir(browser, opcoes);
    estado.itemNome = `E2E Loja imóvel ${info.project.name} ${SUFIXO}`;
  });

  test.afterAll(async () => {
    test.setTimeout(240_000);
    // Restaura o estado do DEV: despublica o imóvel e devolve a Loja ao estado inicial.
    try {
      if (s.dono && estado.itemId && estado.publicou) {
        await s.dono.goto(`/meus-itens/${estado.itemId}`);
        const botao = s.dono.getByRole("button", { name: "Despublicar" });
        if (await botao.isVisible()) {
          await botao.click();
          await expect(s.dono.getByRole("button", { name: "Publicar", exact: true })).toBeVisible();
        }
      }
      if (estado.itemNome) await limparItensDeTestePorNome(estado.itemNome);
      if (s.admin && estado.perfilNome) await definirLoja(s.admin, estado.lojaInicial);
    } finally {
      for (const c of s.ctxs) await c.close();
      s.ctxs.length = 0;
    }
  });

  test.beforeEach(() => {
    exigirConta("dono");
    exigirConta("admin");
  });

  test("0. visitante vai a /entrar e quem não é administrador recebe 404 em /administracao/loja", async () => {
    await s.anon!.goto("/administracao/loja");
    await expect(s.anon!).toHaveURL(/\/entrar/);
    const r = await s.dono!.goto("/administracao/loja");
    expect(r?.status()).toBe(404);
    await expect(s.dono!.getByRole("heading", { name: "Loja (administração)" })).toHaveCount(0);
  });

  test("1. identifica o perfil do dono, anota o estado inicial da Loja e a retira para o teste", async () => {
    const dono = s.dono!;
    await dono.goto("/meus-perfis");
    const hrefs = await dono
      .locator('a[href^="/meus-perfis/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    estado.perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    expect(estado.perfilId).toBeTruthy();
    await s.anon!.goto(`/perfil/${SLUG}`);
    estado.perfilNome = (await s.anon!.locator("#titulo-perfil").innerText()).trim();
    expect(estado.perfilNome).not.toBe("");

    await abrirAdminLoja(s.admin!);
    estado.lojaInicial =
      (await cartaoDoPerfil(s.admin!).getByText("Loja liberada", { exact: true }).count()) > 0;
    await definirLoja(s.admin!, false);
  });

  test("2. sem a Loja, o dono não vê o tipo Imóvel nem campos de imóvel", async () => {
    const dono = s.dono!;
    await dono.goto(`/meus-itens/novo?perfil=${estado.perfilId}`);
    await expect(dono.getByText("Loja não liberada para este perfil.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(dono.getByRole("option", { name: "Imóvel" })).toHaveCount(0);
    await expect(dono.getByLabel("Tipo do imóvel")).toHaveCount(0);
    await expect(dono.getByLabel("Quartos")).toHaveCount(0);
    await expect(dono.getByText(/plano|assinatura|R\$ \d+[.,]\d{2} ?\/ ?mês/i)).toHaveCount(0);
    await dono.screenshot({ path: "test-results/fase10/sem-loja.png" });
  });

  test("3. administrador exige o motivo e libera a Loja do perfil", async () => {
    const admin = s.admin!;
    await abrirAdminLoja(admin);
    const cartao = cartaoDoPerfil(admin);
    await cartao.getByRole("button", { name: "Liberar a Loja" }).click();
    await expect(cartao.getByText("Informe o motivo.")).toBeVisible();
    await definirLoja(admin, true);
    await abrirAdminLoja(admin);
    await expect(cartaoDoPerfil(admin).getByText("Loja liberada", { exact: true })).toBeVisible();
    await expect(
      cartaoDoPerfil(admin).getByRole("button", { name: "Retirar a Loja" }),
    ).toBeVisible();
    // O filtro "só com a Loja liberada" lista o perfil.
    await admin.goto(
      `/administracao/loja?loja=liberadas&busca=${encodeURIComponent(estado.perfilNome)}`,
    );
    await expect(cartaoDoPerfil(admin)).toBeVisible();
    await admin.screenshot({ path: "test-results/fase10/admin-loja.png" });
  });

  test("4. com a Loja, o dono cria o rascunho de um imóvel e envia as fotos", async () => {
    const dono = s.dono!;
    await dono.goto(`/meus-itens/novo?perfil=${estado.perfilId}`);
    await expect(dono.getByLabel("Tipo", { exact: true })).toBeVisible({ timeout: 60_000 });
    await dono.getByLabel("Tipo", { exact: true }).selectOption("imovel");
    await dono.getByLabel("Nome", { exact: true }).fill(estado.itemNome);
    await dono
      .getByLabel("Descrição", { exact: true })
      .fill("Apartamento de teste da Fase 10, perto da praça.");
    await dono.getByLabel("Categoria principal").selectOption({ index: 1 });
    await dono.getByLabel("Preço", { exact: true }).selectOption("fixo");
    await dono.getByLabel(/Valor \(R\$\)/).fill("2.500,00");
    await dono.getByLabel("Tipo do imóvel").selectOption("apartamento");
    await dono.getByLabel("Finalidade").selectOption("aluguel");
    await dono.getByLabel("Área (m²)").fill("85,5");
    await dono.getByLabel("Quartos").fill("3");
    await dono.getByLabel("Banheiros").fill("2");
    await dono.getByLabel("Vagas").fill("1");
    await dono.getByLabel("Bairro").fill("Centro");
    await dono.getByLabel("Cidade", { exact: true }).fill("Marília");
    await dono.getByLabel("UF", { exact: true }).selectOption("SP");
    await dono.getByLabel(/Condomínio/).fill("0");
    await dono.getByLabel(/IPTU/).fill("120,00");
    await dono.getByLabel(/Aceita financiamento/).selectOption("false");
    await dono.screenshot({ path: "test-results/fase10/novo-imovel.png", fullPage: true });
    await dono.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(dono).toHaveURL(/\/meus-itens\/[0-9a-f-]{36}\?aviso=criado/, { timeout: 90_000 });
    estado.itemId = new URL(dono.url()).pathname.split("/")[2]!;

    // Os valores voltam preenchidos; "0" ficou como R$ 0,00 (0 centavos).
    await expect(dono.getByLabel("Bairro")).toHaveValue("Centro");
    await expect(dono.getByLabel(/Condomínio/)).toHaveValue("0,00");
    await expect(dono.getByLabel("Área (m²)")).toHaveValue("85,5");

    await enviarFotos(dono, "Foto", 1, [40, 130, 90]);
    await dono.getByRole("button", { name: "Salvar foto", exact: true }).click();
    await expect(dono.getByText(/Foto salva|Edição salva como rascunho/)).toBeVisible();
    await enviarFotos(dono, "Fotos adicionais", 2, [200, 120, 40]);
    await dono.getByRole("button", { name: "Salvar fotos adicionais" }).click();
    await expect(
      dono.getByText(/Fotos adicionais salvas|Edição salva como rascunho/),
    ).toBeVisible();
    await dono.screenshot({ path: "test-results/fase10/rascunho-imovel.png", fullPage: true });
  });

  test("5. prévia do imóvel, envio, aprovação pelo administrador e publicação", async () => {
    const dono = s.dono!;
    const admin = s.admin!;
    await dono.goto(`/meus-itens/${estado.itemId}/previa`);
    await expect(dono.getByText("Centro, Marília/SP")).toBeVisible({ timeout: 60_000 });
    await expect(dono.getByLabel("Mais fotos de " + estado.itemNome)).toBeVisible();
    await expect(dono.getByText(/2.500,00 por mês/)).toBeVisible();
    await dono.getByRole("button", { name: "Enviar para aprovação" }).click();
    await expect(dono.getByText(/Enviado para aprovação|já foi enviada/).first()).toBeVisible();

    await admin.goto("/administracao/revisao");
    await admin
      .locator("li.cartao", { hasText: estado.itemNome })
      .first()
      .getByRole("link")
      .click();
    await expect(admin).toHaveURL(/\/administracao\/revisao\/item\/[0-9a-f-]{36}$/, {
      timeout: 60_000,
    });
    await admin.getByRole("button", { name: "Aprovar" }).click();
    await expect(admin).toHaveURL(/\/administracao\/revisao/, { timeout: 60_000 });
    await expect(admin.getByText("Aprovado.")).toBeVisible();

    await dono.goto(`/meus-itens/${estado.itemId}`);
    const publicar = dono.getByRole("button", { name: "Publicar", exact: true });
    if (await publicar.isVisible()) await publicar.click();
    // Publicado: o botão passa a ser Despublicar (a mensagem some com a atualização da tela).
    await expect(dono.getByRole("button", { name: "Despublicar" })).toBeVisible({
      timeout: 60_000,
    });
    estado.publicou = true;
  });

  test("6. página pública: seção Loja, filtros, detalhe com galeria e sem dado privado", async () => {
    const anon = s.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    const secao = anon.locator("#produtos");
    await expect(secao.getByRole("heading", { level: 2, name: "Loja" })).toBeVisible({
      timeout: 60_000,
    });
    const cartao = secao.locator("article", { hasText: estado.itemNome });
    await expect(cartao).toBeVisible();
    await expect(cartao.getByText(/2.500,00 por mês/)).toBeVisible();
    await expect(cartao.getByText("3 quartos")).toBeVisible();
    await expect(cartao.getByText("2 banheiros")).toBeVisible();
    await expect(cartao.getByText("1 vaga", { exact: true })).toBeVisible();
    await expect(cartao.getByText("85,5 m²")).toBeVisible();
    await expect(cartao.getByText("Centro, Marília/SP")).toBeVisible();
    await anon.screenshot({ path: "test-results/fase10/pagina-publica-loja.png", fullPage: true });

    // Filtros: venda esconde o aluguel; aluguel e 3+ quartos mostram.
    await anon.goto(`/perfil/${SLUG}?finalidade=venda`);
    await expect(anon.getByText("Nenhum imóvel encontrado com esses filtros.")).toBeVisible();
    await anon.goto(`/perfil/${SLUG}?finalidade=aluguel&quartos=3&precoMax=3.000,00`);
    await expect(anon.locator("#produtos article", { hasText: estado.itemNome })).toBeVisible();
    await anon.goto(`/perfil/${SLUG}?precoMax=abc`);
    await expect(anon.getByText(/Informe o preço máximo em reais/)).toBeVisible();
    await anon.goto(`/perfil/${SLUG}`);

    // Detalhe do imóvel.
    await anon.locator("#produtos").getByRole("link", { name: estado.itemNome }).click();
    await expect(anon).toHaveURL(new RegExp(`/item/${estado.itemId}$`), { timeout: 60_000 });
    await expect(anon.getByRole("heading", { level: 1, name: estado.itemNome })).toBeVisible();
    const dados = anon.getByLabel("Dados do imóvel");
    await expect(dados.getByText("Centro, Marília/SP")).toBeVisible();
    await expect(dados.getByText("Não aceita financiamento")).toBeVisible();
    await expect(anon.getByLabel("Mais fotos de " + estado.itemNome).getByRole("img")).toHaveCount(
      2,
    );
    await expect(anon.getByRole("link", { name: "Quero entrar em contato" })).toBeVisible();
    await anon.screenshot({ path: "test-results/fase10/item-imovel.png", fullPage: true });

    // Metadados para a prévia no WhatsApp e noindex enquanto a indexação estiver desligada.
    await expect(anon.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      `${estado.itemNome} | IndicaMais`,
    );
    const descricao = await anon.locator('meta[name="description"]').getAttribute("content");
    expect(descricao).toBeTruthy();
    const robots = await anon.locator('meta[name="robots"]').getAttribute("content");
    if (!process.env.PUBLICO_INDEXAVEL) expect(robots).toContain("noindex");

    // Nada privado no HTML: sem e-mail ou telefone do dono, sem carrinho nem pagamento.
    const html = await anon.content();
    const email = process.env.E2E_DONO_EMAIL ?? "";
    expect(html).not.toContain(email);
    // O exemplo do campo de WhatsApp do formulário de contato ("(11) 99999-0001") é texto fixo, não dado de pessoa.
    const semExemplo = html.split("(11) 99999-0001").join("");
    const telefone = /\+55\d{10,11}|\(\d{2}\) ?9?\d{4}-\d{4}/.exec(semExemplo);
    expect(telefone ? semExemplo.slice(telefone.index - 40, telefone.index + 40) : null).toBeNull();
    expect(html).not.toMatch(/carrinho|checkout|comprar agora/i);
    const og = await anon.request.get(`/og/item/${estado.itemId}`, { maxRedirects: 0 });
    expect(og.status()).toBe(302);
  });

  test("7. com a Loja retirada, o imóvel some da página pública", async () => {
    await definirLoja(s.admin!, false);
    const r = await s.anon!.goto(`/item/${estado.itemId}`);
    expect(r?.status()).toBe(404);
    await s.anon!.goto(`/perfil/${SLUG}`);
    await expect(s.anon!.locator("#produtos").getByText(estado.itemNome)).toHaveCount(0);
  });
});
