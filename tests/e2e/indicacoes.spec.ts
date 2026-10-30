/**
 * Fase 3 · fluxo de indicação e contato ponta a ponta no ambiente de DESENVOLVIMENTO (D-011).
 * IM-013, IM-024, IM-025, IM-026, IM-027, IM-028, IM-029, IM-034, IM-041, IM-050, IM-079, IM-005.
 *
 * Destino: perfil público "natu-superalimentos" (dono = conta administradora original, não as contas E2E_*).
 * Dados fictícios: nome "E2E Teste"; WhatsApp 11999990002 (desktop) e 11999990003 (celular), um por projeto
 * para os dois projetos não colidirem na janela anti-repetição (10 min) do mesmo WhatsApp e destino.
 * Os testes toleram rodadas anteriores: repetir o contato dentro da janela devolve o pedido existente.
 * Nenhum teste usa service_role nem cria usuários. Credenciais só por variáveis E2E_* (nunca impressas).
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const SLUG = "natu-superalimentos";
const CAMINHO = `/perfil/${SLUG}`;
const NOME_VISITANTE = "E2E Teste";

const WHATSAPP_POR_PROJETO: Record<string, { digitos: string; mascara: string }> = {
  desktop: { digitos: "11999990002", mascara: "(11) 99999-0002" },
  celular: { digitos: "11999990003", mascara: "(11) 99999-0003" },
};

function whatsappDoProjeto() {
  const nome = test.info().project.name;
  return WHATSAPP_POR_PROJETO[nome] ?? WHATSAPP_POR_PROJETO.desktop!;
}

/** wa.me é externo: nenhum teste sai do servidor local. Devolve uma página inerte. */
async function bloquearWhatsapp(contexto: BrowserContext) {
  await contexto.route(/https:\/\/wa\.me\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>wa.me (bloqueado no teste)</body></html>",
    }),
  );
}

async function clicarIndique(page: Page) {
  await page.getByRole("button", { name: "Indique esta empresa" }).click();
}

/** Confere que o perfil de teste existe publicado; sem ele nada abaixo faz sentido. */
async function abrirPerfil(page: Page, consulta = "") {
  const r = await page.goto(`${CAMINHO}${consulta}`);
  expect(r?.status(), "perfil natu-superalimentos precisa estar publicado no dev").toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

let codigoLink = "";

test.describe.configure({ mode: "serial" });

test.describe("página pública: botões (IM-013)", () => {
  test("tem Quero entrar em contato e Indique, e só o convite a entrar para curtir (IM-043)", async ({
    page,
  }) => {
    await abrirPerfil(page);
    await expect(page.getByRole("link", { name: "Quero entrar em contato" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Indique esta empresa" })).toBeVisible();
    // Visitante: só o convite a entrar (IM-043, D-013); nenhum botão de curtir.
    await expect(page.getByRole("button", { name: /curtir/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Entrar para curtir" })).toBeVisible();
  });

  test("no celular nada estoura a largura da tela (IM-005)", async ({ page }) => {
    await abrirPerfil(page);
    const { rolagem, largura } = await page.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth,
      largura: document.documentElement.clientWidth,
    }));
    expect(rolagem).toBeLessThanOrEqual(largura + 1);
  });

  test("o HTML público não traz WhatsApp, e-mail nem wa.me do responsável (IM-029, IM-041)", async ({
    request,
  }) => {
    const r = await request.get(CAMINHO);
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).not.toMatch(/wa\.me|mailto:|\+55[0-9]{8,}|service_role|sb_secret/i);
  });

  test("anônimo que clica em Indique é levado a entrar, voltando para a página", async ({
    page,
  }) => {
    await abrirPerfil(page);
    await clicarIndique(page);
    await expect(page.getByText("Entre na sua conta para continuar.")).toBeVisible();
    const entrarLink = page.locator('a.botao[href^="/entrar"]').first(); // o 2º é "Entrar para curtir"
    await expect(entrarLink).toHaveAttribute(
      "href",
      `/entrar?proximo=${encodeURIComponent(CAMINHO)}`,
    );
    await expect(page.locator("a.botao", { hasText: "Criar conta" })).toBeVisible();
  });
});

test.describe("indicador gera e compartilha o link (IM-024)", () => {
  test("gera link com ?ind=, copia e oferece compartilhar no WhatsApp", async ({
    page,
    context,
  }) => {
    exigirConta("indicador");
    await context
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" })
      .catch(() => undefined);
    await entrar(page, "indicador");
    await abrirPerfil(page);
    await clicarIndique(page);

    const campo = page.getByLabel("Seu link de indicação");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    const url = await campo.inputValue();
    expect(url).toMatch(new RegExp(`${CAMINHO}\\?ind=[0-9a-f]{32}$`));
    codigoLink = /ind=([0-9a-f]{32})/.exec(url)![1]!;

    // Copiar
    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByText(/Link copiado\.|Não foi possível copiar sozinho/)).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copiado !== null) expect(copiado).toBe(url);

    // Compartilhar no WhatsApp: wa.me/?text= com o link dentro (não abre: só confere o endereço)
    const compartilhar = page.getByRole("link", { name: "Compartilhar no WhatsApp" });
    const href = (await compartilhar.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain(`ind=${codigoLink}`);
    await expect(compartilhar).toHaveAttribute("target", "_blank");
    await expect(compartilhar).toHaveAttribute("rel", /noopener/);
  });

  test("gerar de novo devolve o MESMO link (um link por indicador e destino)", async ({ page }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    await abrirPerfil(page);
    await clicarIndique(page);
    const campo = page.getByLabel("Seu link de indicação");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    expect(await campo.inputValue()).toContain(`ind=${codigoLink}`);
  });

  test("conta sem WhatsApp cadastrado vê o aviso e o caminho para cadastrar", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await abrirPerfil(page);
    await clicarIndique(page);
    const aviso = page.getByText("Cadastre seu WhatsApp na sua conta antes de indicar.");
    const link = page.getByLabel("Seu link de indicação");
    await expect(aviso.or(link)).toBeVisible({ timeout: 20_000 });
    test.skip(
      await link.isVisible(),
      "A conta E2E_DONO já tem WhatsApp cadastrado; o aviso sem WhatsApp está coberto por Vitest e pgTAP (P0412).",
    );
    await expect(page.getByRole("link", { name: "Cadastrar meu WhatsApp" })).toHaveAttribute(
      "href",
      "/minha-conta",
    );
  });
});

test.describe("visitante anônimo envia contato (IM-026, IM-028, IM-025)", () => {
  test("validações: campos vazios e WhatsApp inválido não enviam", async ({ page }) => {
    await abrirPerfil(page, `?ind=${codigoLink || "0".repeat(32)}`);
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.locator(".erro-campo").first()).toBeVisible();
    await expect(page.getByText("Abrir WhatsApp")).toHaveCount(0);

    await page.getByLabel("Seu nome").fill(NOME_VISITANTE);
    await page.getByLabel("Seu WhatsApp").fill("abc");
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.locator(".erro-campo").first()).toBeVisible();
    await page.getByLabel("Seu WhatsApp").fill("123");
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.locator(".erro-campo").first()).toBeVisible();

    await page.getByLabel("Seu WhatsApp").fill("11999990002");
    await page.getByLabel("Seu e-mail").fill("sem-arroba");
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.locator(".erro-campo").first()).toBeVisible();
    await expect(page.getByText("Abrir WhatsApp")).toHaveCount(0);
  });

  test("envia com ?ind: duplo clique gera um só envio, mostra confirmação e o WhatsApp do responsável", async ({
    page,
    context,
  }) => {
    test.skip(!codigoLink, "Depende do link gerado pelo indicador (E2E_INDICADOR ausente).");
    await bloquearWhatsapp(context);
    const acoes: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) acoes.push(req.url());
    });
    await abrirPerfil(page, `?ind=${codigoLink}`);
    const wa = whatsappDoProjeto();
    await page.getByLabel("Seu nome").fill(NOME_VISITANTE);
    await page.getByLabel("Seu WhatsApp").pressSequentially(wa.digitos);
    await expect(page.getByLabel("Seu WhatsApp")).toHaveValue(wa.mascara);
    await page.getByLabel("Mensagem").fill("Mensagem de teste automatizado.");
    await page.getByRole("button", { name: "Enviar pedido de contato" }).dblclick();

    await expect(page.getByText("Pedido enviado.")).toBeVisible({ timeout: 30_000 });
    const abrir = page.getByRole("link", { name: "Abrir WhatsApp" });
    await expect(abrir).toBeVisible();
    const href = (await abrir.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/55[0-9]{10,11}\?text=/);
    // O texto pronto leva só o nome do visitante e do destino, nunca o WhatsApp dele.
    expect(decodeURIComponent(href)).not.toContain(wa.digitos);
    expect(acoes.length, "o duplo clique deve disparar no máximo 1 envio").toBeLessThanOrEqual(1);
  });

  test("XSS e injeção nos campos viram texto, nunca executam (desktop)", async ({
    page,
    context,
  }) => {
    test.skip(
      test.info().project.name !== "desktop",
      "Um envio de carga hostil basta (limite de pedidos por WhatsApp).",
    );
    await bloquearWhatsapp(context);
    await abrirPerfil(page);
    await page.getByLabel("Seu nome").fill("E2E <img src=x onerror=window.__xss=1>");
    await page.getByLabel("Seu WhatsApp").pressSequentially("11999990005");
    await page
      .getByLabel("Mensagem")
      .fill(`"><script>window.__xss=2</script> ' OR 1=1 -- &text=injetado`);
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.getByText("Pedido enviado.")).toBeVisible({ timeout: 30_000 });
    const href =
      (await page.getByRole("link", { name: "Abrir WhatsApp" }).getAttribute("href")) ?? "";
    // O texto do visitante é codificado: só UM parâmetro text, sem &text= extra, sem < ou aspas soltas.
    expect(href).toMatch(/^https:\/\/wa\.me\/55[0-9]{10,11}\?text=[^&<>"' ]+$/);
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
  });
});

test.describe("atribuição só no destino do link (IM-025)", () => {
  test("outro destino não herda o ?ind e nada vai para cookie ou armazenamento", async ({
    page,
  }) => {
    test.skip(!codigoLink, "Depende do link gerado pelo indicador (E2E_INDICADOR ausente).");
    await abrirPerfil(page, `?ind=${codigoLink}`);

    const hrefsComInd = await page.locator("a[href*='ind=']").count();
    expect(hrefsComInd, "nenhum link da página leva ?ind adiante").toBe(0);
    await expect(page.locator("input[name=ind]")).toHaveCount(1); // só o formulário DESTE destino

    // Navegação para um item deste perfil: sem ?ind e sem campo ind
    const item = page.locator("a[href^='/item/']").first();
    if ((await item.count()) > 0) {
      await item.click();
      await expect(page).toHaveURL(/\/item\/[0-9a-f-]{36}$/);
      expect(page.url()).not.toContain("ind=");
      await expect(page.locator("input[name=ind]")).toHaveCount(0);
    }
    // Voltar à página inicial e a outro perfil também não leva o código
    await page.goto("/");
    await expect(page.locator("input[name=ind]")).toHaveCount(0);

    const armazenado = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      sessao: JSON.stringify(sessionStorage),
    }));
    expect(JSON.stringify(armazenado)).not.toContain(codigoLink);
    const cookies = await page.context().cookies();
    expect(JSON.stringify(cookies)).not.toContain(codigoLink);
  });

  test("código malformado em ?ind é descartado em silêncio (campo escondido não aparece)", async ({
    page,
  }) => {
    await abrirPerfil(page, `?ind=${encodeURIComponent("<script>alert(1)</script>")}`);
    await expect(page.locator("input[name=ind]")).toHaveCount(0);
    expect(await page.content()).not.toContain("<script>alert(1)</script>");
  });
});

test.describe("indicador em Minhas indicações (IM-029)", () => {
  test("vê o link e a indicação, sem nenhum dado do visitante", async ({ page }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    await page.goto("/minhas-indicacoes");
    await expect(page.getByRole("heading", { level: 1, name: "Minhas indicações" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Links que gerei" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copiar ou compartilhar de novo" }).first(),
    ).toBeVisible();

    // HTML cru da resposta (inclui o payload RSC) e texto visível: nada do visitante
    const bruto = await (await page.request.get("/minhas-indicacoes")).text();
    const visivel = await page.locator("body").innerText();
    for (const alvo of [bruto, visivel, await page.content()]) {
      expect(alvo).not.toContain(NOME_VISITANTE);
      expect(alvo).not.toMatch(
        /99999-?0002|99999-?0003|11999990002|11999990003|11999990005|99999-?0005|mensagem de teste automatizado/i,
      );
      expect(alvo).not.toContain("E2E <img");
    }
    // A indicação aparece como "Pedido de contato recebido" quando o pedido veio com o link.
    await expect(page.getByText("Pedido de contato recebido").first()).toBeVisible();
  });
});

test.describe("responsável pelo perfil (IM-027, IM-028, IM-034)", () => {
  /** Só segue se E2E_ADMIN for dono do natu (não é falha se não for). */
  async function entrarSeDono(page: Page) {
    exigirConta("admin");
    await entrar(page, "admin");
    await page.goto("/meus-perfis");
    const dono = await page.getByText(/natu/i).count();
    test.skip(
      dono === 0,
      "A conta E2E_ADMIN não é dona do perfil natu-superalimentos (nem aparece em Meus perfis): fluxo do responsável não executado.",
    );
  }

  test("pedido aparece em Pedidos de contato com origem e legenda do aviso por e-mail", async ({
    page,
  }) => {
    await entrarSeDono(page);
    await page.goto("/pedidos-de-contato");
    const cartao = page.locator("li.cartao", { hasText: NOME_VISITANTE }).first();
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("Veio por indicação");
    await expect(cartao).toContainText(
      /Aviso por e-mail (ainda não configurado: veja aqui no painel|pendente|enviado)|O aviso por e-mail falhou/,
    );
    // Dados do visitante visíveis ao responsável (e só a ele)
    await expect(cartao).toContainText(/\(11\) 99999-000[23]/);
    // XSS: o texto aparece literal, nada executou
    const hostil = page.locator("li.cartao", { hasText: "E2E <img" }).first();
    if ((await hostil.count()) > 0) {
      await expect(hostil).toContainText("<img src=x onerror=window.__xss=1>");
    }
    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    // O HTML do painel não carrega a chave de serviço
    expect(await page.content()).not.toMatch(/service_role|sb_secret/i);
  });

  test("autoindicação: o dono não gera link para o próprio perfil", async ({ page }) => {
    await entrarSeDono(page);
    await abrirPerfil(page);
    await clicarIndique(page);
    await expect(
      page
        .getByText("Você não pode gerar link de indicação para o seu próprio perfil ou anúncio.")
        .or(page.getByText("Cadastre seu WhatsApp na sua conta antes de indicar.")),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Seu link de indicação")).toHaveCount(0);
  });
});

test.describe("permissões das telas administrativas (IM-041, IM-086)", () => {
  for (const caminho of ["/administracao/pedidos", "/administracao/parametros"]) {
    test(`conta comum recebe 404 em ${caminho}`, async ({ page }) => {
      exigirConta("dono");
      await entrar(page, "dono");
      const r = await page.goto(caminho);
      expect(r?.status()).toBe(404);
      await expect(page.getByText(/WhatsApp|Veio por indicação|janela/i)).toHaveCount(0);
    });

    test(`indicador (conta comum) recebe 404 em ${caminho}`, async ({ page }) => {
      exigirConta("indicador");
      await entrar(page, "indicador");
      const r = await page.goto(caminho);
      expect(r?.status()).toBe(404);
    });

    test(`anônimo em ${caminho} vai para /entrar`, async ({ page }) => {
      await page.goto(caminho);
      await expect(page).toHaveURL(/\/entrar\?aviso=sessao&proximo=/);
    });
  }

  for (const caminho of ["/pedidos-de-contato", "/minhas-indicacoes"]) {
    test(`anônimo em ${caminho} vai para /entrar`, async ({ page }) => {
      await page.goto(caminho);
      await expect(page).toHaveURL(/\/entrar\?aviso=sessao&proximo=/);
    });
  }

  test("conta comum sem perfis não vê pedidos de ninguém em Pedidos de contato", async ({
    page,
  }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    await page.goto("/pedidos-de-contato");
    await expect(page.locator("li.cartao", { hasText: NOME_VISITANTE })).toHaveCount(0);
  });

  test("destino inexistente e página sem perfil dão o mesmo 404", async ({ page }) => {
    const a = await page.goto("/perfil/nao-existe-e2e");
    const b = await page.goto("/item/00000000-0000-4000-8000-000000000000");
    expect(a?.status()).toBe(404);
    expect(b?.status()).toBe(404);
  });
});

test.describe("política de privacidade (IM-026)", () => {
  test("existe, é marcada como provisória e o formulário aponta para ela", async ({ page }) => {
    await abrirPerfil(page);
    // O rodapé também tem o link; o do formulário fica dentro de <main>.
    await page
      .getByRole("main")
      .getByRole("link", { name: /política de privacidade/i })
      .click();
    await expect(page).toHaveURL(/\/politica-de-privacidade$/);
    await expect(page.getByText(/provisório/i).first()).toBeVisible();
  });
});
