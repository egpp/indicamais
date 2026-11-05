import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 7, telas de comissões (IM-061 a IM-073, IM-065, IM-086). SOMENTE LEITURA, contra o DEV: as tabelas
// comissoes_* são só-inserção e permanentes, então nenhum formulário é enviado aqui. Não imprime credenciais nem dados.
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

async function noindex(page: Page) {
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
}

async function semRolagemHorizontal(page: Page) {
  const estoura = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(estoura).toBe(false);
}

test.describe("telas de comissões (somente leitura)", () => {
  test("sem login, as rotas levam à entrada", async ({ page }) => {
    for (const rota of ["/comissoes", "/administracao/comissoes"]) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/entrar/);
    }
  });

  test("indicador: vê Minhas comissões (R$, sem dado de cliente) e não vê a administração", async ({
    page,
  }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    const r = await page.goto("/comissoes");
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Minhas comissões" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Saldo de comissões" })).toBeVisible();
    await expect(page.getByText(/não cobra nem repassa dinheiro/i)).toBeVisible();
    await noindex(page);
    await semRolagemHorizontal(page);
    const texto = (await page.locator("main").innerText()) ?? "";
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // nenhum e-mail
    expect(texto).not.toMatch(/\+55|\(\d{2}\)\s?\d{4,5}-\d{4}/); // nenhum telefone
    const resp = await page.goto("/administracao/comissoes");
    expect(resp?.status()).toBe(404);
  });

  test("dono comum: sem administração; seção de comissões do perfil alheio não existe", async ({
    page,
  }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    const adm = await page.goto("/administracao/comissoes");
    expect(adm?.status()).toBe(404);
    const alheio = await page.goto(`/meus-perfis/${UUID_INEXISTENTE}/comissoes`);
    expect(alheio?.status()).toBe(404);
    const minhas = await page.goto("/comissoes");
    expect(minhas?.status()).toBe(200);
  });

  test("administrador: vê as ações manuais, sem cobrança nem repasse automático", async ({
    page,
  }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    const r = await page.goto("/administracao/comissoes");
    expect(r?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Comissões" })).toBeVisible();
    await noindex(page);
    await semRolagemHorizontal(page);
    await expect(page.getByText(/administrador confirma cada pagamento/i)).toBeVisible();
    // Prazo de inadimplência lido do banco (número de dias, não texto fixo).
    await expect(page.getByText(/Prazo de inadimplência atual:\s*\d+ dias/)).toBeVisible();
    const abas = page.getByRole("navigation", { name: "Seções de comissões" });
    for (const aba of ["Negócios", "Assinaturas", "Pagamentos", "Comissões", "Vínculos"]) {
      await abas.getByRole("link", { name: aba, exact: true }).click();
      await expect(abas.getByRole("link", { name: aba, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.locator("form[aria-label='Filtrar a lista']")).toBeVisible();
      await semRolagemHorizontal(page);
      // Nenhum campo de identificador digitado nas linhas das listas.
      await expect(page.locator("ul.lista-cartoes").getByLabel(/^Identificador/)).toHaveCount(0);
      // Nenhum botão de cobrança ou de pagamento automático.
      await expect(
        page.getByRole("button", { name: /cobrar|pagar agora|transferir/i }),
      ).toHaveCount(0);
    }
    // Filtro inválido na URL vira aviso em português, não erro técnico.
    await page.goto("/administracao/comissoes?aba=negocios&pagina=0");
    await expect(page.getByRole("alert")).toContainText("Página inválida.");
    // Só valida o formulário da primeira linha de negócios no navegador (nada é enviado): motivo vazio.
    await page.goto("/administracao/comissoes?aba=negocios");
    const abrir = page.locator("ul.lista-cartoes summary").first();
    if ((await abrir.count()) > 0) {
      await abrir.click();
      await page.locator("ul.lista-cartoes form").first().getByRole("button").click();
      await expect(
        page.getByText("O motivo precisa ter pelo menos 10 caracteres.").first(),
      ).toBeVisible();
    }
  });
});
