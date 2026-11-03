/**
 * Fase 10 · revisão do imóvel pelo administrador (IM-097, IM-098, IM-021, IM-029) no DEV.
 * O dono cria um imóvel com 2 fotos adicionais e o envia; o administrador vê na fila o selo "Imóvel" (não "Produto ou
 * serviço") e, na tela de revisão, as fotos adicionais; rejeita com motivo (nada vai ao ar). Restaura: Loja volta ao
 * estado inicial. Resíduo no DEV: 1 item de imóvel rejeitado "E2E Revisão fotos ..." (sem exclusão pela interface).
 * Contas E2E_* do .env.local; sem service_role; rodar com --workers=1.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { credenciais, exigirConta } from "./contas";
import { gerarPng } from "./png";

const SLUG = "perfil-1";
const SUFIXO = Date.now().toString(36);
const ctxs: BrowserContext[] = [];
const estado = { perfilId: "", perfilNome: "", itemNome: "", lojaInicial: false };
let dono: Page;
let admin: Page;

async function entrarComEspera(page: Page, papel: "dono" | "admin") {
  const { email, senha } = credenciais(papel);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/^(?!.*\/entrar)/, { timeout: 90_000 });
}

function cartaoDoPerfil(pagina: Page) {
  return pagina.locator('li[data-testid="perfil-loja"]', { hasText: estado.perfilNome }).first();
}

async function abrirAdminLoja(pagina: Page) {
  await pagina.goto(`/administracao/loja?busca=${encodeURIComponent(estado.perfilNome)}`);
  await expect(cartaoDoPerfil(pagina)).toBeVisible({ timeout: 60_000 });
}

async function definirLoja(pagina: Page, liberar: boolean) {
  await abrirAdminLoja(pagina);
  const cartao = cartaoDoPerfil(pagina);
  const jaLiberada = (await cartao.getByText("Loja liberada", { exact: true }).count()) > 0;
  if (jaLiberada === liberar) return;
  await cartao
    .getByLabel(/Motivo para/)
    .fill(`E2E Fase 10: ${liberar ? "liberar" : "retirar"} a Loja para teste`);
  await cartao.getByRole("button", { name: liberar ? "Liberar a Loja" : "Retirar a Loja" }).click();
  await expect(
    cartao.getByText(liberar ? "Loja liberada para o perfil." : "Loja retirada do perfil."),
  ).toBeVisible({ timeout: 60_000 });
}

async function enviarFotos(
  pagina: Page,
  grupo: string,
  quantas: number,
  cor: [number, number, number],
) {
  const campo = pagina.getByRole("group", { name: grupo, exact: true });
  const arquivos = Array.from({ length: quantas }, (_, i) => ({
    name: `e2e-${i}.png`,
    mimeType: "image/png",
    buffer: gerarPng(320 + i * 10, 240, cor),
  }));
  await campo.locator('input[type="file"]').setInputFiles(arquivos);
  await expect(campo.locator("ul.lista-imagens li")).toHaveCount(quantas, { timeout: 90_000 });
}

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.describe("Fase 10 · revisão do imóvel com fotos adicionais (DEV)", () => {
  test.beforeAll(async ({ browser }, info) => {
    test.setTimeout(240_000);
    if (!process.env.E2E_DONO_EMAIL || !process.env.E2E_ADMIN_EMAIL) return;
    for (const papel of ["dono", "admin"] as const) {
      const ctx = await browser.newContext({ ...info.project.use });
      ctxs.push(ctx);
      const pagina = await ctx.newPage();
      pagina.setDefaultTimeout(60_000);
      pagina.setDefaultNavigationTimeout(120_000);
      await entrarComEspera(pagina, papel);
      if (papel === "dono") dono = pagina;
      else admin = pagina;
    }
    estado.itemNome = `E2E Revisão fotos ${info.project.name} ${SUFIXO}`;
  });

  test.afterAll(async () => {
    test.setTimeout(240_000);
    try {
      if (admin && estado.perfilNome) await definirLoja(admin, estado.lojaInicial);
    } finally {
      for (const c of ctxs) await c.close();
      ctxs.length = 0;
    }
  });

  test.beforeEach(() => {
    exigirConta("dono");
    exigirConta("admin");
  });

  test("o administrador vê o selo Imóvel na fila e as 2 fotos adicionais na revisão", async ({
    browser,
    baseURL,
  }) => {
    await dono.goto("/meus-perfis");
    const hrefs = await dono
      .locator('a[href^="/meus-perfis/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    estado.perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    const ctxAnon = await browser.newContext({ baseURL: baseURL! });
    const anon = await ctxAnon.newPage();
    await anon.goto(`/perfil/${SLUG}`);
    estado.perfilNome = (await anon.locator("#titulo-perfil").innerText()).trim();
    await ctxAnon.close();

    await abrirAdminLoja(admin);
    estado.lojaInicial =
      (await cartaoDoPerfil(admin).getByText("Loja liberada", { exact: true }).count()) > 0;
    await definirLoja(admin, true);

    await dono.goto(`/meus-itens/novo?perfil=${estado.perfilId}`);
    await expect(dono.getByLabel("Tipo", { exact: true })).toBeVisible({ timeout: 60_000 });
    await dono.getByLabel("Tipo", { exact: true }).selectOption("imovel");
    await dono.getByLabel("Nome", { exact: true }).fill(estado.itemNome);
    await dono.getByLabel("Descrição", { exact: true }).fill("Imóvel de teste da revisão.");
    await dono.getByLabel("Categoria principal").selectOption({ index: 1 });
    await dono.getByLabel("Preço", { exact: true }).selectOption("fixo");
    await dono.getByLabel(/Valor \(R\$\)/).fill("1.800,00");
    await dono.getByLabel("Tipo do imóvel").selectOption("casa");
    await dono.getByLabel("Finalidade").selectOption("aluguel");
    await dono.getByLabel("Bairro").fill("Centro");
    await dono.getByLabel("Cidade", { exact: true }).fill("Marília");
    await dono.getByLabel("UF", { exact: true }).selectOption("SP");
    await dono.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(dono).toHaveURL(/\/meus-itens\/[0-9a-f-]{36}\?aviso=criado/, { timeout: 90_000 });
    const itemId = new URL(dono.url()).pathname.split("/")[2]!;

    await enviarFotos(dono, "Foto", 1, [40, 130, 90]);
    await dono.getByRole("button", { name: "Salvar foto", exact: true }).click();
    await expect(dono.getByText(/Foto salva|Edição salva como rascunho/)).toBeVisible();
    await enviarFotos(dono, "Fotos adicionais", 2, [200, 120, 40]);
    await dono.getByRole("button", { name: "Salvar fotos adicionais" }).click();
    await expect(
      dono.getByText(/Fotos adicionais salvas|Edição salva como rascunho/),
    ).toBeVisible();

    await dono.goto(`/meus-itens/${itemId}/previa`);
    await dono.getByRole("button", { name: "Enviar para aprovação" }).click();
    await expect(dono.getByText(/Enviado para aprovação|já foi enviada/).first()).toBeVisible();

    // Fila: selo "Imóvel".
    await admin.goto("/administracao/revisao");
    const cartao = admin.locator("li.cartao", { hasText: estado.itemNome }).first();
    await expect(cartao.getByText("Imóvel", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(cartao.getByText("Produto ou serviço")).toHaveCount(0);
    await cartao.getByRole("link").click();
    await expect(admin).toHaveURL(/\/administracao\/revisao\/item\/[0-9a-f-]{36}$/, {
      timeout: 60_000,
    });

    // Revisão: as 2 fotos adicionais aparecem (IM-097).
    const galeria = admin.getByLabel(`Mais fotos de ${estado.itemNome}`);
    await expect(galeria).toBeVisible();
    const imgs = galeria.getByRole("img");
    await expect(imgs).toHaveCount(2);
    for (const img of await imgs.all()) {
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0))
        .toBe(true);
    }

    // Rejeita com motivo: nada vai ao ar.
    await admin.getByLabel("Motivo da rejeição").fill("E2E: teste de revisão, rejeitado.");
    await admin.getByRole("button", { name: "Rejeitar", exact: true }).click();
    await expect(admin).toHaveURL(/\/administracao\/revisao/, { timeout: 60_000 });
    await expect(admin.getByText("Rejeitado.")).toBeVisible();

    // O dono vê o item rotulado "Imóvel" em Minhas revisões.
    await dono.goto("/minhas-revisoes");
    const rev = dono.locator("li.cartao", { hasText: estado.itemNome }).first();
    await expect(rev.getByText("Imóvel", { exact: true })).toBeVisible();
  });
});
