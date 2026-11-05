import { expect, test } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Verificação independente (Fase 7): 360px sem rolagem horizontal e foco por teclado. SOMENTE LEITURA contra o DEV.
test.use({ viewport: { width: 360, height: 740 } });

const estoura = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

test("admin em 360px: administração de comissões sem rolagem horizontal, com formulário aberto e foco visível", async ({
  page,
}) => {
  exigirConta("admin");
  await entrar(page, "admin");
  await page.goto("/administracao/comissoes");
  expect(await estoura(page)).toBe(false);
  const abrir = page.getByText("Abrir formulário");
  const n = await abrir.count();
  for (let i = 0; i < n; i++) await abrir.nth(i).click();
  expect(await estoura(page)).toBe(false);
  // Tab chega a um controle interativo (foco por teclado funciona).
  await page.keyboard.press("Tab");
  const foco = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(["A", "BUTTON", "SUMMARY", "INPUT", "SELECT", "TEXTAREA"]).toContain(foco);
});

test("indicador em 360px: Minhas comissões sem rolagem horizontal", async ({ page }) => {
  exigirConta("indicador");
  await entrar(page, "indicador");
  await page.goto("/comissoes");
  expect(await estoura(page)).toBe(false);
});
