/**
 * Fase 9 · limite de curtir/descurtir (IM-043, D-013, P0429) no DEV. OPT-IN: define E2E_LIMITE_CURTIR=1.
 * Por quê opt-in: a regra bloqueia a MESMA pessoa no MESMO perfil por 24 h depois de 10 mudanças, então rodar este
 * teste impede, pelo resto da janela, os fluxos de curtir de fase9-fluxos.spec.ts com a conta E2E_INDICADOR.
 * Descurtir também conta no limite (relacionamento_descurtir chama relacionamento_checar_alternancia).
 * Estado final: fora da base do perfil (Sair da base não entra no limite).
 */
import { expect, test } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const CAMINHO = "/perfil/perfil-1";
const FOTO = (n: string) => `test-results/fase9/${n}.png`;

test("B2.6 limite de curtir/descurtir: P0429 com mensagem neutra, sem alterar a curtida; Sair da base segue livre", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Só no desktop.");
  test.skip(
    process.env.E2E_LIMITE_CURTIR !== "1",
    "Opt-in: E2E_LIMITE_CURTIR=1 (bloqueia a conta por 24 h).",
  );
  exigirConta("indicador");
  test.setTimeout(240_000);
  await entrar(page, "indicador");
  await page.goto(CAMINHO);

  const curtir = page.getByRole("button", { name: "Curtir", exact: true });
  const descurtir = page.getByRole("button", { name: "Descurtir" });
  const bloqueio = page.getByText("Muitas alterações em pouco tempo. Tente novamente mais tarde.");

  let bloqueado = false;
  for (let i = 0; i < 16 && !bloqueado; i++) {
    await expect(curtir.or(descurtir)).toBeVisible();
    const estavaCurtido = await descurtir.isVisible();
    await (estavaCurtido ? descurtir : curtir).click();
    const sucesso = page.getByText(
      estavaCurtido ? "Curtida removida." : "Você curtiu este perfil.",
    );
    await expect(bloqueio.or(sucesso).first()).toBeVisible({ timeout: 30_000 });
    if (await bloqueio.isVisible()) {
      bloqueado = true;
      await page.screenshot({ path: FOTO("b2-limite-bloqueio") });
      // Nada foi alterado: depois de recarregar, o botão é o mesmo de antes do clique.
      await page.goto(CAMINHO);
      await expect(estavaCurtido ? descurtir : curtir).toBeVisible();
    } else {
      await page.goto(CAMINHO);
    }
  }
  expect(bloqueado, "10 mudanças em 24 h devem bloquear a próxima").toBe(true);

  // Sair da base não conta no limite; depois disso, curtir de novo continua bloqueado.
  await page.goto("/minhas-participacoes");
  const sair = page
    .locator("li.cartao", { hasText: "perfil 1" })
    .getByRole("button", { name: /Sair da base/ });
  if ((await sair.count()) > 0) {
    await sair.click();
    await page.getByRole("button", { name: "Confirmar saída" }).click();
    await expect(page.getByText("Você saiu da base deste perfil.")).toBeVisible({
      timeout: 30_000,
    });
  }
  await page.goto(CAMINHO);
  await expect(curtir).toBeVisible();
  await curtir.click();
  await expect(bloqueio).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: FOTO("b2-limite-curtir-bloqueado-apos-sair") });
  await page.goto(CAMINHO);
  await expect(curtir).toBeVisible();
});
