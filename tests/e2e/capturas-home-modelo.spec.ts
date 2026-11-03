/**
 * Capturas da home no layout do modelo (docs/marca/modelo-home): desktop 1280px e celular 360px, página inteira.
 * NÃO roda na suíte normal: só com CAPTURAR_HOME=1. Grava em docs/capturas/ (só conteúdo público, sem dado privado).
 *   CAPTURAR_HOME=1 pnpm exec playwright test capturas-home-modelo --project=desktop --workers=1
 */
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";

const PASTA = "docs/capturas";

test.describe("capturas da home no layout do modelo (manual)", () => {
  test.skip(!process.env.CAPTURAR_HOME, "Defina CAPTURAR_HOME=1 para gerar as capturas.");
  test.beforeAll(() => mkdirSync(PASTA, { recursive: true }));

  const casos = [
    { nome: "desktop-1280", viewport: { width: 1280, height: 900 }, movel: false },
    { nome: "celular-360", viewport: { width: 360, height: 740 }, movel: true },
  ] as const;

  for (const c of casos) {
    test(`home ${c.nome}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: c.viewport,
        deviceScaleFactor: c.movel ? 2 : 1,
        isMobile: c.movel,
        hasTouch: c.movel,
      });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${PASTA}/home-layout-modelo-${c.nome}.png`, fullPage: true });
      if (c.movel) {
        await page.getByRole("button", { name: "Abrir menu" }).click();
        await page.screenshot({ path: `${PASTA}/home-layout-modelo-${c.nome}-menu.png` });
      }
      await ctx.close();
    });
  }
});
