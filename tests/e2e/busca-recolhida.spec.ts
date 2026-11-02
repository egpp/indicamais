import { expect, test } from "@playwright/test";

// IM-019, IM-005: busca recolhida em uma linha (desktop e Pixel 7).
test.describe("busca recolhida", () => {
  test("abre, busca e limpa", async ({ page }, info) => {
    await page.goto("/");
    const resumo = page.locator("details.busca-recolhida > summary");
    await expect(resumo).toHaveText(/Buscar e filtrar/);
    const caixa = await resumo.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    const campo = page.getByLabel("Buscar pelo nome");
    await expect(campo).toBeHidden();
    await page.screenshot({ path: `test-results/busca-recolhida-${info.project.name}.png` });

    await resumo.click();
    await expect(campo).toBeVisible();
    await page.screenshot({ path: `test-results/busca-expandida-${info.project.name}.png` });

    await campo.fill("pizzaria");
    await page.getByLabel("Cidade").fill("Tramandaí");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/termo=pizzaria/);
    await expect(page.locator("details.busca-recolhida")).not.toHaveAttribute("open", "");
    await expect(resumo).toContainText("pizzaria");
    await expect(resumo).toContainText("2 filtros");

    await resumo.click();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(resumo).toHaveText(/Buscar e filtrar/);
  });

  test("teclado abre com Enter", async ({ page }) => {
    await page.goto("/");
    await page.locator("details.busca-recolhida > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Buscar pelo nome")).toBeVisible();
  });
});
