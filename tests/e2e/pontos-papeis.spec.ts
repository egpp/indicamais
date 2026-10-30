import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 4, verificação independente: papel e noindex das rotas de pontos e benefícios (IM-035, IM-036, IM-079, IM-086).
// Só leitura, contra o DEV. Não imprime credenciais nem dados.
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

async function noindex(page: Page) {
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
}

test.describe("papéis nas rotas de pontos", () => {
  test("indicador: vê /pontos (noindex, sem observação interna) e não vê a administração", async ({
    page,
  }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    const r = await page.goto("/pontos");
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Meus pontos" })).toBeVisible();
    await noindex(page);
    await expect(page.getByText(/observa..o interna/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
    for (const rota of ["/administracao/pontos", "/administracao/beneficios"]) {
      const resp = await page.goto(rota);
      expect(resp?.status(), rota).toBe(404);
    }
    const alheio = await page.goto(`/meus-perfis/${UUID_INEXISTENTE}/beneficios`);
    expect(alheio?.status()).toBe(404);
  });

  test("dono comum: sem acesso à administração; benefícios só do próprio perfil", async ({
    page,
  }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    for (const rota of ["/administracao/pontos", "/administracao/beneficios"]) {
      const resp = await page.goto(rota);
      expect(resp?.status(), rota).toBe(404);
    }
    const p = await page.goto("/pontos");
    expect(p?.status()).toBe(200);
    await noindex(page);
    await page.goto("/meus-perfis");
    const link = page.locator('a[href^="/meus-perfis/"]:not([href*="novo"])').first();
    if ((await link.count()) > 0) {
      const href = (await link.getAttribute("href")) ?? "";
      const id = href.split("/")[2];
      const resp = await page.goto(`/meus-perfis/${id}/beneficios`);
      expect(resp?.status()).toBe(200);
      await noindex(page);
      await expect(page.getByText("resgate de benefícios ainda não está disponível")).toBeVisible();
    }
  });

  test("administrador: vê pontos e benefícios da administração (noindex, sem resgate)", async ({
    page,
  }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    for (const rota of ["/administracao/pontos", "/administracao/beneficios"]) {
      const resp = await page.goto(rota);
      expect(resp?.status(), rota).toBe(200);
      await noindex(page);
      await expect(page.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
      const html = await page.content();
      expect(html).not.toMatch(/service_role|sb_secret|wa\.me|mailto:/i);
    }
  });

  test("anônimo: vitrine sem dados privados e sem resgate", async ({ page }) => {
    const resp = await page.goto("/beneficios");
    expect(resp?.status()).toBe(200);
    const html = await page.content();
    expect(html).not.toMatch(/service_role|sb_secret|wa\.me|mailto:|\+55\d/i);
    await expect(page.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
    const p = await page.goto("/meus-perfis/" + UUID_INEXISTENTE + "/beneficios");
    expect(p?.url()).toMatch(/\/entrar/);
  });
});
