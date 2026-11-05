import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

// Fase 7, listas do administrador (IM-061 a IM-073, IM-029, IM-041, IM-050). SOMENTE LEITURA contra o DEV: só GET com
// valores hostis na URL; nenhum formulário é enviado (comissoes_* é só-inserção e permanente). Não imprime dados.
const HOSTIS = [
  "aba=negocios&pagina=-1",
  "aba=negocios&pagina=99999999999999999999",
  "aba=negocios&pagina=abc",
  "aba=negocios&limite=100000",
  "aba=assinaturas&estado=%27%3B+drop+table+x%3B--",
  "aba=pagamentos&estado=inexistente",
  "aba=comissoes&estado=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  "aba=vinculos&negocio=nao-e-uuid",
  "aba=vinculos&negocio=00000000-0000-4000-8000-000000000000",
  "aba=assinaturas&negocio=00000000-0000-4000-8000-000000000000&estado=ativa&pagina=2",
  "aba=negocios&busca=%25_%5C%27%22",
  `aba=negocios&busca=${"a".repeat(500)}`,
  "aba=invalida",
  "aba=pagamentos&aba=vinculos&estado=a&estado=b",
];

const TECNICO =
  /stack|TypeError|ReferenceError|undefined|\[object|PGRST|42501|22023|comissoes_[a-z_]+|supabase|service_role|at \w+ \(/i;
const UUID_COMPLETO = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

async function lerTela(page: Page) {
  return (await page.locator("main").innerText()) ?? "";
}

test.describe("listas de comissões com GET hostil (somente leitura)", () => {
  test("admin: valores hostis não quebram a tela, não vazam e não geram rolagem horizontal", async ({
    page,
  }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    for (const q of HOSTIS) {
      const r = await page.goto(`/administracao/comissoes?${q}`);
      expect(r?.status(), q.slice(0, 60)).toBe(200);
      const texto = await lerTela(page);
      expect(texto, q.slice(0, 60)).not.toMatch(TECNICO);
      expect(texto, q.slice(0, 60)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // e-mail
      expect(texto, q.slice(0, 60)).not.toMatch(/\+55|\(\d{2}\)\s?\d{4,5}-\d{4}/); // telefone
      expect(texto, q.slice(0, 60)).not.toMatch(UUID_COMPLETO); // conta só como identificador curto
      const estoura = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(estoura, q.slice(0, 60)).toBe(false);
    }
  });

  test("admin: listas reais mostram só identificador curto e nenhum botão de cobrança", async ({
    page,
  }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    for (const aba of ["negocios", "assinaturas", "pagamentos", "comissoes", "vinculos"]) {
      await page.goto(`/administracao/comissoes?aba=${aba}`);
      const texto = await lerTela(page);
      expect(texto, aba).not.toMatch(UUID_COMPLETO);
      expect(texto, aba).not.toMatch(/cobrança automática|repasse automático|débito automático/i);
      // Só os links do próprio sistema mudam de aba; botões de ação ficam dentro de <details>.
      await expect(
        page.getByRole("button", { name: /cobrar|pagar agora|transferir|enviar cobrança/i }),
      ).toHaveCount(0);
    }
  });

  test("indicador: GET hostil em /comissoes não vaza dados de cliente", async ({ page }) => {
    exigirConta("indicador");
    await entrar(page, "indicador");
    const r = await page.goto("/comissoes?pagina=-1&estado=%27%22");
    expect(r?.status()).toBe(200);
    const texto = await lerTela(page);
    expect(texto).not.toMatch(TECNICO);
    expect(texto).not.toMatch(UUID_COMPLETO);
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test("outros papéis recebem 404 também com GET hostil (nada é revelado)", async ({ page }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    for (const q of HOSTIS.slice(0, 4)) {
      const r = await page.goto(`/administracao/comissoes?${q}`);
      expect(r?.status()).toBe(404);
      const html = await page.content();
      expect(html).not.toMatch(/Prazo de inadimpl/);
    }
  });
});
