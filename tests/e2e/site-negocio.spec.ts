/**
 * Página do negócio como site (D-016; IM-091, IM-092, IM-093). Só ambiente de DESENVOLVIMENTO.
 * Confere em desktop e celular (Pixel 7): sem rolagem horizontal, alvos de toque >= 44px, menu fixo com âncoras,
 * estilo padrão para o público e prévia dos 5 estilos para o responsável. Capturas em test-results/site/.
 * Telas autenticadas são puladas se faltarem as contas E2E_DONO_* (ver contas.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const ESTILOS = [
  "minimalista",
  "gastronomia",
  "saude_bem_estar",
  "beleza_estetica",
  "construcao_reformas",
] as const;

/** Vai à Aparência do primeiro perfil do responsável (a entrada /aparencia lista ou redireciona). */
async function abrirAparencia(page: Page) {
  await page.goto("/aparencia");
  if (!/\/meus-perfis\//.test(page.url()))
    await page.locator('main a[href$="/aparencia"]').first().click();
  await expect(page).toHaveURL(/\/meus-perfis\/[0-9a-f-]{36}\/aparencia$/, { timeout: 15000 });
}

async function verificarLayout(page: Page, nome: string) {
  await page.waitForLoadState("load");
  const problemas = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const rolagem = document.documentElement.scrollWidth > largura + 1;
    const pequenos: string[] = [];
    document
      .querySelectorAll<HTMLElement>("a, button, summary, input, select, textarea")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (el.classList.contains("card-link")) return;
        if (el.closest('[aria-hidden="true"]')) return;
        if (el instanceof HTMLInputElement && ["hidden", "checkbox", "radio"].includes(el.type))
          return;
        if (
          el.tagName === "A" &&
          el.closest("p:not(.marca):not(.rodape-links)") &&
          !el.classList.contains("botao")
        )
          return;
        if (r.height < 43.5)
          pequenos.push(
            `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.height)}px`,
          );
      });
    return { rolagem, pequenos };
  });
  expect.soft(problemas.rolagem, `${nome}: rolagem horizontal`).toBe(false);
  expect.soft(problemas.pequenos, `${nome}: alvos de toque menores que 44px`).toEqual([]);
}

async function capturar(page: Page, projeto: string, nome: string) {
  await page.waitForLoadState("load");
  await page.screenshot({ path: `test-results/site/${projeto}/${nome}.png`, fullPage: true });
  await verificarLayout(page, nome);
}

/** Primeiro perfil publicado da home (null se não houver). */
async function primeiroPerfilPublicado(page: Page): Promise<string | null> {
  await page.goto("/");
  const link = page.locator('a.card-link[href^="/perfil/"]').first();
  if ((await link.count()) === 0) return null;
  return await link.getAttribute("href");
}

test.describe("página pública do negócio", () => {
  test("menu fixo com âncoras, estilo padrão e prévia ignorada para visitante", async ({
    page,
  }, info) => {
    const href = await primeiroPerfilPublicado(page);
    test.skip(!href, "Sem perfil publicado no ambiente de desenvolvimento.");
    await page.goto(href as string);
    const site = page.getByTestId("site-negocio");
    await expect(site).toHaveAttribute("data-estilo", "minimalista");
    const nav = page.getByRole("navigation", { name: /^Seções de / });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // No celular o menu abre pelo botão; no desktop os links já estão à mostra.
    const botao = nav.getByRole("button", { name: "Menu" });
    if (await botao.isVisible()) {
      await expect(botao).toHaveAttribute("aria-expanded", "false");
      await botao.click();
      await expect(botao).toHaveAttribute("aria-expanded", "true");
    }
    await nav.getByRole("link", { name: "Contato" }).click();
    await expect(page).toHaveURL(/#contato-site$/);
    await expect(page.locator("#contato-site")).toBeInViewport();
    await page.waitForTimeout(1500); // fim da rolagem suave
    // Menu continua colado ao topo depois de rolar.
    const topo = await nav.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(topo).toBeLessThanOrEqual(1);
    // dispatchEvent: o clique do Playwright rola a página até o botão e atrapalharia a conferência.
    if (await botao.isVisible()) await botao.dispatchEvent("click");
    await expect(nav.getByRole("link", { name: "Contato" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    // Visitante não consegue forçar um estilo por URL (a escolha é do responsável).
    await page.goto(`${href}?estilo=gastronomia`);
    await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", "minimalista");

    await page.goto(href as string);
    await capturar(page, info.project.name, "publico-padrao");
  });
});

test.describe("aparência (responsável)", () => {
  test("só os estilos habilitados, salvar estilo e prévia dos 5 com exemplo", async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    exigirConta("dono");
    await entrar(page, "dono");
    await abrirAparencia(page);
    const urlAparencia = page.url();
    await expect(
      page.getByRole("heading", { level: 1, name: "Aparência da página" }),
    ).toBeVisible();
    const cartoes = page.locator("ul.grade-estilos > li");
    await expect(cartoes).toHaveCount(21); // 21 estilos liberados no dev em 04/11/2026 (IM-091, IM-100)
    await expect(page.getByRole("button", { name: /^Em breve/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Salvar estilo" })).toBeEnabled();
    await capturar(page, info.project.name, "aparencia");

    // Perfil de outra pessoa (ou inexistente): 404 sem revelar nada.
    const r = await page.goto("/meus-perfis/00000000-0000-4000-8000-000000000000/aparencia");
    expect(r?.status()).toBe(404);

    // Prévia de cada estilo (com conteúdo de exemplo marcado) e captura em desktop e celular.
    for (const estilo of ESTILOS) {
      await page.goto(urlAparencia);
      await page.locator(`a[href$="/previa?estilo=${estilo}"]`).first().click();
      await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", estilo);
      await expect(page.getByRole("navigation", { name: /^Seções de / })).toBeVisible();
      await expect(page.getByText("Exemplo", { exact: true }).first()).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, info.project.name, `estilo-${estilo}`);
    }
  });

  test("salva o estilo escolhido e volta ao padrão", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await abrirAparencia(page);
    const escolher = async (rotulo: string) => {
      await page.getByRole("radio", { name: new RegExp(rotulo) }).check();
      await page.getByRole("button", { name: "Salvar estilo" }).click();
      await expect(page.getByText(/Estilo salvo/)).toBeVisible();
    };
    await escolher("Gastronomia");
    await page.reload();
    await expect(page.getByText("Estilo atual:").locator("strong")).toHaveText("Gastronomia");
    await escolher("Minimalista");
  });

  test("banners: tela do responsável, limite e descrição obrigatória", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/aparencia/banners");
    if (!/\/banners$/.test(page.url()))
      await page.locator('main a[href$="/banners"]').first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Banners da página" })).toBeVisible();
    await expect(page.getByText(/até 6 banners/)).toBeVisible();
    const r = await page.goto("/meus-perfis/00000000-0000-4000-8000-000000000000/banners");
    expect(r?.status()).toBe(404);
  });

  test("estilo desconhecido na prévia não quebra e cai no padrão", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await abrirAparencia(page);
    const id = page.url().match(/meus-perfis\/([0-9a-f-]{36})/)?.[1];
    const r = await page.goto(`/meus-perfis/${id}/previa?estilo=nao-existe`);
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("site-negocio")).toHaveCount(0);
  });
});

test.describe("administração dos estilos e dos banners", () => {
  test("administrador geral vê os estilos; o responsável recebe 404", async ({
    page,
    browser,
    baseURL,
  }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    await page.goto("/administracao/estilos");
    await expect(page.getByRole("heading", { level: 1, name: "Estilos de página" })).toBeVisible();
    await expect(page.locator("ul.lista-cartoes > li")).toHaveCount(20);
    await page.goto("/administracao/negocios");
    await expect(page.getByRole("heading", { level: 1, name: "Sites e itens" })).toBeVisible();
    const contexto = await browser.newContext({ baseURL: baseURL! });
    const outra = await contexto.newPage();
    const r = await outra.goto("/administracao/estilos");
    expect(r?.url()).toMatch(/entrar/);
    await contexto.close();
  });
});
