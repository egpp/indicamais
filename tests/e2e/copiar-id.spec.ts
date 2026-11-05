import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Botão "Copiar id" nas listas do administrador (IM-061 a IM-073). SOMENTE LEITURA contra o DEV: só navega, clica em
// "Copiar id" e lê a área de transferência; nenhum formulário é enviado. Não imprime dados. Se o dev não tiver
// linhas nas listas, o teste se marca como pulado (a cobertura vira a de componente, com dados fictícios).
const ABAS = ["assinaturas", "pagamentos", "comissoes", "vinculos"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function acharAbaComBotao(page: Page) {
  for (const aba of ABAS) {
    await page.goto(`/administracao/comissoes?aba=${aba}`);
    if ((await page.getByRole("button", { name: /^Copiar id / }).count()) > 0) return aba;
  }
  return null;
}

test.describe("Copiar id (somente leitura)", () => {
  test("com permissão de área de transferência: copia o id completo da linha, aviso em status, alvo de 44px", async ({
    page,
    context,
  }) => {
    exigirConta("admin");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await entrar(page, "admin");
    const aba = await acharAbaComBotao(page);
    test.skip(aba === null, "Dev sem linhas nas listas de comissões.");
    const botao = page.getByRole("button", { name: /^Copiar id / }).first();
    const curto = (await botao.getAttribute("aria-label"))!.replace("Copiar id ", "");
    const caixa = (await botao.boundingBox())!;
    expect(caixa.height).toBeGreaterThanOrEqual(43.5);
    expect(caixa.width).toBeGreaterThanOrEqual(43.5);
    await botao.focus();
    await expect(botao).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Id copiado." }).first()).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toMatch(UUID);
    expect(copiado.startsWith(curto)).toBe(true);
    const texto = await page.locator("main").innerText();
    expect(texto).not.toContain(copiado); // tela só mostra o curto
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(texto).not.toMatch(/\+55|\(\d{2}\)\s?\d{4,5}-\d{4}/);
    const estoura = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(estoura).toBe(false);
  });

  test("sem permissão: mostra campo somente leitura com o id completo selecionado", async ({
    page,
    context,
  }) => {
    exigirConta("admin");
    await context.clearPermissions();
    await entrar(page, "admin");
    const aba = await acharAbaComBotao(page);
    test.skip(aba === null, "Dev sem linhas nas listas de comissões.");
    // Nega a escrita na área de transferência mesmo que o navegador a ofereça.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new DOMException("negado", "NotAllowedError")) },
        configurable: true,
      });
    });
    await page.reload();
    const botao = page.getByRole("button", { name: /^Copiar id / }).first();
    await botao.click();
    const campo = page.getByLabel("Id completo para copiar").first();
    await expect(campo).toBeVisible();
    await expect(campo).toHaveJSProperty("readOnly", true);
    expect(await campo.inputValue()).toMatch(UUID);
    const sel = await campo.evaluate((el: HTMLInputElement) => [
      el.selectionStart,
      el.selectionEnd,
      el.value.length,
    ]);
    expect(sel[0]).toBe(0);
    expect(sel[1]).toBe(sel[2]);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /Não foi possível copiar/ })
        .first(),
    ).toBeVisible();
    const box = (await campo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    const estoura = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(estoura).toBe(false);
  });
});
