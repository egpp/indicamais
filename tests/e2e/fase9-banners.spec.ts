/**
 * Fase 9 · estilo e banners (IM-091, IM-093, IM-094) no DEV. Dono escolhe Gastronomia; administrador envia dois banners
 * (PNG gerado no teste) à empresa do dono; o dono vê o aviso no sino, recusa um (motivo obrigatório) e aceita o outro, que
 * passa a aparecer na página pública. Ao final volta o estilo a Minimalista e oculta o banner aceito. Só desktop, serial.
 * Dados com prefixo "E2E ". Sem service_role.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";
import { gerarPng } from "./png";

const SLUG = "perfil-1";
const SUFIXO = Date.now().toString(36);
const ALT_ACEITO = `E2E banner aceito ${SUFIXO}`;
const ALT_RECUSADO = `E2E banner recusado ${SUFIXO}`;
const FOTO = (n: string) => `test-results/fase9/${n}.png`;

const sessoes: { dono?: Page; admin?: Page; anon?: Page; ctxs: BrowserContext[] } = { ctxs: [] };
let perfilId = "";

async function abrir(browser: Browser, papel?: "dono" | "admin"): Promise<Page> {
  const ctx = await browser.newContext();
  sessoes.ctxs.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  if (papel) await entrar(page, papel);
  return page;
}

async function naoLidasNoSino(page: Page): Promise<number> {
  const sino = page.locator('a.sino[href="/avisos"]').first();
  await expect(sino).toBeVisible({ timeout: 30_000 });
  const m = /(\d+) avisos? não lidos?/.exec((await sino.getAttribute("aria-label")) ?? "");
  return m ? Number(m[1]) : 0;
}

test.describe.configure({ mode: "serial" });
test.describe("Fase 9 · estilo e banners (DEV)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "desktop") return;
    if (!process.env.E2E_DONO_EMAIL || !process.env.E2E_ADMIN_EMAIL) return;
    sessoes.dono = await abrir(browser, "dono");
    sessoes.admin = await abrir(browser, "admin");
    sessoes.anon = await abrir(browser);
  });
  test.afterAll(async () => {
    for (const c of sessoes.ctxs) await c.close();
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Fluxo de duas contas: só no desktop.");
    exigirConta("dono");
    exigirConta("admin");
  });

  test("B6.0 id do perfil do dono", async () => {
    const dono = sessoes.dono!;
    await dono.goto("/meus-perfis");
    const hrefs = await dono
      .locator('a[href^="/meus-perfis/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    expect(perfilId).toBeTruthy();
  });

  test("B6.1 dono salva o estilo Gastronomia e a página pública usa", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}/aparencia`);
    await dono.getByRole("radio", { name: /Gastronomia/ }).check();
    await dono.getByRole("button", { name: "Salvar estilo" }).click();
    await expect
      .poll(
        async () => {
          await dono.goto(`/meus-perfis/${perfilId}/aparencia`);
          return dono.getByText("Estilo atual:").locator("strong").innerText();
        },
        { timeout: 30_000 },
      )
      .toBe("Gastronomia");
    await dono.screenshot({ path: FOTO("b6-estilo-gastronomia-painel") });
    const anon = sessoes.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator("[data-estilo]").first()).toHaveAttribute(
      "data-estilo",
      "gastronomia",
    );
    await anon.screenshot({ path: FOTO("b6-pagina-publica-gastronomia"), fullPage: true });
  });

  test("B6.2 administrador envia dois banners à empresa do dono; dono vê aviso no sino", async () => {
    const admin = sessoes.admin!;
    const dono = sessoes.dono!;
    await dono.goto("/pontos");
    const antes = await naoLidasNoSino(dono);

    const cores: [string, [number, number, number]][] = [
      [ALT_RECUSADO, [200, 60, 60]],
      [ALT_ACEITO, [40, 130, 90]],
    ];
    for (const [alt, cor] of cores) {
      await admin.goto(`/administracao/negocios/${perfilId}/banners`);
      await admin.locator('input[type="file"]').setInputFiles({
        name: "banner-e2e.png",
        mimeType: "image/png",
        buffer: gerarPng(640, 200, cor),
      });
      await expect(admin.getByRole("img", { name: "Imagem escolhida para o banner" })).toBeVisible({
        timeout: 45_000,
      });
      await admin.getByLabel("Descrição da imagem").fill(alt);
      await admin.getByLabel("Ao tocar, levar para (opcional)").selectOption("contato");
      await admin
        .getByLabel("Motivo (fica na auditoria)")
        .fill("E2E Fase 9: banner de teste da verificação");
      await admin.getByRole("button", { name: "Enviar ao responsável" }).click();
      await expect(admin.getByText("Banner enviado ao responsável.")).toBeVisible({
        timeout: 45_000,
      });
    }
    await admin.goto(`/administracao/negocios/${perfilId}/banners`);
    // A lista do administrador mostra situação e destino (não repete o texto alternativo).
    expect(await admin.getByText("Aguardando aceite").count()).toBeGreaterThanOrEqual(2);
    await admin.screenshot({ path: FOTO("b6-admin-banners-enviados") });

    await dono.goto("/pontos");
    expect(await naoLidasNoSino(dono)).toBeGreaterThanOrEqual(antes + 2);
    await dono.screenshot({ path: FOTO("b6-sino-dono-banner") });
    await dono.goto("/avisos");
    const cartoes = dono.locator("li.cartao.aviso-nao-lido", {
      hasText: "Banner aguardando aceite",
    });
    expect(await cartoes.count()).toBeGreaterThanOrEqual(2);
    await expect(cartoes.first()).toContainText("aguarda o seu aceite no perfil perfil 1");
    await dono.screenshot({ path: FOTO("b6-avisos-banner") });
  });

  test("B6.3 dono recusa um (motivo obrigatório) e aceita o outro; o aceite fica registrado", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    const recusado = dono.locator("li.cartao", { hasText: ALT_RECUSADO });
    await expect(recusado).toBeVisible();
    // Recusar sem motivo: erro, nada muda.
    await recusado.getByRole("button", { name: "Recusar" }).click();
    await expect(recusado.locator(".erro-campo, [role=alert]").first()).toBeVisible();
    await expect(recusado).toBeVisible();
    await recusado
      .getByLabel("Motivo da recusa")
      .fill("E2E: imagem fora do padrão (recusa de teste)");
    await recusado.getByRole("button", { name: "Recusar" }).click();
    await expect(dono.locator("li.cartao", { hasText: ALT_RECUSADO })).toHaveCount(0, {
      timeout: 30_000,
    });

    const aceito = dono.locator("li.cartao", { hasText: ALT_ACEITO });
    await aceito.getByRole("button", { name: "Aceitar" }).click();
    await expect(
      dono.getByRole("heading", { name: "Banners do administrador que você aceitou" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await dono.screenshot({ path: FOTO("b6-dono-aceitou-banner") });

    // O aceite foi registrado: o banner aparece na lista "aceitos" do dono com o texto "Aparece na página.".
    await expect(
      dono.locator("li.cartao", { hasText: ALT_ACEITO }).getByText("Aparece na página."),
    ).toBeVisible();
  });

  // Defeito IM-093 (regex de caminho rejeitava adm-<uuid>) corrigido em src/shared/conteudo/imagens.ts.
  test("B6.3b banner aceito do administrador tem prévia para o dono e aparece na página pública (IM-094)", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    await expect(dono.locator("li.cartao", { hasText: ALT_ACEITO }).locator("img")).toHaveCount(1, {
      timeout: 5_000,
    });
    const anon = sessoes.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator(`img[alt="${ALT_ACEITO}"]`).first()).toBeAttached({ timeout: 5_000 });
    await expect(anon.locator(`img[alt="${ALT_RECUSADO}"]`)).toHaveCount(0);
  });

  test("B6.4 limpeza: estilo volta a Minimalista e o banner aceito é ocultado", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}/aparencia`);
    await dono.getByRole("radio", { name: /Minimalista/ }).check();
    await dono.getByRole("button", { name: "Salvar estilo" }).click();
    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    // Propostas de teste que sobraram de rodadas anteriores: recusa com motivo.
    for (let guarda = 0; guarda < 6; guarda++) {
      const sobra = dono.locator("li.cartao", { hasText: "E2E banner" }).filter({
        has: dono.getByRole("button", { name: "Recusar" }),
      });
      if ((await sobra.count()) === 0) break;
      await sobra.first().getByLabel("Motivo da recusa").fill("E2E: limpeza da verificação");
      await sobra.first().getByRole("button", { name: "Recusar" }).click();
      await dono.goto(`/meus-perfis/${perfilId}/banners`);
    }
    for (let guarda = 0; guarda < 8; guarda++) {
      const ocultar = dono.getByRole("button", { name: "Ocultar da página" });
      if ((await ocultar.count()) === 0) break;
      await ocultar.first().click();
      await dono.goto(`/meus-perfis/${perfilId}/banners`);
    }
    await expect(dono.getByRole("button", { name: "Ocultar da página" })).toHaveCount(0, {
      timeout: 30_000,
    });
    const anon = sessoes.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator("[data-estilo]").first()).toHaveAttribute(
      "data-estilo",
      "minimalista",
    );
    await expect(anon.locator('img[alt^="E2E banner"]')).toHaveCount(0);
    await anon.screenshot({ path: FOTO("b6-limpeza-publica"), fullPage: true });
  });
});
