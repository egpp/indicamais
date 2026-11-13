/**
 * Mapa do OpenStreetMap na seção Localização (D-016; IM-018, IM-092). Só ambiente de DESENVOLVIMENTO.
 * Página pública: sem WhatsApp, e-mail nem conta no HTML; iframe (quando houver) só de openstreetmap.org; sem rolagem
 * horizontal. Painel e prévia dos 5 estilos exigem E2E_DONO_* (puladas sem as contas). Capturas em test-results/mapa/.
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

async function primeiroPerfilPublicado(page: Page): Promise<string | null> {
  await page.goto("/");
  const link = page.locator('a.card-link[href^="/perfil/"]').first();
  if ((await link.count()) === 0) return null;
  return await link.getAttribute("href");
}

async function semRolagemHorizontal(page: Page) {
  const r = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(r, "rolagem horizontal").toBe(false);
}

test.describe("mapa na página pública", () => {
  test("HTML sem dado privado, iframe só do OpenStreetMap e sem rolagem horizontal", async ({
    page,
  }, info) => {
    const href = await primeiroPerfilPublicado(page);
    test.skip(!href, "Sem perfil publicado no ambiente de desenvolvimento.");
    const resposta = await page.goto(href as string);
    const html = (await resposta?.text()) ?? "";
    expect(html).not.toMatch(/wa\.me|api\.whatsapp|mailto:|conta_id|responsavel_id/i);
    // Texto visível: nenhum e-mail (o HTML bruto traz código de desenvolvimento com "@").
    expect(await page.locator("body").innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);

    const frames = await page.locator("iframe").evaluateAll((els) =>
      els.map((e) => ({
        src: e.getAttribute("src") ?? "",
        loading: e.getAttribute("loading"),
        referrer: e.getAttribute("referrerpolicy"),
        titulo: e.getAttribute("title") ?? "",
      })),
    );
    for (const f of frames) {
      expect(new URL(f.src).origin).toBe("https://www.openstreetmap.org");
      expect(f.loading).toBe("lazy");
      expect(f.referrer).toBe("no-referrer");
      expect(f.titulo).toMatch(/^Mapa da localização de /);
    }
    const secao = page.locator("#localizacao");
    if ((await secao.count()) > 0) {
      await secao.scrollIntoViewIfNeeded();
      await secao.screenshot({ path: `test-results/mapa/${info.project.name}/publica.png` });
      if (frames.length > 0) {
        await expect(secao.getByRole("link", { name: /Ver mapa maior/ })).toHaveAttribute(
          "rel",
          "noopener noreferrer",
        );
      }
    }
    await semRolagemHorizontal(page);
  });
});

test.describe("responsável: seção Mapa e prévia dos estilos", () => {
  test("painel mostra o estado, os avisos e alvos de toque de 44px", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/aparencia");
    if (!/\/meus-perfis\//.test(page.url()))
      await page.locator('main a[href$="/aparencia"]').first().click();
    await expect(page).toHaveURL(/\/meus-perfis\/([0-9a-f-]{36})\/aparencia$/, { timeout: 15000 });
    const id = /\/meus-perfis\/([0-9a-f-]{36})\//.exec(page.url())![1];
    await page.goto(`/meus-perfis/${id}`);
    const secao = page.getByRole("region", { name: "Mapa" });
    await expect(secao).toBeVisible();
    await expect(secao.getByText(/depois que a versão do site for aprovada/)).toBeVisible();
    await expect(secao.getByText(/fornecido pelo OpenStreetMap/).first()).toBeVisible();
    const chave = secao.getByRole("switch");
    await expect(chave).toBeVisible();
    const caixa = await chave.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(43.5);
    await semRolagemHorizontal(page);
  });

  for (const estilo of ESTILOS) {
    test(`captura da seção Localização no estilo ${estilo}`, async ({ page }, info) => {
      exigirConta("dono");
      await entrar(page, "dono");
      await page.goto("/aparencia");
      if (!/\/meus-perfis\//.test(page.url()))
        await page.locator('main a[href$="/aparencia"]').first().click();
      await expect(page).toHaveURL(/\/meus-perfis\/([0-9a-f-]{36})\/aparencia$/, {
        timeout: 15000,
      });
      const id = /\/meus-perfis\/([0-9a-f-]{36})\//.exec(page.url())![1];
      await page.goto(`/meus-perfis/${id}/previa?estilo=${estilo}`);
      const secao = page.locator("#localizacao");
      test.skip(
        (await secao.count()) === 0,
        "Perfil de teste sem endereço: sem seção Localização.",
      );
      await secao.scrollIntoViewIfNeeded();
      await secao.screenshot({
        path: `test-results/mapa/${info.project.name}/${estilo}.png`,
      });
      for (const f of await page
        .locator("iframe")
        .evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? "")))
        expect(new URL(f).origin).toBe("https://www.openstreetmap.org");
      await semRolagemHorizontal(page);
    });
  }
});
