/**
 * Tela "Modelos de sites" (/administracao/estilos), SOMENTE LEITURA: não habilita nem desabilita nada.
 * Só contra o ambiente de DESENVOLVIMENTO, com a conta E2E_ADMIN_* (administrador geral).
 * Confere: 22 cartões, busca, filtro, índice recolhível e ausência de rolagem horizontal em 360px.
 */
import { expect, test } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

test.describe("Modelos de sites (administração)", () => {
  test.beforeEach(() => exigirConta("admin"));

  test("lista, busca, filtro e 360px sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrar(page, "admin");
    await page.goto("/administracao/estilos");
    await expect(page.getByRole("heading", { level: 1, name: "Modelos de sites" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("22 modelos encontrados");
    await expect(page.locator(".modelo-cartao")).toHaveCount(22);

    const largura = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(largura.doc).toBeLessThanOrEqual(largura.janela);

    await page.getByLabel("Buscar modelo pelo nome").fill("essencial");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("status")).toHaveText("1 modelo encontrado");
    await expect(page.getByRole("heading", { name: /Essencial — Plano Gratuito/ })).toBeVisible();

    await page.getByRole("link", { name: "Habilitados" }).click();
    await expect(page).toHaveURL(/estado=habilitados/);
  });
});
