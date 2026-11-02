/**
 * Menu lateral em cascata do painel (D-015; IM-005, IM-014, IM-047). Só ambiente de DESENVOLVIMENTO.
 * Celular (Pixel 7): botão de menu abre a gaveta, que fecha com Esc, ao tocar fora e ao navegar.
 * Desktop: barra fixa, grupos em cascata e item ativo. Capturas em test-results/menu/.
 */
import { expect, test } from "@playwright/test";
import { credenciais, entrar, exigirConta } from "./contas";
import { menuPrincipal } from "./menu";

test.describe("menu do painel (dono)", () => {
  test("abre, fecha e navega", async ({ page }, info) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/meus-perfis");
    const projeto = info.project.name;
    const nav = menuPrincipal(page);
    const botao = page.getByRole("button", { name: "Abrir menu" });
    const sino = page.getByRole("link", { name: /^Avisos, / });

    if (projeto === "celular") {
      await expect(botao).toBeVisible();
      await expect(botao).toHaveAttribute("aria-expanded", "false");
      const caixa = await botao.boundingBox();
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(nav).toBeHidden();
      await expect(sino).toBeVisible();

      await botao.click();
      await expect(botao).toHaveAttribute("aria-expanded", "true");
      await expect(nav).toBeVisible();
      await expect(nav.getByText("Meu conteúdo", { exact: true })).toBeVisible();
      await page.waitForTimeout(400); // fim da animação da gaveta
      await page.screenshot({ path: `test-results/menu/${projeto}-aberto.png` });

      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
      await expect(botao).toBeFocused();

      await botao.click();
      await page.mouse.click(Math.round((page.viewportSize()?.width ?? 400) - 10), 300);
      await expect(nav).toBeHidden();

      await botao.click();
      await nav.getByText("Relacionamento", { exact: true }).click();
      await nav.getByRole("link", { name: "Pedidos de contato" }).click();
      await expect(page).toHaveURL(/\/pedidos-de-contato/);
      await expect(nav).toBeHidden();
    } else {
      await expect(botao).toBeHidden();
      await expect(nav).toBeVisible();
      await expect(sino).toBeVisible();
      const grupoConteudo = nav.locator("details", { hasText: "Meu conteúdo" }).first();
      await expect(grupoConteudo).toHaveJSProperty("open", true);
      await expect(nav.getByRole("link", { name: "Meus perfis" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const relacionamento = nav.locator("details", { hasText: "Relacionamento" }).first();
      await expect(relacionamento).toHaveJSProperty("open", false);
      await nav.getByText("Relacionamento", { exact: true }).click();
      await expect(nav.getByRole("link", { name: "Pedidos de contato" })).toBeVisible();
      await page.screenshot({ path: `test-results/menu/${projeto}-cascata.png` });
      await nav.getByRole("link", { name: "Pedidos de contato" }).click();
      await expect(page).toHaveURL(/\/pedidos-de-contato/);
      await expect(
        menuPrincipal(page).getByRole("link", { name: "Pedidos de contato" }),
      ).toHaveAttribute("aria-current", "page");
    }
    // Sem administração para quem não tem permissão.
    await expect(nav.locator('a[href^="/administracao"]')).toHaveCount(0);
  });
});

test.describe("menu do painel (administrador)", () => {
  test("grupo Administração aparece para quem tem acesso", async ({ page }, info) => {
    exigirConta("admin");
    await entrar(page, "admin");
    await page.goto("/administracao/revisao");
    if (info.project.name === "celular")
      await page.getByRole("button", { name: "Abrir menu" }).click();
    const nav = menuPrincipal(page);
    await expect(nav.getByText("Administração", { exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Fila de revisão" })).toBeVisible();
    await page.screenshot({ path: `test-results/menu/${info.project.name}-admin.png` });
  });
});

test.describe("identificação da conta no menu (IM-005, IM-014)", () => {
  test("dono vê o próprio e-mail no menu", async ({ page }, info) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/meus-perfis");
    if (info.project.name === "celular")
      await page.getByRole("button", { name: "Abrir menu" }).click();
    const { email } = credenciais("dono");
    const bloco = page.getByRole("group", { name: new RegExp(`^Conta: .*${email}$`, "i") });
    await expect(bloco).toBeVisible();
    await expect(bloco).toContainText(email);
  });

  test("anônimo não vê o painel nem a identificação", async ({ page }) => {
    await page.goto("/meus-perfis");
    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByRole("group", { name: /^Conta:/ })).toHaveCount(0);
  });
});
