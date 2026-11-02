/**
 * Verificação independente do menu do painel (D-015; IM-005, IM-014, IM-047). Só DESENVOLVIMENTO.
 * Cobre: /painel/acesso, links do menu por papel, rotas de administração em 404 sem permissão,
 * rolagem horizontal em 360-414 px, teclado (setas, Home, End, Tab preso, Esc) e contraste do item ativo.
 */
import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta, type Papel } from "./contas";
import { menuPrincipal } from "./menu";

const ROTAS_ADMIN = [
  "/administracao/revisao",
  "/administracao/denuncias",
  "/administracao/contas",
  "/administracao/indicacoes",
  "/administracao/permissoes",
  "/administracao/pontos",
  "/administracao/beneficios",
  "/administracao/parametros",
  "/administracao/patrocinadores",
  "/administracao/categorias",
  "/administracao/pedidos",
  "/administracao/negocios",
];

async function abrir(page: Page) {
  const b = page.getByRole("button", { name: "Abrir menu" });
  if (await b.isVisible()) await b.click();
}

test("GET /painel/acesso anônimo: JSON mínimo, no-store, noindex", async ({ request }) => {
  const r = await request.get("/painel/acesso");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect(r.headers()["x-robots-tag"]).toContain("noindex");
  expect(await r.json()).toEqual({ logado: false, geral: false, permissoes: [] });
});

for (const papel of ["dono", "indicador"] as Papel[]) {
  test.describe(`sem permissão (${papel})`, () => {
    test("acesso sem administração, menu sem itens e rotas 404", async ({ page }) => {
      exigirConta(papel);
      await entrar(page, papel);
      const r = await page.request.get("/painel/acesso");
      const j = await r.json();
      expect(Object.keys(j).sort()).toEqual(["geral", "logado", "permissoes"]);
      expect(j.logado).toBe(true);
      expect(j.geral).toBe(false);
      expect(r.headers()["cache-control"]).toContain("no-store");
      await page.goto("/minha-conta");
      await abrir(page);
      if (j.permissoes.length === 0)
        await expect(menuPrincipal(page).locator('a[href^="/administracao"]')).toHaveCount(0);
      if (j.permissoes.length === 0) {
        for (const rota of ROTAS_ADMIN) {
          const resp = await page.request.get(rota);
          expect(resp.status(), rota).toBe(404);
        }
      }
    });
  });
}

for (const papel of ["dono", "indicador", "admin"] as Papel[]) {
  test(`links do menu respondem (${papel})`, async ({ page }) => {
    exigirConta(papel);
    await entrar(page, papel);
    await page.goto("/minha-conta");
    await abrir(page);
    const hrefs = await menuPrincipal(page)
      .locator("a[href]")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(8);
    for (const h of hrefs) {
      const resp = await page.request.get(h);
      expect(resp.status(), `${papel} ${h}`).toBe(200);
    }
    if (papel === "admin") expect(hrefs.some((h) => h.startsWith("/administracao"))).toBe(true);
  });
}

test("sem rolagem horizontal em 360 e 414 px (menu fechado e aberto)", async ({ page }) => {
  exigirConta("dono");
  await entrar(page, "dono");
  for (const w of [360, 414]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const rota of ["/meus-perfis", "/minha-conta", "/pontos", "/avisos"]) {
      await page.goto(rota);
      const sobra = () =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await sobra(), `${w} ${rota}`).toBeLessThanOrEqual(0);
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await menuPrincipal(page).waitFor({ state: "visible" });
      expect(await sobra(), `${w} ${rota} aberto`).toBeLessThanOrEqual(0);
    }
  }
});

test("teclado: setas, Home, End, Tab preso, Esc devolve foco", async ({ page }, info) => {
  exigirConta("dono");
  await entrar(page, "dono");
  await page.goto("/meus-perfis");
  const nav = menuPrincipal(page);
  const celular = info.project.name === "celular";
  const botao = page.getByRole("button", { name: "Abrir menu" });
  if (celular) {
    await botao.click();
    await page.waitForTimeout(500);
    // Foco inicial na gaveta: cobre o teste "foco vai para dentro da gaveta ao abrir" abaixo.
    await page.getByRole("button", { name: "Fechar menu" }).focus();
  }
  const resumos = nav.locator("summary");
  await resumos.first().focus();
  await page.keyboard.press("End");
  const ultimo = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(ultimo).toBeTruthy();
  const focoVisivelNoMenu = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && !!el.closest(".painel-lateral") && el.getClientRects().length > 0;
    });
  await page.keyboard.press("Home");
  expect(await focoVisivelNoMenu(), "Home deve levar a um elemento visível do menu").toBe(true);
  await page.keyboard.press("ArrowDown");
  expect(await focoVisivelNoMenu()).toBe(true);
  await resumos.first().focus();
  await page.keyboard.press("ArrowUp");
  expect(await focoVisivelNoMenu(), "ArrowUp no primeiro grupo não pode perder o foco").toBe(true);
  await resumos.first().focus();
  // foco visível: contorno não nulo
  const contorno = await resumos.first().evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).not.toBe("none");
  if (celular) {
    await page.keyboard.press("End");
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(() => !!document.activeElement?.closest(".painel-lateral"));
    expect(dentro).toBe(true);
    await page.keyboard.press("Escape");
    await expect(botao).toBeFocused();
    expect(await botao.getAttribute("aria-expanded")).toBe("false");
  }
});

test("alvos >= 44 px e contraste AA do item ativo", async ({ page }, info) => {
  exigirConta("dono");
  await entrar(page, "dono");
  await page.goto("/meus-perfis");
  await abrir(page);
  const nav = menuPrincipal(page);
  for (const el of await nav.locator("summary, a[href]:visible, button").all()) {
    if (!(await el.isVisible())) continue;
    const c = await el.boundingBox();
    expect(c?.height ?? 0, await el.innerText()).toBeGreaterThanOrEqual(43.5);
  }
  const ativo = nav.locator('a[aria-current="page"]');
  await expect(ativo).toHaveCount(1);
  const [fg, bg] = await ativo.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor];
  });
  const lum = (rgb: string) => {
    const [r, g, b] = (rgb.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
  expect((a + 0.05) / (b + 0.05), `${info.project.name} ${fg} sobre ${bg}`).toBeGreaterThanOrEqual(
    4.5,
  );
});

test("celular: ao abrir a gaveta pelo teclado o foco vai para dentro dela", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "celular", "Só há gaveta no celular.");
  exigirConta("dono");
  await entrar(page, "dono");
  await page.goto("/meus-perfis");
  const botao = page.getByRole("button", { name: "Abrir menu" });
  await botao.focus();
  await page.keyboard.press("Enter");
  await expect(menuPrincipal(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toBeFocused();
});

test("celular: gaveta fechada fica fora do alcance do foco e do leitor de tela", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "celular", "Só há gaveta no celular.");
  exigirConta("dono");
  await entrar(page, "dono");
  await page.goto("/meus-perfis");
  // Fechada: sai da árvore de acessibilidade (getByRole não a encontra), visibility hidden, Tab não entra.
  await expect(menuPrincipal(page)).toHaveCount(0);
  const nav = page.locator('nav[aria-label="Principal"]');
  const visib = await nav.evaluate((el) => getComputedStyle(el).visibility);
  expect(visib).toBe("hidden");
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(
      () => !!document.activeElement?.closest('nav[aria-label="Principal"]'),
    );
    expect(dentro, "foco não pode cair na gaveta fechada").toBe(false);
  }
});
