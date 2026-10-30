import { expect, test, type Page } from "@playwright/test";

// Contas de teste do ambiente de DESENVOLVIMENTO (D-011). Valores vêm só de variáveis
// de ambiente (.env.local); este arquivo nunca os registra nem os imprime.
export type Papel = "dono" | "indicador" | "admin";

const PREFIXO: Record<Papel, string> = {
  dono: "E2E_DONO",
  indicador: "E2E_INDICADOR",
  admin: "E2E_ADMIN",
};

export function nomesFaltando(papel: Papel): string[] {
  const p = PREFIXO[papel];
  return [`${p}_EMAIL`, `${p}_SENHA`].filter((nome) => !process.env[nome]);
}

export function credenciais(papel: Papel): { email: string; senha: string } {
  const p = PREFIXO[papel];
  return { email: process.env[`${p}_EMAIL`] ?? "", senha: process.env[`${p}_SENHA`] ?? "" };
}

/** Chame dentro de test/describe: pula o teste informando só os NOMES das variáveis ausentes. */
export function exigirConta(papel: Papel): void {
  const faltam = nomesFaltando(papel);
  test.skip(faltam.length > 0, `Defina no .env.local: ${faltam.join(", ")}.`);
}

/** Entra pela tela /entrar. Espera sair de /entrar; destino padrão: qualquer rota. */
export async function entrar(page: Page, papel: Papel, destino: RegExp = /^(?!.*\/entrar)/) {
  const { email, senha } = credenciais(papel);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(destino);
}
