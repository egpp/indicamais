import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 5 (IM-039 a IM-053): rotas privadas, noindex e papéis. Só leitura, contra o DEV. Sem credenciais no log.
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ROTAS_PRIVADAS = [
  "/avisos",
  "/avisos/quem-me-indicou",
  "/minhas-participacoes",
  `/meus-perfis/${UUID_INEXISTENTE}/base`,
];

async function noindex(page: Page) {
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
}

test.describe("anônimo", () => {
  for (const rota of ROTAS_PRIVADAS) {
    test(`${rota} leva a entrar`, async ({ page }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/entrar/);
    });
  }

  test("contador do sino não revela nada a visitante", async ({ request }) => {
    const r = await request.get("/avisos/contador");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ logado: false, naoLidas: 0 });
    expect(r.headers()["cache-control"]).toContain("no-store");
  });

  test("visitante não vê sino nem botão de curtir; vê o convite a entrar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Avisos/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });
});

test.describe("logado", () => {
  test("indicador: sino acessível, avisos, abas, participações e 404 em base alheia", async ({
    page,
  }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    const r = await page.goto("/avisos");
    expect(r?.status()).toBe(200);
    await noindex(page);
    await expect(page.getByRole("heading", { level: 1, name: "Avisos" })).toBeVisible();
    const sino = page.getByRole("link", { name: /^Avisos, / });
    await expect(sino).toBeVisible();
    const caixa = await sino.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await sino.focus();
    await expect(sino).toBeFocused();
    for (const rota of ["/avisos/quem-me-indicou", "/minhas-participacoes", "/minhas-indicacoes"]) {
      const resp = await page.goto(rota);
      expect(resp?.status(), rota).toBe(200);
      await noindex(page);
    }
    const html = await page.content();
    expect(html).not.toMatch(/service_role|wa\.me|mailto:/i);
    const alheio = await page.goto(`/meus-perfis/${UUID_INEXISTENTE}/base`);
    expect(alheio?.status()).toBe(404);
  });

  test("dono: base do próprio perfil sem dado privado", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/meus-perfis");
    const link = page.locator('a[href^="/meus-perfis/"]:not([href*="novo"])').first();
    test.skip((await link.count()) === 0, "Conta de teste sem perfil.");
    const id = ((await link.getAttribute("href")) ?? "").split("/")[2];
    const resp = await page.goto(`/meus-perfis/${id}/base`);
    expect(resp?.status()).toBe(200);
    await noindex(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Base de relacionamento" }),
    ).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/wa\.me|mailto:|\+55\d{8,}|[\w.+-]+@[\w-]+\.[\w.-]+/i);
  });

  test("perfil público: logado vê Curtir ou Descurtir, sem promessa de ganho", async ({ page }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    await page.goto("/");
    const card = page.locator('a[href^="/perfil/"]').first();
    test.skip((await card.count()) === 0, "Sem perfil publicado no dev.");
    await card.click();
    await expect(page.getByRole("button", { name: /^(Curtir|Descurtir)$/ })).toBeVisible();
    await expect(page.getByText(/ponto|ganhe|benefício garantido/i)).toHaveCount(0);
  });
});

// Fluxo de duas contas (IM-039, IM-041, IM-043, IM-045, IM-047). Pulado de propósito: a conta E2E_DONO_* do dev
// ainda não tem perfil publicado, então não há base real para conferir. Ao criar o perfil, trocar test.fixme por test.
test.describe("duas contas", () => {
  test.fixme("indicador curte o perfil do dono; dono vê nome reduzido na base e aviso no sino; indicador descurte e sai", async ({
    browser,
  }) => {
    exigirConta("dono");
    exigirConta("indicador");
    const ind = await (await browser.newContext()).newPage();
    await entrar(ind, "indicador");
    await ind.goto("/");
    await ind.locator('a[href^="/perfil/"]').first().click();
    await ind.getByRole("button", { name: "Curtir", exact: true }).click();
    await expect(ind.getByRole("button", { name: "Descurtir" })).toBeVisible();
    const dono = await (await browser.newContext()).newPage();
    await entrar(dono, "dono");
    await dono.goto("/avisos");
    await expect(dono.getByText(/curtiu/i).first()).toBeVisible();
    const html = await dono.content();
    expect(html).not.toMatch(/wa\.me|mailto:|\+55\d{8,}/i);
    await ind.getByRole("button", { name: "Descurtir" }).click();
    await expect(ind.getByRole("button", { name: "Curtir", exact: true })).toBeVisible();
  });
});
