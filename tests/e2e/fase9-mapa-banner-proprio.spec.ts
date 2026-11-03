/**
 * Fase 9 · mapa (IM-018, IM-092) e banner próprio do dono com limite de 6 (IM-093) no DEV, pela rota normal de revisão.
 * Versão 1: endereço real simples + banner próprio (PNG gerado) + envio; o administrador aprova; a página pública mostra o
 * banner e o iframe do OpenStreetMap; "Mostrar mapa" desligado oculta. Versão 2: restaura o estado original (sem endereço,
 * sem banner) e confirma que mudar o endereço no rascunho descarta a coordenada. Consultas ao Nominatim: a Server Action de
 * salvar localiza sozinha quando o endereço muda e o envio localiza de novo (no máximo 2 consultas reais na versão 1; na
 * versão 2 o endereço vazio não consulta nada). Só desktop, serial. Dados com prefixo "E2E ". Sem service_role.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";
import { gerarPng } from "./png";

const SLUG = "perfil-1";
const SUFIXO = Date.now().toString(36);
const ALT_PROPRIO = `E2E banner proprio ${SUFIXO}`;
const ENDERECO = "Avenida Fernandes Bastos, 1000";
const FOTO = (n: string) => `test-results/fase9/${n}.png`;

const sessoes: { dono?: Page; admin?: Page; anon?: Page; ctxs: BrowserContext[] } = { ctxs: [] };
let perfilId = "";
const enderecoOriginal = "";
const cidadeOriginal = "tramandai";
const ufOriginal = "RS";

async function abrir(browser: Browser, papel?: "dono" | "admin"): Promise<Page> {
  const ctx = await browser.newContext();
  sessoes.ctxs.push(ctx);
  // O mapa de verdade (openstreetmap.org) não é carregado nos testes: só o endereço do iframe importa e a rede externa é lenta.
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*openstreetmap\.org\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>osm bloqueado no teste</body></html>",
    }),
  );
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  if (papel) await entrar(page, papel);
  return page;
}

async function enviarEAprovar(motivo: string) {
  const dono = sessoes.dono!;
  const admin = sessoes.admin!;
  await dono.goto(`/meus-perfis/${perfilId}/previa`);
  const enviar = dono.getByRole("button", { name: "Enviar para aprovação" });
  if (await enviar.isVisible()) {
    await enviar.click();
    await expect(dono.getByText(/Esta versão já foi enviada|enviad/i).first()).toBeVisible({
      timeout: 45_000,
    });
  } else if (!(await dono.getByText("Esta versão já foi enviada e está em análise.").isVisible())) {
    return; // nada a enviar nem a revisar (aprovada numa tentativa anterior desta mesma rodada)
  }
  await admin.goto("/administracao/revisao");
  await admin.locator("li.cartao", { hasText: "perfil 1" }).first().getByRole("link").click();
  await expect(admin).toHaveURL(/\/administracao\/revisao\/perfil\/[0-9a-f-]{36}$/, {
    timeout: 60_000,
  });
  await admin.screenshot({ path: FOTO(`b6-revisao-${motivo}`) });
  await admin.getByRole("button", { name: "Aprovar" }).click();
  await expect(admin).toHaveURL(/\/administracao\/revisao/, { timeout: 45_000 });
  await expect(admin.getByText("Aprovado.")).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });
test.describe("Fase 9 · mapa e banner próprio (DEV)", () => {
  test.describe.configure({ timeout: 240_000 });

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

  test("M0 estado original do perfil de teste (sem endereço, sem versão aberta)", async () => {
    const dono = sessoes.dono!;
    await dono.goto("/meus-perfis");
    const hrefs = await dono
      .locator('a[href^="/meus-perfis/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    // Estado original observado antes da verificação (02/11/2026): sem endereço, cidade "tramandai", UF RS, mapa ligado.
    await dono.goto(`/meus-perfis/${perfilId}`);
    await expect(dono.locator(".mapa-situacao")).toContainText("Mapa na página: ligado");
  });

  test("M1 dono preenche endereço real e salva: a coordenada é gravada no rascunho (Nominatim)", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}`);
    await dono.getByLabel("Endereço (opcional)").fill(ENDERECO);
    await dono.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dono.locator(".aviso-sucesso").first()).toBeVisible({ timeout: 60_000 });
    // O salvar já localiza sozinho quando o endereço muda (invisível na tela); o botão confirma e mostra o resultado.
    // A tela do responsável só exibe as coordenadas da versão APROVADA; a do rascunho se confirma por esta mensagem.
    await dono.goto(`/meus-perfis/${perfilId}`);
    await dono.getByRole("button", { name: "Localizar no mapa" }).click();
    await expect(dono.getByText(/Endereço localizado no mapa\./)).toBeVisible({ timeout: 60_000 });
    await dono.screenshot({ path: FOTO("mapa-localizado-rascunho"), fullPage: true });
  });

  test("B6.5 dono envia o próprio banner (rascunho) e o limite de 6 imagens é respeitado na tela", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    await dono
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "meu-banner-e2e.png",
        mimeType: "image/png",
        buffer: gerarPng(640, 200, [60, 90, 200]),
      });
    await expect(dono.getByLabel("Descrição da imagem").first()).toBeVisible({ timeout: 45_000 });
    await dono.getByLabel("Descrição da imagem").first().fill(ALT_PROPRIO);
    await dono.getByRole("button", { name: "Salvar banners" }).click();
    await expect(dono.getByText("Banners salvos").first()).toBeVisible({ timeout: 45_000 });
    await dono.screenshot({ path: FOTO("b6-dono-banner-proprio-salvo"), fullPage: true });

    // Limite: tenta passar de 6 imagens no total, na tela, sem salvar.
    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    const arquivos = Array.from({ length: 8 }, (_, i) => ({
      name: `lote-${i}.png`,
      mimeType: "image/png",
      buffer: gerarPng(320, 100, [20 + i * 20, 120, 80]),
    }));
    await dono.locator('input[type="file"]').first().setInputFiles(arquivos);
    await expect(dono.getByText(/Limite de \d+ imagem\(ns\) suas atingido/)).toBeVisible({
      timeout: 90_000,
    });
    const quantos = await dono.locator("ol.lista-banners > li").count();
    expect(quantos, "no máximo 6 banners no total").toBeLessThanOrEqual(6);
    await dono.screenshot({ path: FOTO("b6-limite-6-banners"), fullPage: true });
    await dono.goto(`/meus-perfis/${perfilId}/banners`); // descarta o lote não salvo
    await expect(dono.locator("ol.lista-banners > li")).toHaveCount(1);
  });

  test("M2 dono envia a versão; administrador aprova; página pública mostra banner e iframe só do OpenStreetMap", async () => {
    await enviarEAprovar("v1");
    const anon = sessoes.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator('img[alt^="E2E banner proprio"]').first()).toBeAttached();
    const iframe = anon.locator("iframe");
    await expect(iframe).toHaveCount(1);
    const src = (await iframe.getAttribute("src")) ?? "";
    expect(new URL(src).hostname).toBe("www.openstreetmap.org");
    // A coordenada gravada pelo Nominatim vai no endereço do iframe (marker=lat,lon) e é de Tramandaí (RS).
    const marker = new URL(src).searchParams.get("marker") ?? "";
    const [lat, lon] = marker.split(",").map(Number);
    expect(lat).toBeGreaterThan(-30.5);
    expect(lat).toBeLessThan(-29.7);
    expect(lon).toBeGreaterThan(-50.5);
    expect(lon).toBeLessThan(-49.8);
    const todos = await anon
      .locator("iframe")
      .evaluateAll((fs) => fs.map((f) => (f as HTMLIFrameElement).src));
    for (const s of todos) expect(new URL(s).hostname).toMatch(/(^|\.)openstreetmap\.org$/);
    // HTML sem dado privado do dono.
    const html = await anon.content();
    expect(html).not.toMatch(/wa\.me|mailto:|\(51\) 98139|service_role|sb_secret/i);
    await anon.screenshot({ path: FOTO("mapa-publico-iframe-osm"), fullPage: true });
    await anon.locator("#localizacao").screenshot({ path: FOTO("mapa-publico-secao") });
  });

  test("M3 'Mostrar mapa' desligado oculta o mapa; ligado volta", async () => {
    const dono = sessoes.dono!;
    const anon = sessoes.anon!;
    await dono.goto(`/meus-perfis/${perfilId}`);
    const alternar = dono.getByRole("switch", { name: /Mostrar mapa na minha página/ });
    await expect(alternar).toHaveAttribute("aria-checked", "true");
    await alternar.click();
    await expect
      .poll(
        async () => {
          await dono.goto(`/meus-perfis/${perfilId}`);
          return dono
            .getByRole("switch", { name: /Mostrar mapa na minha página/ })
            .getAttribute("aria-checked");
        },
        { timeout: 30_000 },
      )
      .toBe("false");
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator("iframe")).toHaveCount(0);
    await expect(anon.locator("#localizacao")).toContainText("Fernandes Bastos");
    await anon.screenshot({ path: FOTO("mapa-desligado-publico"), fullPage: true });

    await dono.getByRole("switch", { name: /Mostrar mapa na minha página/ }).click();
    await expect
      .poll(
        async () => {
          await anon.goto(`/perfil/${SLUG}`);
          return anon.locator("iframe").count();
        },
        { timeout: 30_000 },
      )
      .toBe(1);
  });

  test("M4 restauração: mudar o endereço no rascunho descarta a coordenada; remove o banner; aprova", async () => {
    const dono = sessoes.dono!;
    await dono.goto(`/meus-perfis/${perfilId}`);
    await expect(dono.locator(".mapa-situacao")).toContainText(/-?\d+\.\d+, -?\d+\.\d+/);
    await dono.getByLabel("Endereço (opcional)").fill(enderecoOriginal);
    await dono.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dono.locator(".aviso-sucesso").first()).toBeVisible({ timeout: 60_000 });
    // No rascunho com o endereço mudado a coordenada anterior não vale mais (sem endereço, não há o que localizar).
    await dono.goto(`/meus-perfis/${perfilId}`);
    await expect(dono.getByLabel("Endereço (opcional)")).toHaveValue(enderecoOriginal);
    // Enquanto a v2 não é aprovada, a tela mostra a coordenada da versão APROVADA (a v1); o descarte na v2 se prova
    // depois da aprovação, abaixo: endereço vazio não consulta o Nominatim, então nenhuma coordenada nova pode existir.
    await dono.screenshot({ path: FOTO("mapa-rascunho-endereco-removido"), fullPage: true });

    await dono.goto(`/meus-perfis/${perfilId}/banners`);
    await dono.getByRole("button", { name: "Remover o banner 1" }).click();
    await dono.getByRole("button", { name: "Salvar banners" }).click();
    await expect(dono.getByText("Banners salvos").first()).toBeVisible({ timeout: 45_000 });

    await enviarEAprovar("v2");
    const anon = sessoes.anon!;
    await anon.goto(`/perfil/${SLUG}`);
    await expect(anon.locator("iframe")).toHaveCount(0);
    await expect(anon.locator('img[alt^="E2E banner"]')).toHaveCount(0);
    expect(cidadeOriginal && ufOriginal).toBeTruthy();
    await dono.goto(`/meus-perfis/${perfilId}`);
    await expect(dono.getByLabel("Cidade")).toHaveValue(cidadeOriginal);
    await expect(dono.getByLabel("UF", { exact: true })).toHaveValue(ufOriginal);
    await expect(dono.getByLabel("Endereço (opcional)")).toHaveValue(enderecoOriginal);
    await expect(dono.locator(".mapa-situacao")).toContainText("Mapa na página: ligado");
    await expect(dono.locator(".mapa-situacao")).toContainText(
      "Coordenadas da versão aprovada: ainda não há",
    );
    await anon.screenshot({ path: FOTO("mapa-restaurado-publico"), fullPage: true });
  });
});
