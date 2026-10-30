import { test } from "@playwright/test";
import { entrar, exigirConta, type Papel } from "./contas";

// Login real por tela com cada conta de teste de dev (D-011, IM-006).
for (const papel of ["dono", "indicador", "admin"] as Papel[]) {
  test(`login por tela com a conta ${papel}`, async ({ page }) => {
    exigirConta(papel);
    await entrar(page, papel);
  });
}
