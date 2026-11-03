/**
 * Fase 9 · carrosséis da home e edição pelo administrador (IM-095, IM-096, D-018) no DEV.
 * - Anônimo: cada carrossel é uma região nomeada com ao menos um card; seção sem itens suficientes não aparece.
 * - Teclado e botões: rótulos, foco, setas e Enter rolam a faixa (ou ficam desabilitados quando tudo cabe).
 * - Administrador geral edita o mínimo e o título da "Novidades", vê a mudança na home e restaura tudo no final.
 * Sem service_role. As alterações de teste usam motivo "E2E ..." e são desfeitas (a auditoria registra as duas).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { entrar, exigirConta, nomesFaltando } from "./contas";

/**
 * No DEV a "Novidades" só aparece com 4 perfis publicados. Para exercitar o carrossel o administrador baixa o mínimo
 * da seção para 1 (com motivo) e, no fim, devolve o valor original. Sem conta de administrador, os testes de
 * interação se pulam sozinhos quando não há carrossel. Rode com --workers=1 (os dois projetos mexem na mesma seção).
 */
async function ajustarMinimoNovidades(
  browser: Browser,
  minimo: string | null,
  motivo: string,
): Promise<string | null> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await entrar(page, "admin");
    await page.goto("/administracao/home");
    const c = page.locator('[data-secao="novidades"]');
    await c.getByText("Editar", { exact: true }).click();
    const campo = c.getByLabel(/Mínimo de itens/);
    const atual = await campo.inputValue();
    if (minimo === null || minimo === atual) return atual;
    await campo.fill(minimo);
    await c.getByLabel("Motivo da alteração").fill(motivo);
    await c.getByRole("button", { name: "Salvar seção" }).click();
    await expect(c.getByRole("status").filter({ hasText: "Seção atualizada." })).toBeVisible();
    return atual;
  } finally {
    await ctx.close();
  }
}

const regioes = (page: Page) => page.locator('.secoes-home [role="region"][aria-label]');

async function carrosselExemplo(page: Page) {
  await page.goto("/");
  const lista = regioes(page);
  test.skip((await lista.count()) === 0, "Sem seção com itens suficientes no DEV agora.");
  return lista.first();
}

test.describe("home · carrosséis (anônimo)", () => {
  let minimoOriginal: string | null = null;
  test.beforeAll(async ({ browser }) => {
    if (nomesFaltando("admin").length > 0) return;
    minimoOriginal = await ajustarMinimoNovidades(browser, "1", "E2E: exibir carrossel nos testes");
  });
  test.afterAll(async ({ browser }) => {
    if (minimoOriginal !== null) {
      await ajustarMinimoNovidades(browser, minimoOriginal, "E2E: restaurar valores originais");
    }
  });

  test("cada carrossel é região nomeada, tem cards e não há seção vazia", async ({ page }) => {
    const problemas: string[] = [];
    page.on("console", (m) => m.type() === "error" && problemas.push(m.text()));
    page.on("pageerror", (e) => problemas.push(e.message));
    await page.goto("/");
    const titulos = await page.locator(".secoes-home .secao-home h2").allInnerTexts();
    const nomes = await regioes(page).evaluateAll((rs) =>
      rs.map((r) => r.getAttribute("aria-label")),
    );
    expect(nomes).toEqual(titulos);
    for (const r of await regioes(page).all()) {
      expect(await r.locator("li").count()).toBeGreaterThan(0);
    }
    // "Na sua cidade" não aparece para visitante sem cidade (D-018).
    await expect(page.getByRole("region", { name: "Na sua cidade" })).toHaveCount(0);
    // Sem erro de console nem de hidratação.
    expect(problemas).toEqual([]);
  });

  test("botões e região são acessíveis pelo teclado", async ({ page }) => {
    const regiao = await carrosselExemplo(page);
    const nome = (await regiao.getAttribute("aria-label"))!;
    const anterior = page.getByRole("button", { name: `${nome}: ver anteriores` });
    const proximo = page.getByRole("button", { name: `${nome}: ver próximos` });
    await expect(anterior).toBeVisible();
    await expect(proximo).toBeVisible();
    for (const b of [anterior, proximo]) {
      const caixa = (await b.boundingBox())!;
      expect(caixa.width).toBeGreaterThanOrEqual(44);
      expect(caixa.height).toBeGreaterThanOrEqual(44);
    }
    // Sem rotação automática: a posição não muda sozinha.
    const antes = await regiao.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(1500);
    expect(await regiao.evaluate((el) => el.scrollLeft)).toBe(antes);

    const sobra = await regiao.evaluate((el) => el.scrollWidth - el.clientWidth);
    if (sobra > 8) {
      await expect(proximo).toHaveAttribute("aria-disabled", "false");
      await proximo.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => regiao.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await expect(anterior).toHaveAttribute("aria-disabled", "false");
      // Setas do teclado na região focada.
      await regiao.focus();
      await expect(regiao).toBeFocused();
      const posicao = await regiao.evaluate((el) => el.scrollLeft);
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => regiao.evaluate((el) => el.scrollLeft)).toBeLessThan(posicao);
    } else {
      // Tudo cabe na tela: botões sem efeito, avisados como desabilitados.
      await expect(proximo).toHaveAttribute("aria-disabled", "true");
      await expect(anterior).toHaveAttribute("aria-disabled", "true");
      await regiao.focus();
      await expect(regiao).toBeFocused();
    }
  });

  test("com reduzir movimento a rolagem não anima", async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 360, height: 740 },
    });
    const page = await ctx.newPage();
    const regiao = await carrosselExemplo(page);
    const nome = (await regiao.getAttribute("aria-label"))!;
    const sobra = await regiao.evaluate((el) => el.scrollWidth - el.clientWidth);
    test.skip(sobra <= 8, "Itens cabem na tela; nada para rolar.");
    await page.getByRole("button", { name: `${nome}: ver próximos` }).click();
    await expect
      .poll(() => regiao.evaluate((el) => el.scrollLeft), { timeout: 1000 })
      .toBeGreaterThan(0);
    await ctx.close();
  });

  test("celular 360px: card de largura fixa, dica do próximo e sem rolagem da página", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    const regiao = await carrosselExemplo(page);
    const cards = regiao.locator("li");
    const primeiro = (await cards.first().boundingBox())!;
    expect(primeiro.width).toBeLessThanOrEqual(240);
    if ((await cards.count()) > 1) {
      const segundo = (await cards.nth(1).boundingBox())!;
      expect(segundo.x).toBeLessThan(360); // o próximo aparece, mesmo cortado
    }
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(360);
    await ctx.close();
  });
});

test.describe("administração · seções da home (DEV)", () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Fluxo administrativo: só no desktop.");
    exigirConta("admin");
  });

  test("lista as cinco seções, edita título e mínimo, vê na home e restaura", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/administracao/home");
    await expect(
      page.getByRole("heading", { level: 1, name: "Seções da página inicial" }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Seções da página inicial/);
    await expect(page.locator("ul.lista-cartoes > li")).toHaveCount(5);

    const cartao = page.locator('[data-secao="novidades"]');
    await cartao.getByText("Editar", { exact: true }).click();
    const original = {
      titulo: await cartao.getByLabel("Título da seção").inputValue(),
      ativa: await cartao.getByLabel("Situação").inputValue(),
      minimo: await cartao.getByLabel(/Mínimo de itens/).inputValue(),
    };

    async function salvar(v: { titulo: string; ativa: string; minimo: string; motivo: string }) {
      await page.goto("/administracao/home");
      const c = page.locator('[data-secao="novidades"]');
      await c.getByText("Editar", { exact: true }).click();
      await c.getByLabel("Título da seção").fill(v.titulo);
      await c.getByLabel("Situação").selectOption(v.ativa);
      await c.getByLabel(/Mínimo de itens/).fill(v.minimo);
      await c.getByLabel("Motivo da alteração").fill(v.motivo);
      await c.getByRole("button", { name: "Salvar seção" }).click();
      await expect(c.getByRole("status").filter({ hasText: "Seção atualizada." })).toBeVisible();
    }

    const naHome = async (nome: string) => {
      await page.goto("/");
      return page.getByRole("region", { name: nome }).count();
    };

    try {
      // Motivo obrigatório: mensagem clara, sem enviar.
      await cartao.getByLabel("Motivo da alteração").fill("");
      await cartao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(cartao.getByText("Informe o motivo.")).toBeVisible();

      const novoTitulo = `Novidades E2E ${Date.now().toString(36).slice(-4)}`;
      await salvar({
        titulo: novoTitulo,
        ativa: "true",
        minimo: "1",
        motivo: "E2E: teste da edição",
      });
      await expect.poll(() => naHome(novoTitulo), { timeout: 30_000 }).toBe(1);
      await expect(page.getByRole("heading", { level: 2, name: novoTitulo })).toBeVisible();

      // Desativar a seção a tira da home.
      await salvar({ titulo: novoTitulo, ativa: "false", minimo: "1", motivo: "E2E: desativar" });
      await expect.poll(() => naHome(novoTitulo), { timeout: 30_000 }).toBe(0);
    } finally {
      await salvar({ ...original, motivo: "E2E: restaurar valores originais" });
    }
  });
});

test.describe("administração · acesso (DEV)", () => {
  test("visitante é levado a entrar", async ({ page }) => {
    await page.goto("/administracao/home");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("dono (não administrador geral) recebe 404", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Só no desktop.");
    exigirConta("dono");
    await entrar(page, "dono");
    const r = await page.goto("/administracao/home");
    expect(r?.status()).toBe(404);
  });
});
