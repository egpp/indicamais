import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Worker agendado + notificações de contato (IM-027, IM-028, IM-080, IM-086)", () => {
  const entrada = ler("worker/entrada.ts");
  const cron = ler("src/app/_lib/notificacoes-cron.ts");

  it("a entrada só passa ao módulo as variáveis de e-mail; sem process.env nem createClient", () => {
    expect(entrada).toMatch(/tarefasNotificacoesCron\(\{/);
    expect(entrada).not.toMatch(/process\.env|createClient/);
  });

  it("o código que o Worker empacota não importa Next, 'server-only' nem arquivos internos de módulo", () => {
    expect(cron).not.toMatch(/from "next|server-only|"use server"/);
    for (const m of cron.matchAll(/from "(@\/modules\/[^"]+)"/g)) {
      expect(m[1]).toMatch(/^@\/modules\/[a-z]+$/);
    }
    const imports = [...cron.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
    for (const i of imports) {
      expect(i).toMatch(/^(@\/|\.\/|@supabase\/supabase-js$)/);
    }
  });

  it("sem EMAIL_API_KEY/EMAIL_FROM/URL devolve vazio antes de qualquer acesso ao banco", () => {
    const corpo = cron.slice(cron.indexOf("export async function processarNotificacoesNoCron"));
    const fim = corpo.indexOf("return {};");
    const primeiroBanco = corpo.indexOf("d.banco");
    expect(fim).toBeGreaterThan(0);
    expect(fim).toBeLessThan(primeiroBanco);
  });

  it("não registra nada em log (só o agendador loga contagens) nem lê a chave de serviço", () => {
    expect(cron).not.toMatch(/console\.|SERVICE_ROLE/);
  });
});
