/**
 * Capturas de tela do sistema de design (D-010; IM-005, IM-014). Só ambiente de DESENVOLVIMENTO.
 * Gera test-results/capturas/<projeto>/<tela>.png (fora do git) e confere, em cada tela:
 * sem rolagem horizontal e alvos de toque (links e botões visíveis) com pelo menos 44px de altura.
 * Telas autenticadas são puladas se faltarem as contas E2E_* (ver contas.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta, type Papel } from "./contas";

async function capturar(page: Page, projeto: string, nome: string) {
  await page.waitForLoadState("load");
  await page.screenshot({
    path: `test-results/capturas/${projeto}/${nome}.png`,
    fullPage: true,
  });
  const problemas = await page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const rolagem = document.documentElement.scrollWidth > largura + 1;
    const pequenos: string[] = [];
    document
      .querySelectorAll<HTMLElement>("a, button, summary, input, select, textarea")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // O link do título cobre o card inteiro (::after): o alvo real é o card.
        if (el.classList.contains("card-link")) return;
        // Campo-armadilha de robôs (IM-076): fora da tela, escondido e fora do foco; não é alvo de toque.
        if (el.closest('[aria-hidden="true"]')) return;
        if (el instanceof HTMLInputElement && ["hidden", "checkbox", "radio"].includes(el.type))
          return;
        // Link dentro de parágrafo de texto corrido não conta; os demais precisam de 44px.
        if (
          el.tagName === "A" &&
          el.closest("p:not(.marca):not(.rodape-links)") &&
          !el.classList.contains("botao")
        )
          return;
        if (r.height < 43.5)
          pequenos.push(
            `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.height)}px`,
          );
      });
    return { rolagem, pequenos };
  });
  expect.soft(problemas.rolagem, `${nome}: rolagem horizontal`).toBe(false);
  expect.soft(problemas.pequenos, `${nome}: alvos de toque menores que 44px`).toEqual([]);
}

test.describe("públicas", () => {
  for (const [nome, rota] of [
    ["home", "/"],
    ["entrar", "/entrar"],
    ["cadastro", "/cadastro"],
    ["recuperar-senha", "/recuperar-senha"],
    ["politica-de-privacidade", "/politica-de-privacidade"],
    ["nao-encontrada", "/rota-que-nao-existe"],
  ] as const) {
    test(nome, async ({ page }, info) => {
      await page.goto(rota);
      await capturar(page, info.project.name, nome);
    });
  }

  test("perfil e item (primeiro card da home)", async ({ page }, info) => {
    await page.goto("/");
    const perfil = page.locator('a.card-link[href^="/perfil/"]').first();
    if ((await perfil.count()) > 0) {
      await page.goto((await perfil.getAttribute("href")) ?? "/");
      await capturar(page, info.project.name, "perfil");
    }
    await page.goto("/");
    const item = page.locator('a.card-link[href^="/item/"]').first();
    if ((await item.count()) > 0) {
      await page.goto((await item.getAttribute("href")) ?? "/");
      await capturar(page, info.project.name, "item");
    }
  });
});

const AUTENTICADAS: { papel: Papel; telas: [string, string][] }[] = [
  {
    papel: "dono",
    telas: [
      ["meus-perfis", "/meus-perfis"],
      ["meus-itens", "/meus-itens"],
      ["meus-anuncios", "/meus-anuncios"],
      ["pedidos-de-contato", "/pedidos-de-contato"],
      ["minhas-indicacoes", "/minhas-indicacoes"],
      ["pontos", "/pontos"],
      ["minha-conta", "/minha-conta"],
    ],
  },
  {
    papel: "admin",
    telas: [
      ["admin-revisao", "/administracao/revisao"],
      ["admin-pontos", "/administracao/pontos"],
      ["admin-beneficios", "/administracao/beneficios"],
      ["admin-parametros", "/administracao/parametros"],
      ["admin-patrocinadores", "/administracao/patrocinadores"],
      ["admin-negocios", "/administracao/negocios"],
      ["admin-categorias", "/administracao/categorias"],
      ["admin-pedidos", "/administracao/pedidos"],
    ],
  },
];

for (const { papel, telas } of AUTENTICADAS) {
  test.describe(`autenticadas (${papel})`, () => {
    test(`telas do papel ${papel}`, async ({ page }, info) => {
      exigirConta(papel);
      await entrar(page, papel);
      for (const [nome, rota] of telas) {
        await page.goto(rota);
        await capturar(page, info.project.name, nome);
      }
    });
  });
}
