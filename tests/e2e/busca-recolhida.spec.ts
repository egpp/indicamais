import { expect, test } from "@playwright/test";

// IM-019, IM-005: busca em barra com "Mais filtros" recolhido (desktop e Pixel 7). Layout do modelo da home.
test.describe("busca da home", () => {
  test("abre mais filtros, busca e limpa", async ({ page }, info) => {
    await page.goto("/");
    const resumo = page.locator("details.busca-recolhida > summary");
    await expect(resumo).toHaveText(/Mais filtros/);
    const caixa = await resumo.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    const tipo = page.getByLabel("Tipo", { exact: true });
    await expect(tipo).toBeHidden();
    // A barra principal fica sempre à vista.
    await expect(page.getByLabel("Buscar pelo nome")).toBeVisible();
    await expect(page.getByLabel("Cidade", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/busca-recolhida-${info.project.name}.png` });

    await resumo.click();
    await expect(tipo).toBeVisible();
    await expect(page.getByLabel("Categoria", { exact: true })).toBeVisible();

    await page.getByLabel("Buscar pelo nome").fill("pizzaria");
    await page.getByLabel("Cidade", { exact: true }).fill("Tramandaí");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/termo=pizzaria/);
    await expect(page.locator(".hero-resumo")).toContainText("pizzaria");
    await expect(page.locator(".hero-resumo")).toContainText("2 filtros");

    await page.locator(".hero-resumo").getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".hero-resumo")).toHaveCount(0);
  });

  test("teclado abre com Enter", async ({ page }) => {
    await page.goto("/");
    await page.locator("details.busca-recolhida > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Tipo", { exact: true })).toBeVisible();
  });
});
