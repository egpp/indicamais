import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Navegador real (Chromium; desktop e Pixel 7) contra o COMPONENTE CopiarId real, empacotado com esbuild e servido numa
// origem https fictícia interceptada (contexto seguro: a área de transferência exige). Dados fictícios; não toca o dev,
// não usa contas nem escreve em nada. Complementa copiar-id.spec.ts, que usa as listas reais do dev quando houver linhas.
const IDS = ["0f8e7d6c-1234-4abc-9def-001122334455", "aabbccdd-9999-4eee-8aaa-665544332211"];
const ORIGEM = "https://copiar-id.test";

function empacotar(): string {
  const req = createRequire(join(process.cwd(), "package.json"));
  const esbuildCaminho = req.resolve("esbuild", {
    paths: [join(process.cwd(), "node_modules/.pnpm/esbuild@0.28.2/node_modules")],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const esbuild = require(esbuildCaminho) as typeof import("esbuild");
  const entrada = `
    import { createRoot } from "react-dom/client";
    import { CopiarId } from ${JSON.stringify(join(process.cwd(), "src/app/_componentes/copiar-id.tsx").replace(/\\/g, "/"))};
    const ids = ${JSON.stringify(IDS)};
    createRoot(document.getElementById("raiz")!).render(
      <main><ul>{ids.map((id) => <li key={id} className="ajuda quebra-total">Cliente (conta): <CopiarId id={id} /></li>)}</ul></main>
    );`;
  const r = esbuild.buildSync({
    stdin: { contents: entrada, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [join(process.cwd(), "node_modules")],
  });
  return r.outputFiles[0]!.text;
}

function luminancia(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

test.beforeEach(async ({ page }) => {
  const js = empacotar();
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  await page.route(`${ORIGEM}/**`, (rota) =>
    rota.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="raiz"></div><script>${js.replace(/<\/script>/g, "<\\/script>")}</script></body></html>`,
    }),
  );
  await page.goto(`${ORIGEM}/`);
});

test.describe("CopiarId em navegador real (dados fictícios)", () => {
  test("com permissão: copia o id completo da linha certa, aviso em status, teclado, alvo 44px, contraste AA", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGEM });
    const botoes = page.getByRole("button", { name: /^Copiar id / });
    await expect(botoes).toHaveCount(2);
    // tela mostra só o curto
    expect(await page.locator("main").innerText()).not.toContain(IDS[1]);
    for (const b of await botoes.all()) {
      const c = (await b.boundingBox())!;
      expect(c.height).toBeGreaterThanOrEqual(43.5);
      expect(c.width).toBeGreaterThanOrEqual(43.5);
    }
    // contraste do botão (texto x fundo da página) e do aviso
    const cores = await botoes.nth(0).evaluate((el) => {
      const cs = getComputedStyle(el);
      return [cs.color, getComputedStyle(document.body).backgroundColor];
    });
    expect(contraste(cores[0]!, cores[1]!)).toBeGreaterThanOrEqual(4.5);
    // segunda linha, por teclado
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(botoes.nth(1)).toBeFocused();
    const foco = await botoes.nth(1).evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    });
    expect(foco).toBe(true);
    await page.keyboard.press("Enter");
    const status = page.getByRole("status").filter({ hasText: "Id copiado." });
    await expect(status).toHaveCount(1);
    await expect(status.first()).toHaveAttribute("aria-live", "polite");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(IDS[1]);
    await botoes.nth(0).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(IDS[0]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    ).toBe(false);
  });

  test("sem permissão: campo somente leitura com o id completo selecionado, 44px, sem estourar a largura", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await context.clearPermissions();
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.reject(new DOMException("negado", "NotAllowedError")),
        configurable: true,
      });
    });
    await page
      .getByRole("button", { name: /^Copiar id / })
      .first()
      .click();
    const campo = page.getByLabel("Id completo para copiar");
    await expect(campo).toHaveCount(1);
    await expect(campo).toHaveJSProperty("readOnly", true);
    expect(await campo.inputValue()).toBe(IDS[0]);
    const sel = await campo.evaluate((el: HTMLInputElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]);
    expect(sel).toEqual([0, IDS[0]!.length]);
    await expect(
      page.getByRole("status").filter({ hasText: /Não foi possível copiar/ }),
    ).toHaveCount(1);
    expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    ).toBe(false);
    // foco por teclado no campo também seleciona tudo
    await campo.blur();
    await campo.focus();
    expect(
      await campo.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([0, IDS[0]!.length]);
  });

  test("sem API de área de transferência (navegador antigo): mesmo caminho alternativo", async ({
    page,
  }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
    await page
      .getByRole("button", { name: /^Copiar id / })
      .nth(1)
      .click();
    expect(await page.getByLabel("Id completo para copiar").inputValue()).toBe(IDS[1]);
  });
});
