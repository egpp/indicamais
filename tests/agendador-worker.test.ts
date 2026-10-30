import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Worker agendado (IM-081, IM-086)", () => {
  const wrangler = ler("wrangler.jsonc");

  it("wrangler aponta para a entrada própria e tem Cron Trigger", () => {
    expect(wrangler).toMatch(/"main":\s*"worker\/entrada\.ts"/);
    expect(wrangler).toMatch(/"crons":\s*\[\s*"[^"]+"\s*\]/);
  });

  it("continua só no Worker de desenvolvimento", () => {
    expect(wrangler).toMatch(/"name":\s*"indicamais-dev"/);
  });

  it("a entrada reaproveita o fetch do OpenNext e expõe scheduled, sem rota HTTP de cron", () => {
    const e = ler("worker/entrada.ts");
    expect(e).toMatch(/\.open-next\/worker\.js/);
    expect(e).toMatch(/fetch:\s*handler\.fetch/);
    expect(e).toMatch(/async scheduled\(/);
    expect(e).not.toMatch(/createClient|process.env/);
  });

  it("variáveis novas só como nomes, sem valores", () => {
    for (const arq of [".env.example", ".dev.vars.example"]) {
      const valores = ler(arq)
        .split("\n")
        .filter((l) => /^(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)=/.test(l));
      expect(valores.length).toBeGreaterThan(0);
      expect(valores.every((l) => l.endsWith("="))).toBe(true);
    }
  });
});
