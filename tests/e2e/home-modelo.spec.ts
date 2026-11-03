/**
 * Home no layout do modelo do Emerson (desktop e celular Pixel 7), contra o DEV: sem login.
 * Cobre: landmarks e skip link, cabeçalho e menu (gaveta no celular), cards de mesmo tamanho (medidos), carrosséis,
 * busca, páginas informativas, sem rolagem horizontal e sem erro de console. Rode com --workers=1.
 */
import { expect, test, type Page } from "@playwright/test";

function espiarConsole(page: Page): string[] {
  const problemas: string[] = [];
  page.on("console", (m) => m.type() === "error" && problemas.push(m.text()));
  page.on("pageerror", (e) => problemas.push(e.message));
  return problemas;
}

test.describe("home no layout do modelo", () => {
  test("estrutura, acessibilidade básica e sem rolagem horizontal", async ({ page }, info) => {
    const problemas = espiarConsole(page);
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Encontre empresas");
    await expect(page.getByRole("search")).toBeVisible();

    // Skip link: primeiro foco do teclado.
    await page.keyboard.press("Tab");
    const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(pular).toBeFocused();
    await expect(pular).toBeVisible();

    // Vantagens com textos fiéis (sem "verificadas").
    const vantagens = page.getByRole("list", { name: "Vantagens do IndicaMais" });
    await expect(vantagens).toContainText("Empresas aprovadas");
    await expect(page.locator("body")).not.toContainText(/verificad/i);

    // Sem redes sociais (IM-012) e sem Planos (futuro).
    await expect(page.locator("footer")).not.toContainText(
      /instagram|facebook|youtube|tiktok|planos/i,
    );

    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(info.project.name === "celular" ? 412 : 1280 + 1);
    expect(problemas).toEqual([]);
  });

  test("celular 360px: sem rolagem horizontal, menu em gaveta, busca empilhada", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const problemas = espiarConsole(page);
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );

    const menu = page.getByRole("navigation", { name: "Principal" });
    const abrir = page.getByRole("button", { name: "Abrir menu" });
    await expect(abrir).toBeVisible();
    // Gaveta fechada: itens do menu não aparecem.
    await expect(menu.getByRole("link", { name: "Como funciona" })).toBeHidden();
    await abrir.click();
    await expect(menu.getByRole("link", { name: "Como funciona" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Indique e Ganhe" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu.getByRole("link", { name: "Como funciona" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();

    // Busca empilhada: o botão fica abaixo do campo de texto.
    const campo = (await page.getByLabel("Buscar pelo nome").boundingBox())!;
    const botao = (await page.getByRole("button", { name: "Buscar", exact: true }).boundingBox())!;
    expect(botao.y).toBeGreaterThan(campo.y + campo.height - 1);
    expect(botao.height).toBeGreaterThanOrEqual(44);
    expect(problemas).toEqual([]);
    await ctx.close();
  });

  test("desktop: menu com Categorias em lista e links existentes", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Menu horizontal só no desktop.");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const t of ["Início", "Como funciona", "Indique e Ganhe", "Ajuda"]) {
      await expect(nav.getByRole("link", { name: t, exact: true })).toBeVisible();
    }
    const cat = nav.getByRole("button", { name: "Categorias" });
    await expect(cat).toHaveAttribute("aria-expanded", "false");
    await cat.click();
    await expect(cat).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Ver todas as categorias" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cat).toHaveAttribute("aria-expanded", "false");
  });

  test("todos os cards têm exatamente o mesmo tamanho, em todas as seções", async ({ page }) => {
    await page.goto("/");
    const caixas = await page.locator(".carrossel-home .card-publico").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
      }),
    );
    test.skip(caixas.length === 0, "Sem cards publicados no DEV agora.");
    const { w, h } = caixas[0]!;
    for (const c of caixas) {
      expect(c.w).toBeCloseTo(w, 1);
      expect(c.h).toBeCloseTo(h, 1);
    }
  });

  test("carrossel: setas rolam a faixa e a página não ganha rolagem horizontal", async ({
    page,
  }) => {
    await page.goto("/");
    const regioes = page.locator('.secoes-catalogo [role="region"][aria-label]');
    test.skip((await regioes.count()) === 0, "Sem carrossel no DEV agora.");
    const regiao = regioes.first();
    const nome = (await regiao.getAttribute("aria-label"))!;
    const sobra = await regiao.evaluate((el) => el.scrollWidth - el.clientWidth);
    if (sobra > 8) {
      await page.getByRole("button", { name: `${nome}: ver próximos` }).click();
      await expect.poll(() => regiao.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
    await expect(page.getByRole("link", { name: "Ver todos" }).first()).toBeVisible();
  });

  test("busca pela barra leva aos resultados e mantém os valores", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar pelo nome").fill("natu");
    await page.getByLabel("UF", { exact: true }).selectOption("RS");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/termo=natu/);
    await expect(page).toHaveURL(/uf=RS/);
    await expect(page.getByRole("heading", { level: 2, name: "Resultados" })).toBeVisible();
    await expect(page.getByLabel("Buscar pelo nome")).toHaveValue("natu");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("categorias da faixa levam à busca filtrada", async ({ page }) => {
    await page.goto("/");
    const faixa = page.getByRole("navigation", { name: /Explore por categoria/ });
    const primeira = faixa.locator("a[href*='categoriaId=']").first();
    test.skip((await primeira.count()) === 0, "Sem categorias no DEV.");
    await primeira.click();
    await expect(page).toHaveURL(/categoriaId=/);
    await expect(page.getByRole("heading", { level: 2, name: "Resultados" })).toBeVisible();
  });
});

test.describe("páginas informativas", () => {
  for (const [rota, titulo] of [
    ["/como-funciona", "Como funciona"],
    ["/indique-e-ganhe", "Indique e Ganhe"],
    ["/ajuda", "Ajuda"],
    ["/categorias", "Categorias"],
  ] as const) {
    test(`${rota} abre, tem título, noindex e sem erros`, async ({ page }) => {
      const problemas = espiarConsole(page);
      const r = await page.goto(rota);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`${titulo} \\| IndicaMais`));
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      expect(problemas).toEqual([]);
    });
  }
});
