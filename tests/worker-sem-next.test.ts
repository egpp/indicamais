import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O Worker agendado (worker/entrada.ts) não pode puxar `next/*` pelo caminho do `scheduled`: o bundle do
 * Wrangler carrega o módulo no escopo global e `next/server` traz ua-parser-js, que usa `__dirname`. A
 * Cloudflare recusa o deploy (erro 10021, "__dirname is not defined"). Regressão do deploy dev de 07/11/2026.
 * Segue só os imports internos (relativos e `@/`), sem tocar em .open-next.
 */
const RAIZ = resolve(__dirname, "..");
const IMPORTA = /(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;

function resolverInterno(origem: string, alvo: string): string | null {
  const base = alvo.startsWith("@/")
    ? join(RAIZ, "src", alvo.slice(2))
    : alvo.startsWith(".")
      ? resolve(dirname(origem), alvo)
      : null;
  if (!base || base.includes(".open-next")) return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), base]) {
    if (existsSync(c) && /\.tsx?$/.test(c)) return c;
  }
  return null;
}

function externosAlcancaveis(entrada: string): Map<string, string> {
  const vistos = new Set<string>();
  const externos = new Map<string, string>();
  const fila = [entrada];
  while (fila.length > 0) {
    const arq = fila.pop()!;
    if (vistos.has(arq)) continue;
    vistos.add(arq);
    const fonte = readFileSync(arq, "utf8").replace(/^\s*import type[^;]*;/gm, "");
    for (const m of fonte.matchAll(IMPORTA)) {
      const alvo = m[1] ?? m[2];
      const interno = resolverInterno(arq, alvo);
      if (interno) fila.push(interno);
      else if (!alvo.startsWith(".") && !alvo.startsWith("@/")) externos.set(alvo, arq);
    }
  }
  return externos;
}

describe("worker/entrada.ts (Cron Trigger)", () => {
  it("não alcança next/* pelos imports (evita __dirname no escopo global do Worker)", () => {
    const externos = externosAlcancaveis(join(RAIZ, "worker", "entrada.ts"));
    const doNext = [...externos.keys()].filter((n) => n === "next" || n.startsWith("next/"));
    expect(doNext).toEqual([]);
  });
});
