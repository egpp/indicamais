/**
 * Linhas sem quebra de 80+ caracteres em local, categoria, preço e rótulo de tipo não podem mudar largura nem altura
 * de nenhum card (carrosséis e grade, 6 viewports). Só leitura contra o DEV: o DOM é alterado na página, nada é gravado.
 */
import { expect, test, type Page } from "@playwright/test";

const SEM_QUEBRA = "X".repeat(90);
const COM_ESPACOS = "palavra comprida de teste ".repeat(6);
const VIEWPORTS = [360, 412, 768, 1024, 1280, 1536];

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "desktop", "Os viewports são definidos pelo próprio teste.");
});

async function medir(page: Page, seletor: string) {
  return page.locator(seletor).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    }),
  );
}

for (const w of VIEWPORTS) {
  for (const [nome, url, sel] of [
    ["carrossel", "/", ".carrossel-home .card-publico"],
    ["grade", "/?termo=a", ".grade-cards .card-publico"],
  ] as const) {
    for (const [rotulo, texto] of [
      ["sem quebra", SEM_QUEBRA],
      ["com espaços", COM_ESPACOS],
    ] as const) {
      test(`${nome} ${w}px: ${rotulo} em local, categoria, preço e tipo`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: w, height: 800 },
          isMobile: w < 600,
          hasTouch: w < 600,
        });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(sel, { timeout: 60_000 }).catch(() => null);
        await page.waitForTimeout(1500);
        const antes = await medir(page, sel);
        test.skip(antes.length === 0, "Sem cards no DEV.");
        await page.locator(sel).evaluateAll((cards, t) => {
          cards.forEach((c, i) => {
            const tipo = c.querySelector(".card-tipo");
            const local = c.querySelector(".card-local span");
            const linha = c.querySelector(".card-linha:not(.card-local)");
            // Alterna: card par recebe texto longo em todas; ímpar força o estilo de preço na linha.
            if (tipo) tipo.textContent = t;
            if (local) local.textContent = t;
            if (linha) {
              linha.textContent = t;
              if (i % 2 === 1) linha.classList.add("preco-card");
            }
          });
        }, texto);
        const depois = await medir(page, sel);
        expect(depois.length).toBe(antes.length);
        for (let i = 0; i < depois.length; i++) {
          expect(depois[i]!.w, `largura card ${i}`).toBeCloseTo(antes[i]!.w, 1);
          expect(depois[i]!.h, `altura card ${i}`).toBeCloseTo(antes[i]!.h, 1);
        }
        const ref = depois[0]!;
        for (const c of depois) {
          expect(c.w).toBeCloseTo(ref.w, 1);
          expect(c.h).toBeCloseTo(ref.h, 1);
        }
        console.log(`${nome} ${w} ${rotulo}: ${depois.length} cards, todos ${ref.w}x${ref.h}`);
        await ctx.close();
      });
    }
  }
}
