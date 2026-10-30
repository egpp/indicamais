import { expect, test } from "@playwright/test";

// Fase 4 (pontos e beneficios): checagens anonimas leves. Sem login, sem dados privados.
test.describe("pontos e beneficios (anonimo)", () => {
  for (const rota of [
    "/pontos",
    "/administracao/pontos",
    "/administracao/beneficios",
    "/administracao/parametros",
  ]) {
    test(`${rota} exige login`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/entrar/);
    });
  }

  test("vitrine publica de beneficios carrega, e informativa e sem indexacao", async ({ page }) => {
    const resposta = await page.goto("/beneficios");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Benefícios" })).toBeVisible();
    await expect(page.getByText("ainda não podem ser trocados")).toBeVisible();
    await expect(page.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });
});
