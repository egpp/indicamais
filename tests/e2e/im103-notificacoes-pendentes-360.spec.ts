/**
 * IM-103 · tela /administracao/notificacoes-pendentes em 360px no DEV. SOMENTE LEITURA: não marca nem descarta nada.
 * Confere ausência de rolagem horizontal, alvo de toque mínimo das caixas e acesso negado ao indicador.
 */
import { expect, test } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const ROTA = "/administracao/notificacoes-pendentes";

test.describe("IM-103 notificações pendentes em 360px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("admin: sem rolagem horizontal e caixas com alvo de toque", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Viewport fixo em 360px; roda uma vez.");
    exigirConta("admin");
    await entrar(page, "admin");
    await page.goto(ROTA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
    const caixas = page.getByRole("checkbox");
    const n = await caixas.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(n, 5); i++) {
      const alvo = await caixas.nth(i).evaluate((el) => {
        const r = (el.closest("label") ?? el).getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      expect(alvo.h).toBeGreaterThanOrEqual(44);
      expect(alvo.w).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: "test-results/im103-360.png", fullPage: false });
  });

  test("indicador não acessa a tela", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Roda uma vez.");
    exigirConta("indicador");
    await entrar(page, "indicador");
    const resp = await page.goto(ROTA);
    expect(resp?.status()).toBe(404);
  });
});
