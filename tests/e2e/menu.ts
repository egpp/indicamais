import type { Page } from "@playwright/test";

/** Menu lateral do painel (D-015). Em telas largas ele já está à mostra; no celular abre pelo botão de menu. */
export const menuPrincipal = (page: Page) => page.getByRole("navigation", { name: "Principal" });

export async function abrirMenuSeCelular(page: Page) {
  const botao = page.getByRole("button", { name: "Abrir menu" });
  if (await botao.isVisible()) {
    await botao.click();
    await menuPrincipal(page).waitFor({ state: "visible" });
  }
}

export async function fecharMenuSeCelular(page: Page) {
  const botao = page.getByRole("button", { name: "Fechar menu" });
  if (await botao.isVisible()) await botao.click();
}
