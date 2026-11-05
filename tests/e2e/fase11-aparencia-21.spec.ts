/**
 * Verificação da liberação dos estilos 6 a 21 no dev (IM-091, IM-100): a tela Aparência do responsável lista os 21
 * estilos e permite salvar um dos novos. Só DESENVOLVIMENTO. O estilo original do perfil de teste é restaurado no fim.
 */
import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const NOVOS: [string, string][] = [
  ["cafe_padaria", "Café"],
  ["moto_bike", "Moto e Bike"],
  ["premium", "Premium"],
];

async function abrirAparencia(page: Page) {
  await page.goto("/aparencia");
  if (!/\/meus-perfis\//.test(page.url()))
    await page.locator('main a[href$="/aparencia"]').first().click();
  await expect(page).toHaveURL(/\/meus-perfis\/[0-9a-f-]{36}\/aparencia$/, { timeout: 15000 });
}

test("Aparência lista os 21 estilos e salva um novo (moto_bike), devolvendo o original", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Um projeto basta; grava no perfil de teste.");
  test.setTimeout(120_000);
  exigirConta("dono");
  await entrar(page, "dono");
  await abrirAparencia(page);

  await expect(page.locator("ul.grade-estilos > li")).toHaveCount(21);
  await expect(page.getByRole("button", { name: /^Em breve/ })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(21);
  for (const [, rotulo] of NOVOS)
    await expect(page.getByRole("radio", { name: new RegExp(rotulo) })).toBeEnabled();

  const original = (await page.getByText("Estilo atual:").locator("strong").innerText()).trim();
  try {
    await page.getByRole("radio", { name: /Moto e Bike/ }).check();
    await page.getByRole("button", { name: "Salvar estilo" }).click();
    await expect(page.getByText(/Estilo salvo/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Estilo atual:").locator("strong")).toHaveText("Moto e Bike");
  } finally {
    await abrirAparencia(page);
    await page.getByRole("radio", { name: new RegExp(`^${original}`) }).check();
    await page.getByRole("button", { name: "Salvar estilo" }).click();
    await expect(page.getByText(/Estilo salvo/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Estilo atual:").locator("strong")).toHaveText(original);
  }
});
