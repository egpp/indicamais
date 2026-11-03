/**
 * Fase 9 · verificação ponta a ponta no DEV (nunca produção). Blocos 2 a 5 do roteiro de verificação:
 *  - Bloco 2: curtir, sino, avisos, base sem dado privado, limite de curtir (IM-039, IM-041, IM-043, IM-045, IM-047, IM-052)
 *  - Bloco 3: link, contato de visitante anônimo, +10 pontos, reversão, parâmetro (IM-030, IM-035, IM-078)
 *  - Bloco 4: benefício proposto pelo administrador, aceite do dono, vitrine anônima (IM-036, IM-079)
 *  - Bloco 5: sair da base (IM-045)
ATENÇÃO: depois de rodar fase9-limite-curtir.spec.ts, B2.1 (curtir) falha por até 24 h com a conta E2E_INDICADOR no perfil-1 (P0429 é esperado).
 * O limite de curtir (P0429) fica em fase9-limite-curtir.spec.ts, opt-in, porque bloqueia a conta por 24 h.
 * Sem service_role. Dados criados têm prefixo "E2E ". Só no projeto desktop e em ordem (serial), porque cada etapa
 * depende da anterior. Credenciais só por variáveis E2E_* (nunca impressas). Capturas em test-results/fase9/.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const SLUG = "perfil-1";
const CAMINHO = `/perfil/${SLUG}`;
const NOME_PERFIL = "perfil 1";
const SUFIXO = Date.now().toString(36);
const NOME_INDICADOR_TESTE = "E2E Maria Silva";
const NOME_REDUZIDO = "E2E S.";
const NOME_VISITANTE = `E2E Visitante ${SUFIXO}`;
const FOTO = (nome: string) => `test-results/fase9/${nome}.png`;
// WhatsApp fictício diferente de todas as contas de teste (DDD 21, final aleatório por rodada).
const ZAP_VISITANTE = `219${String(Math.floor(Math.random() * 90_000_000) + 10_000_000)}`;

type Sessao = { ctx: BrowserContext; page: Page };
const sessoes: Partial<Record<"dono" | "ind" | "admin" | "anon", Sessao>> = {};
let perfilId = "";
let nomeOriginalIndicador = "";
let codigoLink = "";
let saldoAntes = 0;

async function abrirSessao(
  browser: Browser,
  papel?: "dono" | "indicador" | "admin",
): Promise<Sessao> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  if (papel) await entrar(page, papel);
  return { ctx, page };
}

const S = (k: keyof typeof sessoes) => sessoes[k]!.page;

/** Lê o contador do sino pelo rótulo acessível. */
async function naoLidasNoSino(page: Page): Promise<number> {
  const sino = page.locator('a.sino[href="/avisos"]').first();
  await expect(sino).toBeVisible({ timeout: 30_000 });
  const rot = (await sino.getAttribute("aria-label")) ?? "";
  const m = /(\d+) avisos? não lidos?/.exec(rot);
  return m ? Number(m[1]) : 0;
}

async function saldoDoIndicador(page: Page): Promise<number> {
  await page.goto("/pontos");
  const txt = await page.locator(".saldo-destaque").innerText();
  return Number(txt.replace(/\D/g, ""));
}

test.describe.configure({ mode: "serial" });
test.describe("Fase 9 · blocos 2 a 5 (DEV)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "desktop") return;
    for (const p of ["dono", "indicador", "admin"] as const) {
      if (!process.env[`E2E_${p.toUpperCase()}_EMAIL`]) return;
    }
    sessoes.dono = await abrirSessao(browser, "dono");
    sessoes.ind = await abrirSessao(browser, "indicador");
    sessoes.admin = await abrirSessao(browser, "admin");
    sessoes.anon = await abrirSessao(browser);
  });

  test.afterAll(async () => {
    for (const s of Object.values(sessoes)) await s?.ctx.close();
  });

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Fluxo de duas ou mais contas: só no desktop.");
    exigirConta("dono");
    exigirConta("indicador");
    exigirConta("admin");
  });

  // ------------------------------------------------------------------------------------------------ Bloco 2
  test("B2.0 prepara: id do perfil do dono e nome de teste do indicador", async () => {
    const dono = S("dono");
    await dono.goto("/meus-perfis");
    const hrefs = await dono
      .locator('a[href^="/meus-perfis/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    expect(perfilId).toMatch(/^[0-9a-f-]{36}$/);

    const ind = S("ind");
    await ind.goto("/minha-conta");
    const campo = ind.getByRole("textbox", { name: "Nome", exact: true });
    nomeOriginalIndicador = await campo.inputValue();
    await campo.fill(NOME_INDICADOR_TESTE);
    await ind.getByRole("button", { name: "Salvar nome" }).click();
    await expect(ind.getByText("Nome atualizado.")).toBeVisible();
  });

  test("B2.1 indicador curta o perfil do dono; dono vê aviso no sino com nome reduzido e contador", async () => {
    const dono = S("dono");
    const ind = S("ind");
    await dono.goto("/pontos");
    const antes = await naoLidasNoSino(dono);

    await ind.goto(CAMINHO);
    const botao = ind.getByRole("button", { name: /^(Curtir|Descurtir)$/ });
    await expect(botao).toBeVisible();
    if ((await botao.innerText()).trim() === "Descurtir") {
      await botao.click();
      await expect(ind.getByRole("button", { name: "Curtir", exact: true })).toBeVisible();
    }
    await ind.getByRole("button", { name: "Curtir", exact: true }).click();
    await expect(ind.getByText("Você curtiu este perfil.")).toBeVisible();
    await expect(ind.getByRole("button", { name: "Descurtir" })).toBeVisible();
    // Sem promessa de pontos ou ganho na tela de curtir (IM-042).
    await expect(ind.locator(".secao-curtir")).not.toContainText(
      /ponto|ganhe|benefício garantido/i,
    );

    await dono.goto("/pontos");
    const depois = await naoLidasNoSino(dono);
    await dono.screenshot({ path: FOTO("b2-sino-dono-curtida") });

    await dono.goto("/avisos");
    const cartao = dono
      .locator("li.cartao", { hasText: "Nova curtida" })
      .filter({ hasText: NOME_REDUZIDO })
      .first();
    await expect(cartao).toBeVisible();
    // O aviso de curtida tem identidade fixa por pessoa e perfil (curtir de novo não cria outro, de propósito):
    // se ainda não foi lido, o sino precisa contá-lo; se já foi lido numa rodada anterior, só confere o texto.
    if (/aviso-nao-lido/.test((await cartao.getAttribute("class")) ?? "")) {
      expect(depois).toBeGreaterThanOrEqual(Math.max(1, antes));
    }
    await expect(cartao).toContainText(`${NOME_REDUZIDO} curtiu ${NOME_PERFIL}.`);
    const textoAvisos = await dono.locator("main").innerText();
    expect(textoAvisos).not.toContain("Silva");
    expect(textoAvisos).not.toMatch(/indicador@|wa\.me|mailto:|\+55\d{8,}/i);
    await dono.screenshot({ path: FOTO("b2-avisos-dono") });
  });

  test("B2.3 sino navegável por teclado: foco visível, Enter abre /avisos", async () => {
    const dono = S("dono");
    await dono.goto("/pontos");
    const sino = dono.locator('a.sino[href="/avisos"]').first();
    await expect(sino).toBeVisible();
    await sino.focus();
    await expect(sino).toBeFocused();
    // Tab alcança o sino a partir do início da página (ordem de foco existe).
    await dono.goto("/pontos");
    await expect(sino).toBeVisible();
    let alcancou = false;
    for (let i = 0; i < 40 && !alcancou; i++) {
      await dono.keyboard.press("Tab");
      alcancou = await sino.evaluate((e) => e === document.activeElement);
    }
    expect(alcancou, "Tab deve chegar ao sino").toBe(true);
    const contorno = await sino.evaluate((e) => {
      const c = getComputedStyle(e);
      return `${c.outlineStyle}|${c.outlineWidth}|${c.boxShadow}`;
    });
    expect(contorno, "foco visível").not.toMatch(/^none\|0px\|none$/);
    const caixa = await sino.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    await dono.keyboard.press("Enter");
    await expect(dono).toHaveURL(/\/avisos$/);
    await dono.screenshot({ path: FOTO("b2-sino-teclado") });
  });

  test("B2.4 base do dono lista a pessoa por nome reduzido e não tem dado privado", async () => {
    const dono = S("dono");
    const r = await dono.goto(`/meus-perfis/${perfilId}/base`);
    expect(r?.status()).toBe(200);
    const card = dono.locator("li.cartao", { hasText: NOME_REDUZIDO }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Curtiu");
    await dono.evaluate(() =>
      document
        .querySelectorAll<HTMLElement>('[aria-label^="Conta:"]')
        .forEach((e) => (e.style.display = "none")),
    );
    const visivel = await dono.locator("body").innerText();
    const links = await dono
      .locator("a[href]")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")).join(" "));
    expect(visivel).not.toContain("Silva");
    expect(`${visivel} ${links}`).not.toMatch(
      /wa\.me|mailto:|\+55\d{8,}|[\w.+-]+@[\w-]+\.[\w.-]+|99999-?0001|11999990001/i,
    );
    await dono.screenshot({ path: FOTO("b2-base-dono") });
  });

  test("B2.5 dono não pode curtir o próprio perfil (P0403): sem botão e RPC negada", async () => {
    const dono = S("dono");
    await dono.goto(CAMINHO);
    // O responsável não vê o botão Curtir do próprio perfil, ou, se vir, a ação é recusada com mensagem neutra.
    const curtir = dono.getByRole("button", { name: "Curtir", exact: true });
    if ((await curtir.count()) > 0) {
      await curtir.click();
      await expect(dono.getByText(/próprio perfil/i)).toBeVisible();
    } else {
      await expect(curtir).toHaveCount(0);
    }
    await dono.goto(`/meus-perfis/${perfilId}/base`);
    await expect(dono.locator("li.cartao", { hasText: "Maria" })).toHaveCount(0);
  });

  // ------------------------------------------------------------------------------------------------ Bloco 3
  test("B3.1 indicador gera o link de indicação (WhatsApp da conta já cadastrado)", async () => {
    const ind = S("ind");
    await ind.goto(CAMINHO);
    await ind.getByRole("button", { name: "Indique esta empresa" }).click();
    const campo = ind.getByLabel("Seu link de indicação");
    await expect(campo).toBeVisible({ timeout: 30_000 });
    const url = await campo.inputValue();
    expect(url).toMatch(new RegExp(`${CAMINHO}\\?ind=[0-9a-f]{32}$`));
    codigoLink = /ind=([0-9a-f]{32})/.exec(url)![1]!;
    saldoAntes = await saldoDoIndicador(ind);
  });

  test("B3.2 visitante anônimo envia o pedido de contato pelo link", async () => {
    test.skip(!codigoLink, "Sem link do indicador.");
    const anon = S("anon");
    await anon
      .context()
      .route(/https:\/\/wa\.me\//, (r) =>
        r.fulfill({ status: 200, contentType: "text/html", body: "wa.me bloqueado no teste" }),
      );
    const r = await anon.goto(`${CAMINHO}?ind=${codigoLink}`);
    expect(r?.status()).toBe(200);
    await anon.getByLabel("Seu nome").fill(NOME_VISITANTE);
    await anon.getByLabel("Seu WhatsApp").pressSequentially(ZAP_VISITANTE);
    await anon.getByLabel("Mensagem").fill("Mensagem de teste automatizado E2E.");
    await anon.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(anon.getByText("Pedido enviado.")).toBeVisible({ timeout: 45_000 });
    const href =
      (await anon.getByRole("link", { name: "Abrir WhatsApp" }).getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/55[0-9]{10,11}\?text=/);
    expect(decodeURIComponent(href)).not.toContain(ZAP_VISITANTE);
    await anon.screenshot({ path: FOTO("b3-visitante-enviado") });
  });

  test("B3.3 indicador vê +10 em /pontos e nada do visitante", async () => {
    test.skip(!codigoLink, "Sem link do indicador.");
    const ind = S("ind");
    const saldo = await saldoDoIndicador(ind);
    expect(saldo, "saldo sobe 10 pontos (pontos_por_indicacao = 10)").toBe(saldoAntes + 10);
    const topo = ind.locator("li.cartao").first();
    await expect(topo).toContainText(`+10 pontos · ${NOME_PERFIL}`);
    const bruto = await (await ind.request.get("/pontos")).text();
    const visivel = await ind.locator("body").innerText();
    for (const alvo of [bruto, visivel]) {
      expect(alvo).not.toContain(NOME_VISITANTE);
      expect(alvo).not.toContain(ZAP_VISITANTE);
    }
    await ind.screenshot({ path: FOTO("b3-pontos-indicador-mais10") });
    await ind.goto("/minhas-indicacoes");
    const t = await ind.locator("body").innerText();
    const b = await (await ind.request.get("/minhas-indicacoes")).text();
    expect(t).not.toContain(NOME_VISITANTE);
    expect(b).not.toContain(ZAP_VISITANTE);
  });

  test("B3.4 dono recebe aviso de contato válido; base mostra a contagem; pedido sem dado do indicador", async () => {
    test.skip(!codigoLink, "Sem link do indicador.");
    const dono = S("dono");
    await dono.goto("/avisos");
    const cartao = dono.locator("li.cartao", { hasText: "Novo contato por indicação" }).first();
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(
      `${NOME_REDUZIDO} indicou e um contato chegou para ${NOME_PERFIL}.`,
    );
    await expect(cartao).toHaveClass(/aviso-nao-lido/);
    expect(await dono.locator("main").innerText()).not.toContain("Silva");
    expect(await naoLidasNoSino(dono)).toBeGreaterThanOrEqual(1);

    await dono.goto(`/meus-perfis/${perfilId}/base`);
    const pessoa = dono.locator("li.cartao", { hasText: NOME_REDUZIDO }).first();
    await expect(pessoa).toContainText("Indicou");
    await expect(pessoa.locator("strong")).toHaveText(/^[1-9]\d*$/);
    await expect(dono.locator("dl.resumo-base")).toContainText("Contatos por indicação");
    await dono.screenshot({ path: FOTO("b3-base-contagem") });

    // Pedido de contato: o dono vê o visitante (é dele), mas nunca o WhatsApp/e-mail do indicador.
    await dono.goto("/pedidos-de-contato");
    const pedido = dono.locator("li.cartao", { hasText: NOME_VISITANTE }).first();
    await expect(pedido).toBeVisible();
    await expect(pedido).toContainText("Veio por indicação");
    const html = await dono.locator("main").innerText();
    expect(html).not.toMatch(/indicador@example|99999-?0001/);
  });

  test("B2.7 Abrir um aviso leva ao painel do perfil e, se estava novo, marca como lido", async () => {
    const dono = S("dono");
    await dono.goto("/avisos");
    const cartao = dono
      .locator("li.cartao", { has: dono.getByRole("button", { name: "Abrir" }) })
      .first();
    await expect(cartao).toBeVisible();
    const eraNovo = /aviso-nao-lido/.test((await cartao.getAttribute("class")) ?? "");
    const novosAntes = await dono.locator("li.cartao.aviso-nao-lido").count();
    await cartao.getByRole("button", { name: "Abrir" }).click();
    await expect(dono).toHaveURL(/\/(meus-perfis|meus-itens|perfil|item)\//, { timeout: 45_000 });
    await dono.screenshot({ path: FOTO("b2-avisos-abrir-destino") });
    if (eraNovo) {
      await dono.goto("/avisos");
      await expect(dono.locator("li.cartao.aviso-nao-lido")).toHaveCount(novosAntes - 1, {
        timeout: 30_000,
      });
    }
  });

  test("B2.2 /avisos: marcar uma como lida e depois todas; o sino acompanha", async () => {
    const dono = S("dono");
    await dono.goto("/avisos");
    const naoLidasTela = async () => dono.locator("li.cartao.aviso-nao-lido").count();
    const n0 = await naoLidasTela();
    expect(n0).toBeGreaterThan(0);

    await dono
      .locator("li.cartao.aviso-nao-lido")
      .first()
      .getByRole("button", { name: "Marcar como lida" })
      .click();
    // Esta ação não mostra mensagem de sucesso na tela: a prova é a contagem depois de reler a página.
    await expect
      .poll(
        async () => {
          await dono.goto("/avisos");
          return naoLidasTela();
        },
        { timeout: 30_000 },
      )
      .toBe(n0 - 1);
    expect(await naoLidasNoSino(dono)).toBe(n0 - 1);

    if (n0 - 1 > 0) {
      await dono.getByRole("button", { name: "Marcar todos como lidos" }).click();
      // A lista é recarregada e o formulário some quando não restam avisos: a mensagem de sucesso não fica na tela.
      await expect(dono.getByText("Todos os avisos foram lidos.")).toBeVisible({ timeout: 30_000 });
    }
    await dono.goto("/avisos");
    expect(await naoLidasTela()).toBe(0);
    await expect(dono.getByText("Todos os avisos foram lidos.")).toBeVisible();
    expect(await naoLidasNoSino(dono)).toBe(0);
    await dono.screenshot({ path: FOTO("b2-avisos-todos-lidos") });
  });

  test("B3.5 administrador vê crédito e decisão em /administracao/pontos", async () => {
    test.skip(!codigoLink, "Sem link do indicador.");
    const admin = S("admin");
    await admin.goto("/administracao/pontos");
    const lanc = admin.locator("li.cartao", { hasText: `+10 pontos · ${NOME_PERFIL}` }).first();
    await expect(lanc).toBeVisible();
    await expect(lanc).toContainText("Indicador (referência):");
    await expect(
      admin.locator("#titulo-decisoes ~ ul li.cartao", { hasText: "Pontuou" }).first(),
    ).toBeVisible();
    // A tela de administração não exibe nome nem WhatsApp do visitante.
    const t = await admin.locator("main").innerText();
    expect(t).not.toContain(ZAP_VISITANTE);
    await admin.screenshot({ path: FOTO("b3-admin-pontos") });
  });

  test("B3.6 administrador reverte com categoria e observação; indicador vê só a categoria", async () => {
    test.skip(!codigoLink, "Sem link do indicador.");
    const admin = S("admin");
    await admin.goto("/administracao/pontos");
    const lanc = admin.locator("li.cartao", { hasText: `+10 pontos · ${NOME_PERFIL}` }).first();
    await lanc.locator("summary", { hasText: "Reverter crédito" }).click();
    await lanc.getByLabel("Categoria da reversão").selectOption("contato_duplicado");
    await lanc.getByLabel("Observação interna").fill("E2E OBS-INTERNA-SECRETA reversão de teste");
    await lanc.getByRole("button", { name: "Reverter crédito" }).click();
    await expect(admin.getByText(/revert/i).first()).toBeVisible({ timeout: 30_000 });
    await admin.goto("/administracao/pontos");
    const rev = admin.locator("li.cartao", { hasText: "Categoria: Contato duplicado" }).first();
    await expect(rev).toContainText("Observação interna: E2E OBS-INTERNA-SECRETA");
    await admin.screenshot({ path: FOTO("b3-admin-reversao") });

    const ind = S("ind");
    const saldo = await saldoDoIndicador(ind);
    expect(saldo).toBe(saldoAntes);
    await expect(
      ind.locator("li.cartao", { hasText: "Motivo: Contato duplicado" }).first(),
    ).toBeVisible();
    const bruto = await (await ind.request.get("/pontos")).text();
    const visivel = await ind.locator("body").innerText();
    expect(visivel).not.toContain("OBS-INTERNA-SECRETA");
    expect(bruto).not.toContain("OBS-INTERNA-SECRETA");
    await ind.screenshot({ path: FOTO("b3-pontos-indicador-revertido") });
  });

  test("B3.7 parâmetro pontos_por_indicacao: altera com motivo (obrigatório) e restaura 10", async () => {
    const admin = S("admin");
    const cartaoPontos = () =>
      admin.locator("li.cartao", {
        has: admin.getByRole("heading", { name: "Pontos por indicação válida" }),
      });
    async function alterar(valor: string, motivo: string) {
      await admin.goto("/administracao/parametros");
      const c = cartaoPontos();
      await c.locator("summary", { hasText: "Alterar" }).click();
      await c.getByLabel("Novo valor (pontos)").fill(valor);
      await c.getByLabel("Motivo da alteração").fill(motivo);
      await c.getByRole("button", { name: "Salvar pontos" }).click();
      await expect
        .poll(
          async () => {
            await admin.goto("/administracao/parametros");
            return cartaoPontos().innerText();
          },
          { timeout: 30_000 },
        )
        .toContain(`Valor atual: ${valor}`);
    }
    await admin.goto("/administracao/parametros");
    await expect(cartaoPontos()).toContainText("Valor atual: 10");
    await admin.screenshot({ path: FOTO("b3-parametro-antes-10") });
    // Motivo é obrigatório: sem ele a alteração é recusada.
    const c = cartaoPontos();
    await c.locator("summary", { hasText: "Alterar" }).click();
    await c.getByLabel("Novo valor (pontos)").fill("12");
    await c.getByRole("button", { name: "Salvar pontos" }).click();
    await expect(c.locator(".erro-campo, [role=alert]").first()).toBeVisible();
    await alterar("12", "E2E: teste de alteração do parâmetro (será restaurado)");
    await admin.screenshot({ path: FOTO("b3-parametro-12") });
    await alterar("10", "E2E: restaura o valor original 10");
    await expect(cartaoPontos()).toContainText("Valor atual: 10");
    await admin.screenshot({ path: FOTO("b3-parametro-restaurado-10") });
  });

  // ------------------------------------------------------------------------------------------------ Bloco 4
  const NOME_BENEFICIO = `E2E benefício ${SUFIXO}`;
  test("B4 administrador cadastra benefício; dono aceita (já ativa); vitrine anônima sem botão de resgate", async () => {
    const admin = S("admin");
    await admin.goto("/administracao/beneficios");
    await admin.getByLabel("Identificador do perfil").fill(perfilId);
    await admin.getByLabel("Nome do benefício").fill(NOME_BENEFICIO);
    await admin.getByLabel("Descrição", { exact: true }).fill("Benefício de teste E2E (Fase 9)");
    await admin.getByLabel("Pontos necessários").fill("50");
    await admin.getByLabel("Motivo do cadastro").fill("E2E Fase 9: verificação independente");
    await admin.getByRole("button", { name: "Enviar proposta ao responsável" }).click();
    await expect(admin.getByText(NOME_BENEFICIO).first()).toBeVisible({ timeout: 30_000 });
    await admin.screenshot({ path: FOTO("b4-admin-proposta") });

    const anon = S("anon");
    await anon.goto("/beneficios");
    await expect(anon.getByText(NOME_BENEFICIO)).toHaveCount(0);

    const dono = S("dono");
    await dono.goto(`/meus-perfis/${perfilId}/beneficios`);
    const cartao = dono.locator("li.cartao", { hasText: NOME_BENEFICIO }).first();
    await expect(cartao).toBeVisible();
    await cartao.getByRole("button", { name: "Aceitar" }).click();
    await expect(
      dono.locator("li.cartao", { hasText: NOME_BENEFICIO }).getByText("Ligado"),
    ).toBeVisible({
      timeout: 30_000,
    });
    await dono.screenshot({ path: FOTO("b4-dono-aceitou") });

    await anon.goto("/beneficios");
    await expect(anon.getByText(NOME_BENEFICIO).first()).toBeVisible();
    await expect(anon.getByRole("button", { name: /resgatar|cupom|sorteio/i })).toHaveCount(0);
    await expect(anon.getByRole("link", { name: /resgatar/i })).toHaveCount(0);
    expect(await anon.content()).not.toMatch(/service_role|sb_secret|wa\.me|mailto:/i);
    await anon.screenshot({ path: FOTO("b4-vitrine-anonima") });
  });

  // ------------------------------------------------------------------------------------------------ Bloco 5 (a)
  test("B5a indicador clica em Sair da base, confirma e some da base do dono", async () => {
    const ind = S("ind");
    await ind.goto("/minhas-participacoes");
    const cartao = ind.locator("li.cartao", { hasText: NOME_PERFIL }).first();
    await expect(cartao).toBeVisible();
    await cartao.getByRole("button", { name: /Sair da base/ }).click();
    await expect(ind.getByText(/Você deixa de aparecer na base de relacionamento/)).toBeVisible();
    await ind.getByRole("button", { name: "Confirmar saída" }).click();
    await expect(ind.getByText("Você saiu da base deste perfil.")).toBeVisible({ timeout: 30_000 });
    await ind.screenshot({ path: FOTO("b5-saiu-da-base") });

    const dono = S("dono");
    await dono.goto(`/meus-perfis/${perfilId}/base`);
    await expect(dono.locator("li.cartao", { hasText: NOME_REDUZIDO })).toHaveCount(0);
    await expect(dono.locator("dl.resumo-base")).toContainText("Saídas");
    await dono.screenshot({ path: FOTO("b5-base-sem-indicador") });
  });

  // ------------------------------------------------------------------------------------------------ Limpeza
  test("limpeza: desliga os benefícios E2E e restaura o nome do indicador", async () => {
    const dono = S("dono");
    if (!perfilId) {
      await dono.goto("/meus-perfis");
      const hrefs = await dono
        .locator('a[href^="/meus-perfis/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      perfilId = hrefs.find((h) => /^\/meus-perfis\/[0-9a-f-]{36}$/.test(h))!.split("/")[2]!;
    }
    await dono.goto(`/meus-perfis/${perfilId}/beneficios`);
    for (let guarda = 0; guarda < 10; guarda++) {
      const ligado = dono
        .locator("li.cartao", { hasText: "E2E" })
        .filter({ has: dono.getByRole("button", { name: "Desligar" }) })
        .first();
      if ((await ligado.count()) === 0) break;
      await ligado.getByRole("button", { name: "Desligar" }).click();
      await dono.goto(`/meus-perfis/${perfilId}/beneficios`);
    }
    await expect(
      dono.locator("li.cartao", { hasText: "E2E" }).getByRole("button", { name: "Desligar" }),
    ).toHaveCount(0);
    await dono.screenshot({ path: FOTO("limpeza-beneficios") });

    const ind = S("ind");
    await ind.goto("/minha-conta");
    const campo = ind.getByRole("textbox", { name: "Nome", exact: true });
    const atual = await campo.inputValue();
    const alvo = nomeOriginalIndicador || (atual === NOME_INDICADOR_TESTE ? "Indicador" : atual);
    if (atual !== alvo) {
      await campo.fill(alvo);
      await ind.getByRole("button", { name: "Salvar nome" }).click();
      await expect(ind.getByText("Nome atualizado.")).toBeVisible();
    }
  });
});
