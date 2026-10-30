import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// O Playwright nao le .env.local sozinho. process.loadEnvFile (Node >= 20.12) carrega sem
// sobrescrever variaveis ja definidas e nunca imprime valores.
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Arquivo ilegivel: segue sem ele; os testes autenticados serao pulados.
  }
}

// Testes ponta a ponta contra o ambiente de DESENVOLVIMENTO (D-011, D-003).
// Nunca apontar para producao. O CI nao roda e2e por enquanto: precisa de
// contas de teste (E2E_*) e de servidor com Supabase de dev.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Chromium com viewport de celular (nao exige WebKit).
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
