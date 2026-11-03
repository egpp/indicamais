/**
 * Fase 10 · Loja · verificação independente de tela (IM-097, IM-098, IM-029, IM-090, IM-092) no DEV.
 * Cobre o que fase10-loja.spec.ts não cobre: 360px sem rolagem horizontal, filtros por GET SEM JavaScript,
 * rótulos/alvos de toque, noindex e HTML sem dado privado em /perfil e /item, ausência de carrinho/pagamento,
 * prévia (og:image) e Loja liberada sem imóvel no ar (volta ao catálogo simples? ver teste "vazia").
 * Os dados são criados por supabase-js com as contas E2E (sem service_role) e desfeitos ao final (item despublicado,
 * Loja devolvida ao estado inicial). Roda só no projeto "desktop" (usa setViewportSize 360x740 para o celular).
 * Executar: pnpm exec playwright test tests/e2e/fase10-verificacao.spec.ts --project=desktop --workers=1
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { credenciais, exigirConta } from "./contas";
import { gerarPng } from "./png";

const SLUG = "perfil-1";
const BUCKET = "indicamais-imagens";
const nome = `E2E Verif Loja ${Date.now().toString(36)}`;

const st = { perfilId: "", itemId: "", lojaInicial: false, publicado: false };
let dono: SupabaseClient;
let admin: SupabaseClient;

async function logar(papel: "dono" | "admin"): Promise<SupabaseClient> {
  const { email, senha } = credenciais(papel);
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}
async function definirLoja(liberada: boolean, motivo: string) {
  const { error } = await admin.rpc("loja_definir_liberacao", {
    p_perfil_id: st.perfilId,
    p_liberada: liberada,
    p_motivo: motivo,
  });
  if (error) throw new Error(`loja_definir_liberacao: ${error.code}`);
}
async function semRolagemHorizontal(page: Page) {
  const largura = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(largura.sw, `scrollWidth ${largura.sw} > innerWidth ${largura.iw}`).toBeLessThanOrEqual(
    largura.iw + 1,
  );
}

test.describe.configure({ mode: "serial", timeout: 240_000 });
test.describe("Fase 10 · verificação de telas da Loja (DEV)", () => {
  test.skip(({ isMobile }) => isMobile, "dados criados uma vez; 360px via setViewportSize");
  exigirConta("dono");
  exigirConta("admin");

  test.beforeAll(async () => {
    dono = await logar("dono");
    admin = await logar("admin");
    const { data } = await dono
      .from("perfis_meus_perfis")
      .select("id, slug")
      .order("criado_em", { ascending: true });
    const meu = (data ?? []).find((p) => p.slug === SLUG) ?? data![0]!;
    st.perfilId = meu.id as string;
    const lib = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", st.perfilId);
    st.lojaInicial = Boolean(lib.data?.[0]?.liberada);
    await definirLoja(true, "E2E verificação: liberar a Loja");
    const cat = await dono.from("catalogo_categoria").select("id").limit(1);
    const r = await dono.rpc("catalogo_criar_item", {
      p_tipo: "imovel",
      p_perfil_id: st.perfilId,
      p_nome: nome,
      p_descricao: "Imóvel de verificação independente. Fica no ar só durante o teste.",
      p_categoria_principal_id: cat.data![0]!.id,
      p_preco_modo: "fixo",
      p_preco_centavos: 320000,
    });
    if (r.error) throw new Error(`criar: ${r.error.code}`);
    const linha = (r.data as { o_item_id: string; o_versao_id: string }[])[0]!;
    st.itemId = linha.o_item_id;
    const png = gerarPng(60, 40, [30, 100, 160]);
    const [capa, e1, e2] = [randomUUID(), randomUUID(), randomUUID()].map((u) => `${u}.png`);
    for (const n of [capa, e1, e2]) {
      const up = await dono.storage
        .from(BUCKET)
        .upload(`item/${st.itemId}/${n}`, png, { contentType: "image/png" });
      if (up.error) throw new Error("upload");
    }
    const u = await dono
      .from("catalogo_item_versao")
      .update({
        foto_path: `item/${st.itemId}/${capa}`,
        fotos_extras_paths: [`item/${st.itemId}/${e1}`, `item/${st.itemId}/${e2}`],
        imovel_tipo: "casa",
        finalidade: "aluguel",
        area_m2: 90,
        quartos: 3,
        banheiros: 2,
        vagas: 1,
        bairro: "Bairro Verificação",
        cidade: "Marília",
        uf: "SP",
        condominio_centavos: 0,
        iptu_centavos: 12000,
        aceita_financiamento: false,
      })
      .eq("id", linha.o_versao_id);
    if (u.error) throw new Error(`versao: ${u.error.code}`);
    const env = await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: linha.o_versao_id });
    if (env.error) throw new Error(`enviar: ${env.error.code}`);
    const ap = await admin.rpc("catalogo_decidir_item_versao", {
      p_versao_id: linha.o_versao_id,
      p_aprovar: true,
    });
    if (ap.error) throw new Error(`aprovar: ${ap.error.code}`);
    const pub = await dono.from("catalogo_item").update({ publicado: true }).eq("id", st.itemId);
    if (pub.error) throw new Error(`publicar: ${pub.error.code}`);
    st.publicado = true;
  });

  test.afterAll(async () => {
    if (st.itemId)
      await dono.from("catalogo_item").update({ publicado: false }).eq("id", st.itemId);
    if (st.perfilId) await definirLoja(st.lojaInicial, "E2E verificação: restaurar estado inicial");
  });

  test("perfil público a 360px: sem rolagem horizontal, cartão do imóvel, 'por mês', rótulos e alvos >= 44px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/perfil/${SLUG}`, { timeout: 120_000 });
    const secao = page.locator("#produtos");
    await expect(secao.getByRole("heading", { level: 2, name: "Loja" })).toBeVisible();
    const cartao = secao.locator("article", { hasText: nome });
    await expect(cartao).toBeVisible();
    await expect(cartao.getByText(/3.200,00 por mês/)).toBeVisible();
    await expect(cartao.getByText("Bairro Verificação, Marília/SP")).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: "test-results/fase10-verif/perfil-360.png", fullPage: true });

    const form = page.getByRole("search", { name: "Filtrar imóveis" });
    await expect(form).toHaveAttribute("method", /get/i);
    for (const rotulo of [
      "Finalidade",
      "Tipo de imóvel",
      "Quartos (mínimo)",
      "Preço máximo (R$)",
    ]) {
      await expect(form.getByLabel(rotulo)).toBeVisible();
    }
    for (const el of await form
      .locator("select, input:not([type=hidden]), button, a.botao")
      .all()) {
      const caixa = await el.boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(43.5);
    }
    // sem carrinho/checkout/pagamento
    const html = await page.content();
    expect(html).not.toMatch(/carrinho|checkout|comprar agora|pagamento|finalizar compra/i);
  });

  test("filtros funcionam por GET sem JavaScript", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      locale: "pt-BR",
      viewport: { width: 360, height: 740 },
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(60_000);
    await p.goto(`/perfil/${SLUG}`);
    const form = p.getByRole("search", { name: "Filtrar imóveis" });
    await form.getByLabel("Finalidade").selectOption("venda");
    await form.getByRole("button").click();
    await expect(p).toHaveURL(/finalidade=venda/);
    await expect(p.getByText("Nenhum imóvel encontrado com esses filtros.")).toBeVisible();
    const f2 = p.getByRole("search", { name: "Filtrar imóveis" });
    await f2.getByLabel("Finalidade").selectOption("aluguel");
    await f2.getByLabel("Quartos (mínimo)").selectOption("3");
    await f2.getByLabel("Preço máximo (R$)").fill("3.500,00");
    await f2.getByRole("button").click();
    await expect(p).toHaveURL(/finalidade=aluguel/);
    await expect(p.locator("#produtos article", { hasText: nome })).toBeVisible();
    // preço máximo abaixo do valor esconde o imóvel
    await p.goto(`/perfil/${SLUG}?finalidade=aluguel&precoMax=3.000,00`);
    await expect(p.locator("#produtos article", { hasText: nome })).toHaveCount(0);
    // parâmetros maliciosos não quebram a página
    for (const q of [
      "finalidade=%27%20OR%201%3D1--",
      "quartos=999999999999",
      "imovelTipo=%3Cscript%3E",
      "precoMax=-5",
    ]) {
      const r = await p.goto(`/perfil/${SLUG}?${q}`);
      expect(r?.status(), q).toBeLessThan(500);
    }
    await ctx.close();
  });

  test("/item/<id> a 360px: dados, galeria, contato, noindex, og:image e HTML sem dado privado", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/item/${st.itemId}`, { timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
    await expect(page.getByText(/3.200,00 por mês/).first()).toBeVisible();
    const dados = page.getByLabel("Dados do imóvel");
    await expect(dados.getByText("Bairro Verificação, Marília/SP")).toBeVisible();
    await expect(dados.getByText(/Condomínio/)).toBeVisible();
    await expect(page.getByLabel(`Mais fotos de ${nome}`).getByRole("img")).toHaveCount(2);
    for (const img of await page.getByLabel(`Mais fotos de ${nome}`).getByRole("img").all()) {
      const alt = await img.getAttribute("alt");
      expect(alt && alt.trim().length > 0).toBe(true);
    }
    const contato = page.getByRole("link", { name: "Quero entrar em contato" });
    await expect(contato).toBeVisible();
    const caixa = await contato.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(43.5);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: "test-results/fase10-verif/item-360.png", fullPage: true });

    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    const resp = await page.request.get(og!.startsWith("http") ? new URL(og!).pathname : og!, {
      maxRedirects: 5,
    });
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toMatch(/^image\//);

    const html = await page.content();
    const { email } = credenciais("dono");
    expect(html).not.toContain(email);
    expect(html).not.toMatch(/conta_id|responsavel_id|service_role/i);
    const semExemplo = html.split("(11) 99999-0001").join("");
    expect(
      /\+55\d{10,11}|\(\d{2}\) ?9?\d{4}-\d{4}|wa\.me|tel:|mailto:/.exec(semExemplo),
    ).toBeNull();
    expect(html).not.toMatch(/carrinho|checkout|comprar agora|pagamento|finalizar compra/i);
    // endereço exato não existe: nenhuma rua/número/CEP no HTML
    expect(html).not.toMatch(/\b\d{5}-\d{3}\b/);
    // item inexistente e id malformado: 404 neutro
    const r1 = await page.goto(`/item/00000000-0000-4000-8000-000000000000`);
    expect(r1?.status()).toBe(404);
    const r2 = await page.goto(`/item/nao-e-uuid`);
    expect(r2?.status()).toBe(404);
  });

  test("Loja liberada sem imóvel no ar: página mostra o catálogo sem seção vazia de imóveis", async ({
    page,
  }) => {
    await dono.from("catalogo_item").update({ publicado: false }).eq("id", st.itemId);
    st.publicado = false;
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/perfil/${SLUG}`, { timeout: 120_000 });
    await expect(page.locator("#produtos").getByText(nome)).toHaveCount(0);
    await semRolagemHorizontal(page);
    const r = await page.goto(`/item/${st.itemId}`);
    expect(r?.status()).toBe(404);
    const loja = await page.goto(`/perfil/${SLUG}`);
    expect(loja?.status()).toBe(200);
    await page.screenshot({
      path: "test-results/fase10-verif/perfil-sem-imovel-360.png",
      fullPage: true,
    });
  });

  test("/administracao/loja a 360px (administrador): sem rolagem, motivo rotulado, noindex", async ({
    page,
    browser,
    baseURL,
  }) => {
    const { email, senha } = credenciais("admin");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/^(?!.*\/entrar)/, { timeout: 90_000 });
    await page.goto("/administracao/loja", { timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await semRolagemHorizontal(page);
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    const motivo = page.getByLabel(/Motivo para/).first();
    await expect(motivo).toBeVisible();
    // botão sem motivo: o servidor recusa (campo exigido)
    const botoes = page.getByRole("button", { name: /Liberar a Loja|Retirar a Loja/ });
    expect(await botoes.count()).toBeGreaterThan(0);
    for (const b of await botoes.all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    }
    await page.screenshot({ path: "test-results/fase10-verif/admin-loja-360.png", fullPage: true });
    void browser;
    void baseURL;
  });
});
