import { expect, test, type Browser } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 4, verificação independente (IM-036, IM-079, D-012): proposta do administrador, aceite do responsável que ativa
// o benefício, vitrine anônima sem benefício vencido. ESCREVE dados de teste no DEV (nomes "E2E ..."), nunca em produção.
// Roda só no projeto desktop para não duplicar dados.
const SUFIXO = Date.now().toString(36);
const NOME_VIGENTE = `E2E vigente ${SUFIXO}`;
const NOME_VENCIDO = `E2E vencido ${SUFIXO}`;

async function idDoPerfilDoDono(browser: Browser): Promise<string | null> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, "dono");
  await page.goto("/meus-perfis");
  const hrefs = await page
    .locator('a[href^="/meus-perfis/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  await ctx.close();
  const h = hrefs.find((x) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(x));
  return h ? h.split("/")[2] : null;
}

test("proposta do admin: responsável vê, aceita (ativa) e a vitrine anônima omite o vencido", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "só no desktop");
  exigirConta("admin");
  exigirConta("dono");
  const perfilId = await idDoPerfilDoDono(browser);
  test.skip(!perfilId, "conta dono sem perfil");

  // 1) admin cadastra duas propostas: uma vigente e uma com prazo de resgate vencido
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await entrar(admin, "admin");
  for (const [nome, prazo] of [
    [NOME_VIGENTE, ""],
    [NOME_VENCIDO, "2020-01-01"],
  ]) {
    await admin.goto("/administracao/beneficios");
    await admin.getByLabel("Identificador do perfil").fill(perfilId!);
    await admin.getByLabel("Nome do benefício").fill(nome);
    await admin.getByLabel("Descrição").fill("Benefício de teste automatizado");
    await admin.getByLabel("Pontos necessários").fill("50");
    if (prazo) await admin.getByLabel("Resgate possível até").fill(prazo);
    await admin.getByLabel("Motivo do cadastro").fill("Teste E2E da verificação independente");
    await admin.getByRole("button", { name: "Enviar proposta ao responsável" }).click();
    await expect(admin.getByText(nome).first()).toBeVisible({ timeout: 15_000 });
  }
  await adminCtx.close();

  // 2) antes do aceite: nada na vitrine anônima
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto("/beneficios");
  await expect(anon.getByText(NOME_VIGENTE)).toHaveCount(0);

  // 3) indicador (outra conta) não vê a proposta da página do dono
  exigirConta("indicador");
  const indCtx = await browser.newContext();
  const ind = await indCtx.newPage();
  await entrar(ind, "indicador");
  const r = await ind.goto(`/meus-perfis/${perfilId}/beneficios`);
  expect(r?.status()).toBe(404);
  await indCtx.close();

  // 4) dono vê as duas propostas aguardando aceite e aceita
  const donoCtx = await browser.newContext();
  const dono = await donoCtx.newPage();
  await entrar(dono, "dono");
  for (const nome of [NOME_VIGENTE, NOME_VENCIDO]) {
    await dono.goto(`/meus-perfis/${perfilId}/beneficios`);
    const cartao = dono.locator("li.cartao", { hasText: nome }).first();
    await expect(cartao).toBeVisible();
    await cartao.getByRole("button", { name: "Aceitar" }).click();
    await expect(dono.locator("li.cartao", { hasText: nome }).getByText("Ligado")).toBeVisible({
      timeout: 15_000,
    });
  }
  // o responsável ainda enxerga o vencido
  await expect(dono.getByText(NOME_VENCIDO).first()).toBeVisible();
  await donoCtx.close();

  // 5) vitrine anônima: vigente aparece (se o perfil estiver publicado); vencido nunca
  await anon.goto("/beneficios");
  await expect(anon.getByText(NOME_VENCIDO)).toHaveCount(0);
  const html = await anon.content();
  expect(html).not.toMatch(/service_role|sb_secret|wa\.me|mailto:/i);
  await expect(anon.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
  const vigenteVisivel = await anon.getByText(NOME_VIGENTE).count();
  info.annotations.push({ type: "vigente na vitrine", description: String(vigenteVisivel) });

  // 6) limpeza: o dono desliga os dois (o histórico permanece, é só inserção)
  const dono2Ctx = await browser.newContext();
  const dono2 = await dono2Ctx.newPage();
  await entrar(dono2, "dono");
  for (const nome of [NOME_VIGENTE, NOME_VENCIDO]) {
    await dono2.goto(`/meus-perfis/${perfilId}/beneficios`);
    await dono2
      .locator("li.cartao", { hasText: nome })
      .first()
      .getByRole("button", { name: "Desligar" })
      .click();
    await expect(
      dono2.locator("li.cartao", { hasText: nome }).first().getByText("Desligado"),
    ).toBeVisible({ timeout: 15_000 });
  }
  await dono2Ctx.close();
  await anonCtx.close();
  await anon.context();
  expect(vigenteVisivel).toBeGreaterThan(0);
});
