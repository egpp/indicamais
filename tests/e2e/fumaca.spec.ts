import { expect, test } from "@playwright/test";

// Teste de fumaca anonimo: prova a instalacao do Playwright (D-011).
test.describe("fumaca anonima", () => {
  test("home carrega com 200", async ({ page }) => {
    const resposta = await page.goto("/");
    expect(resposta?.status()).toBe(200);
  });

  test("perfil inexistente mostra pagina nao encontrada", async ({ page }) => {
    await page.goto("/perfil/nao-existe");
    await expect(page.getByText("Página não encontrada").first()).toBeVisible();
  });

  test("administracao exige login", async ({ page }) => {
    await page.goto("/administracao/negocios");
    await expect(page).toHaveURL(/\/entrar/);
  });
});
