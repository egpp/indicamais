/**
 * O rodapé novo vale para todas as páginas (inclusive painel e administração): confere presença, ausência de
 * rolagem horizontal, que o rodapé não cobre o conteúdo/menu lateral e salva capturas em test-results/rodape/.
 * Só DEV. Rode com --workers=1.
 */
import { expect, test } from "@playwright/test";
import { entrar, exigirConta, type Papel } from "./contas";

const PAGINAS: { papel: Papel | null; rota: string }[] = [
  { papel: null, rota: "/entrar" },
  { papel: null, rota: "/cadastro" },
  { papel: null, rota: "/perfil/natu-superalimentos" },
  { papel: null, rota: "/politica-de-privacidade" },
  { papel: "dono", rota: "/meus-perfis" },
  { papel: "dono", rota: "/minha-conta" },
  { papel: "admin", rota: "/administracao" },
];

for (const { papel, rota } of PAGINAS) {
  test(`rodapé em ${rota}${papel ? ` (${papel})` : ""}`, async ({ page }, info) => {
    if (papel) {
      exigirConta(papel);
      await entrar(page, papel);
    }
    const resp = await page.goto(rota);
    test.skip(resp?.status() === 404, "Rota inexistente neste DEV.");
    const rodape = page.getByRole("contentinfo");
    await expect(rodape).toHaveCount(1);
    await rodape.scrollIntoViewIfNeeded();
    await expect(rodape).toBeVisible();
    await expect(rodape).not.toContainText(/instagram|facebook|youtube|tiktok|planos/i);
    const folga = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(folga).toBeLessThanOrEqual(0);
    // O rodapé fica abaixo do conteúdo principal (não sobrepõe).
    const r = await rodape.boundingBox();
    const m = await page.locator("main").first().boundingBox();
    if (r && m) expect(r.y + 1).toBeGreaterThanOrEqual(m.y + m.height - 1);
    const nome = rota.replace(/\W+/g, "_");
    await page.screenshot({
      path: `test-results/rodape/${nome}-${info.project.name}.png`,
      fullPage: false,
    });
  });
}
