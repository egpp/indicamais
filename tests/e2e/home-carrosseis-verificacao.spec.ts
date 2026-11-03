/**
 * Verificação independente · Fase 9 · home em carrossel (IM-095, IM-096, D-018) no DEV. Somente leitura.
 * - HTML público das seções sem contato, e-mail nem identificador de conta;
 * - com busca (cidade/UF) a home não mostra as seções (divergência registrada com D-018: "Na sua cidade" só existe sem filtro);
 * - /administracao/home: noindex para o administrador, 404 para o dono, /entrar para o visitante.
 */
import { expect, test, type Browser } from "@playwright/test";
import { entrar, exigirConta, nomesFaltando } from "./contas";

const SEM_CONTATO =
  /(tel:|wa\.me|api\.whatsapp|mailto:|@[a-z0-9-]+\.[a-z]{2,}|\+55\s?\d{2}\s?9?\d{4}|conta_id|responsavel)/i;

/** Troca o mínimo de itens da seção Novidades pelo painel do administrador e devolve o valor anterior (dev, com motivo). */
async function ajustarMinimo(browser: Browser, minimo: string, motivo: string): Promise<string> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await entrar(page, "admin");
    await page.goto("/administracao/home");
    const c = page.locator('[data-secao="novidades"]');
    await c.getByText("Editar", { exact: true }).click();
    const campo = c.getByLabel(/Mínimo de itens/);
    const atual = await campo.inputValue();
    if (atual === minimo) return atual;
    await campo.fill(minimo);
    await c.getByLabel("Motivo da alteração").fill(motivo);
    await c.getByRole("button", { name: "Salvar seção" }).click();
    await expect(c.getByRole("status").filter({ hasText: "Seção atualizada." })).toBeVisible();
    return atual;
  } finally {
    await ctx.close();
  }
}

test.describe("home · HTML das seções", () => {
  let original: string | null = null;
  test.beforeAll(async ({ browser }) => {
    if (nomesFaltando("admin").length === 0) {
      original = await ajustarMinimo(browser, "1", "Verificação independente: exibir seção");
    }
  });
  test.afterAll(async ({ browser }) => {
    if (original !== null)
      await ajustarMinimo(browser, original, "Verificação independente: restaurar");
  });

  test("seções públicas não carregam contato nem identificador de conta", async ({ page }) => {
    await page.goto("/");
    const secoes = page.locator(".secoes-home");
    if ((await secoes.count()) === 0) test.skip(true, "Sem seção visível no DEV agora.");
    const html = await secoes.evaluate((el) => el.outerHTML);
    expect(html).not.toMatch(SEM_CONTATO);
  });

  test("com cidade e UF na busca a home não exibe as seções em carrossel", async ({ page }) => {
    await page.goto("/?cidade=Porto%20Alegre&uf=RS");
    await expect(page.locator(".secoes-home")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Na sua cidade" })).toHaveCount(0);
  });

  test("a home com busca é sempre noindex (a sem filtro segue PUBLICO_INDEXAVEL, desligado no DEV)", async ({
    page,
  }) => {
    await page.goto("/?cidade=Porto%20Alegre&uf=RS");
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  });
});

test.describe("administração · /administracao/home", () => {
  test("administrador: página com noindex e sem rolagem horizontal", async ({ page }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    await page.goto("/administracao/home");
    await expect(
      page.getByRole("heading", { level: 1, name: /Seções da página inicial/ }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    const larg = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(larg[0]).toBeLessThanOrEqual(larg[1]!);
  });
});
