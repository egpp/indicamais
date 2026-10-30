import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 6 (IM-076, IM-077, IM-080, IM-081): denúncia pública, telas por permissão e encerrar conta.
// Só leitura contra o DEV: nenhum teste grava denúncia, suspensão nem encerramento (o caminho do robô não chega ao banco).
const ROTAS_ADM = [
  "/administracao/denuncias",
  "/administracao/permissoes",
  "/administracao/contas",
  "/administracao/indicacoes",
];

async function noindex(page: Page) {
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
}

async function primeiroDestinoPublico(page: Page): Promise<string | null> {
  await page.goto("/");
  const links = page.locator('a[href^="/perfil/"], a[href^="/item/"]');
  if ((await links.count()) === 0) return null;
  return links.first().getAttribute("href");
}

test.describe("anônimo", () => {
  for (const rota of [...ROTAS_ADM, "/minha-conta"]) {
    test(`${rota} leva a entrar`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/entrar/);
    });
  }

  test("Denunciar: formulário acessível, armadilha escondida e resposta neutra", async ({
    page,
  }, info) => {
    const destino = await primeiroDestinoPublico(page);
    test.skip(!destino, "Sem perfil ou item publicado no DEV para testar.");
    await page.goto(destino!);
    const resumo = page.getByText("Denunciar", { exact: true });
    await expect(resumo).toBeVisible();
    const caixa = await resumo.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await resumo.click();

    // Armadilha: fora do foco e escondida de leitores de tela.
    const armadilha = page.locator('input[name="site"]');
    await expect(armadilha).toHaveAttribute("tabindex", "-1");
    await expect(page.locator('.campo-armadilha[aria-hidden="true"]')).toHaveCount(1);

    // Erro claro, sem enviar.
    await page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(page.getByText("Escolha o motivo da denúncia.")).toBeVisible();
    await expect(page.getByText(/limite de denúncias/)).toBeVisible();

    // Robô: o servidor responde igual, mas nada é gravado.
    await page.getByLabel("Motivo da denúncia").selectOption("spam_fraude");
    await armadilha.evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
    await page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(page.getByText("Recebemos sua denúncia. Obrigado por avisar.")).toBeVisible();
    await page.screenshot({
      path: `test-results/fase6/denunciar-${info.project.name}.png`,
      fullPage: true,
    });
    const html = await page.content();
    expect(html).not.toMatch(/service_role|mailto:/i);
  });
});

test.describe("papéis", () => {
  test("indicador sem permissão: 404 em toda a administração e sem menu", async ({
    page,
  }, info) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    for (const rota of ROTAS_ADM) {
      const r = await page.goto(rota);
      expect(r?.status(), rota).toBe(404);
    }
    const r = await page.goto("/minha-conta");
    expect(r?.status()).toBe(200);
    await noindex(page);
    await expect(page.getByRole("heading", { name: "Alterar senha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encerrar conta" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Administração" })).toHaveCount(0);
    await expect(page.getByText("30 dias")).toBeVisible();

    // Palavra errada: erro no navegador, nada é enviado.
    await page.getByLabel(/Digite ENCERRAR/).fill("sim");
    await page.getByRole("button", { name: "Encerrar minha conta" }).click();
    await expect(page.getByText("Para encerrar a conta, digite ENCERRAR.")).toBeVisible();
    await page.screenshot({
      path: `test-results/fase6/minha-conta-${info.project.name}.png`,
      fullPage: true,
    });
  });

  test("administrador: telas por permissão, noindex e sem dado privado", async ({ page }, info) => {
    exigirConta("admin");
    await entrar(page, "admin");
    for (const rota of ROTAS_ADM) {
      const r = await page.goto(rota);
      expect(r?.status(), rota).toBe(200);
      await noindex(page);
      const html = await page.content();
      expect(html).not.toMatch(/service_role|wa\.me|mailto:/i);
      const nome = rota.split("/").pop();
      await page.screenshot({
        path: `test-results/fase6/adm-${nome}-${info.project.name}.png`,
        fullPage: true,
      });
    }
    await page.goto("/administracao/denuncias");
    await expect(page.getByRole("heading", { level: 1, name: "Denúncias" })).toBeVisible();
    // A fila nunca mostra quem denunciou, só a referência opaca.
    await expect(page.getByText(/@[a-z0-9-]+\.[a-z]/i)).toHaveCount(0);
    await page.goto("/minha-conta");
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  });
});
