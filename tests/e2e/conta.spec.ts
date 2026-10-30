/**
 * E2E da conta (IM-006 a IM-009). ESCRITO, NÃO EXECUTADO.
 *
 * Execução: pnpm test:e2e (o playwright.config.ts carrega o .env.local).
 * Fluxos autenticados usam as contas E2E_* (ver tests/e2e/contas.ts) e são pulados,
 * com os nomes das variáveis ausentes, se faltarem.
 */
import { expect, test } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

test.use({ viewport: { width: 360, height: 740 } });

test("login inválido mostra mensagem genérica", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("ninguem@exemplo.com");
  await page.getByLabel("Senha").fill("senhaerrada1");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".aviso[role=alert]")).toHaveText("E-mail ou senha incorretos.");
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
  await expect(page.locator(".aviso[role=alert]")).toContainText(
    "login com Google não está disponível",
  );
});

test.describe("autenticado", () => {
  test("salva WhatsApp com máscara e informa que não é verificado", async ({ page }) => {
    exigirConta("indicador");
    await entrar(page, "indicador", /\/minha-conta/);

    // A seção também tem aria-labelledby="titulo-whatsapp"; o papel textbox escolhe só o campo.
    // Número fictício exclusivo do papel indicador; regravar o mesmo número da própria conta
    // é permitido, então o teste é idempotente entre rodadas.
    const campo = page.getByRole("textbox", { name: "WhatsApp" });
    await campo.fill("");
    await campo.pressSequentially("11999990001");
    await expect(campo).toHaveValue("(11) 99999-0001");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status")).toContainText("ainda não foi verificado");
  });
});
