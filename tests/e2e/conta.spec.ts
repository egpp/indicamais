/**
 * E2E da conta (IM-006 a IM-009). ESCRITO, NÃO EXECUTADO.
 *
 * Só roda depois de: (1) migração aplicada no Supabase de dev, (2) Auth configurado no painel
 * (Site URL, redirect URLs, confirmação de e-mail), (3) @playwright/test instalado
 * (`pnpm add -D @playwright/test` + `pnpm exec playwright install chromium`, ~150 MB de download).
 * Execução: E2E_CONTAS=1 E2E_BASE_URL=http://localhost:3000 pnpm exec playwright test
 *
 * Confirmação de e-mail por link não é automatizável sem caixa de teste; use um usuário
 * já confirmado criado no painel (E2E_EMAIL / E2E_SENHA) para os fluxos autenticados.
 */
import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_CONTAS !== "1", "Aguarda migração e configuração do Auth no painel.");

test.use({ viewport: { width: 360, height: 740 } });

test("login inválido mostra mensagem genérica", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("ninguem@exemplo.com");
  await page.getByLabel("Senha").fill("senhaerrada1");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
});

test("recuperação de senha dá a mesma resposta para qualquer e-mail", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill("qualquer@exemplo.com");
  await page.getByRole("button", { name: "Enviar instruções" }).click();
  await expect(page.getByRole("status")).toContainText("Se este e-mail estiver cadastrado");
});

test("não existe Apple na tela de entrada", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByText(/apple/i)).toHaveCount(0);
});

test("Google sem provedor configurado mostra mensagem amigável", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar com Google" }).click();
  // Com o provedor ligado no painel este teste deve ser trocado pelo fluxo real.
  await expect(page.getByRole("alert")).toContainText("login com Google não está disponível");
});

test.describe("autenticado", () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_SENHA, "Defina E2E_EMAIL e E2E_SENHA.");

  test("salva WhatsApp com máscara e informa que não é verificado", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/minha-conta/);

    const campo = page.getByLabel("WhatsApp");
    await campo.fill("");
    await campo.pressSequentially("11999990001");
    await expect(campo).toHaveValue("(11) 99999-0001");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status")).toContainText("ainda não foi verificado");
  });
});
