/**
 * Capturas para o Emerson escolher 4 ou 5 cards por linha nos carrosséis da home (D-018, IM-095).
 * NÃO roda na suíte normal: só com CAPTURAR_HOME=1. Grava em docs/capturas/ (cards públicos, sem dado privado).
 * Para ter o que fotografar, o administrador baixa o mínimo da "Novidades" para 1 e DEPOIS volta para 4 (valor
 * padrão da migração). Os cards da primeira seção são duplicados no DOM até 8 só para mostrar a rolagem; nada vai ao banco.
 *   CAPTURAR_HOME=1 pnpm exec playwright test capturas-home-carrosseis --project=desktop --workers=1
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const PASTA = "docs/capturas";
const MINIMO_PADRAO = "4";

async function definirMinimo(browser: Browser, minimo: string, motivo: string) {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await entrar(page, "admin");
    await page.goto("/administracao/home");
    const c = page.locator('[data-secao="novidades"]');
    await c.getByText("Editar", { exact: true }).click();
    await c.getByLabel(/Mínimo de itens/).fill(minimo);
    await c.getByLabel("Motivo da alteração").fill(motivo);
    await c.getByRole("button", { name: "Salvar seção" }).click();
    await expect(c.getByRole("status").filter({ hasText: "Seção atualizada." })).toBeVisible();
  } finally {
    await ctx.close();
  }
}

async function preparar(page: Page, porLinha: 4 | 5) {
  await page.goto("/");
  const faixa = page.locator(".carrossel-home").first();
  await expect(faixa).toBeVisible();
  await page.evaluate((n) => {
    for (const f of document.querySelectorAll<HTMLElement>(".carrossel-home")) {
      f.style.setProperty("--cards-larga", String(n));
    }
    const ul = document.querySelector(".carrossel-home ul")!;
    const originais = Array.from(ul.children);
    let i = 0;
    while (ul.children.length < 8)
      ul.appendChild(originais[i++ % originais.length]!.cloneNode(true));
  }, porLinha);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await faixa.scrollIntoViewIfNeeded();
}

test.describe("capturas dos carrosséis (manual)", () => {
  test.skip(!process.env.CAPTURAR_HOME, "Defina CAPTURAR_HOME=1 para gerar as capturas.");
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async ({ browser }) => {
    exigirConta("admin");
    mkdirSync(PASTA, { recursive: true });
    await definirMinimo(browser, "1", "E2E: exibir carrossel para captura");
  });
  test.afterAll(async ({ browser }) => {
    await definirMinimo(browser, MINIMO_PADRAO, "E2E: restaurar mínimo padrão");
  });

  for (const n of [4, 5] as const) {
    test(`desktop ${n} por linha`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await preparar(page, n);
      await page
        .locator(".secao-home")
        .first()
        .screenshot({ path: `${PASTA}/home-carrosseis-${n}.png` });
      await ctx.close();
    });

    test(`celular ${n} por linha`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await preparar(page, n);
      await page
        .locator(".secao-home")
        .first()
        .screenshot({
          path: `${PASTA}/home-carrosseis-${n}-celular.png`,
        });
      await ctx.close();
    });
  }
});
