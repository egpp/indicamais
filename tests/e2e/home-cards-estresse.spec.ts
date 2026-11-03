/**
 * Verificação independente da regra do Emerson: todos os cards com o mesmo tamanho (largura e altura), também com
 * texto longo e sem imagem. Os cards reais do DEV são alterados no DOM (texto enorme, sem imagem, vazios) e medidos
 * em vários viewports. Só leitura contra o DEV (nada é gravado). Rode com --project=desktop --workers=1
 * (os viewports são definidos aqui).
 *
 * DEFEITO CONHECIDO (verificador, 03/11/2026): as linhas sem quebra (.card-linha: categoria/preço e local, .card-tipo)
 * alargam o <li> do carrossel quando o texto passa de ~40 caracteres, porque o item flex tem min-width automático.
 * O teste de "linha sem quebra" está marcado com test.fail() para documentar; remova a marca quando corrigir
 * (correção sugerida: min-width: 0 em `.carrossel-home > ul > li`).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const LONGO =
  "Texto extremamente longo sem espaços ou com espaços ".repeat(12) +
  "Supercalifragilisticexpialidocioso".repeat(6);

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 412, height: 915 },
  { width: 768, height: 900 },
  { width: 1024, height: 800 },
  { width: 1280, height: 800 },
  { width: 1536, height: 900 },
];

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "desktop", "Os viewports são definidos pelo próprio teste.");
});

async function abrir(
  browser: Browser,
  vp: { width: number; height: number },
  url: string,
  seletor: string,
) {
  const ctx = await browser.newContext({
    viewport: vp,
    isMobile: vp.width < 600,
    hasTouch: vp.width < 600,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(seletor, { timeout: 60_000 }).catch(() => null);
  // Deixa a hidratação terminar antes de alterar o DOM.
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function medir(page: Page, seletor: string) {
  return page.locator(seletor).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    }),
  );
}

/** Nome e descrição enormes, sem imagem e campos vazios: o caso que o Emerson pediu. */
async function estressarTextoLivre(page: Page, seletor: string) {
  await page.locator(seletor).evaluateAll((cards, longo) => {
    cards.forEach((c, i) => {
      const modo = i % 4;
      const q = (s: string) => c.querySelector(s) as HTMLElement | null;
      if (modo === 1 || modo === 3) {
        const img = q(".card-imagem img");
        if (img) {
          const sp = document.createElement("span");
          sp.className = "imagem-indisponivel";
          sp.textContent = "Sem imagem";
          img.replaceWith(sp);
        }
      }
      if (modo === 0 || modo === 3) {
        const d = q(".card-descricao");
        if (d) d.textContent = longo;
        const a = q(".card-nome a") ?? q(".card-nome");
        if (a) a.textContent = longo;
      }
      if (modo === 2) {
        const d = q(".card-descricao");
        if (d) d.textContent = " ";
        const a = q(".card-nome a") ?? q(".card-nome");
        if (a) a.textContent = "A";
      }
    });
  }, LONGO);
}

test.describe("cards de tamanho único sob estresse", () => {
  for (const vp of VIEWPORTS) {
    test(`carrosséis ${vp.width}px: nome/descrição longos, sem imagem e vazios`, async ({
      browser,
    }) => {
      const { ctx, page } = await abrir(browser, vp, "/", ".carrossel-home .card-publico");
      const antes = await medir(page, ".carrossel-home .card-publico");
      test.skip(antes.length === 0, "Sem cards no DEV.");
      await estressarTextoLivre(page, ".carrossel-home .card-publico");
      const depois = await medir(page, ".carrossel-home .card-publico");
      expect(depois.length).toBe(antes.length);
      const ref = antes[0]!;
      for (const c of depois) {
        expect(c.w).toBeCloseTo(ref.w, 1);
        expect(c.h).toBeCloseTo(ref.h, 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        vp.width,
      );
      if (vp.width >= 1024) {
        // 4 por linha no desktop (D-019).
        const larg = await page
          .locator(".carrossel-home")
          .first()
          .evaluate((el) => el.clientWidth - 12);
        expect(Math.round((larg + 16) / (ref.w + 16))).toBe(4);
      }
      console.log(`carrossel ${vp.width}: ${depois.length} cards, todos ${ref.w}x${ref.h}`);
      await ctx.close();
    });

    test(`resultados (grade) ${vp.width}px: mesmo tamanho sob estresse`, async ({ browser }) => {
      const { ctx, page } = await abrir(browser, vp, "/?termo=a", ".grade-cards .card-publico");
      const n = await page.locator(".grade-cards .card-publico").count();
      test.skip(n === 0, "Sem resultados no DEV para termo=a.");
      await estressarTextoLivre(page, ".grade-cards .card-publico");
      const m = await medir(page, ".grade-cards .card-publico");
      const ref = m[0]!;
      for (const c of m) {
        expect(c.w).toBeCloseTo(ref.w, 1);
        expect(c.h).toBeCloseTo(ref.h, 1);
      }
      console.log(`grade ${vp.width}: ${n} cards, todos ${ref.w}x${ref.h}`);
      await ctx.close();
    });
  }

  for (const largura of [360, 1280]) {
    test(`carrossel ${largura}px: linha sem quebra de 80 caracteres (local, categoria, tipo) não alarga o card`, async ({
      browser,
    }) => {
      test.fail(
        true,
        "Defeito: <li> do carrossel alarga com linha sem quebra longa (min-width automático).",
      );
      const { ctx, page } = await abrir(
        browser,
        { width: largura, height: 800 },
        "/",
        ".carrossel-home .card-publico",
      );
      const card = page.locator(".carrossel-home .card-publico").first();
      const antes = (await card.boundingBox())!.width;
      await card.locator(".card-local span").evaluate((el) => {
        el.textContent = "Cidade com nome muito comprido de teste, Bairro Centro Antigo, RS ".slice(
          0,
          80,
        );
      });
      const depois = (await card.boundingBox())!.width;
      expect(depois).toBeCloseTo(antes, 0);
      await ctx.close();
    });
  }
});
