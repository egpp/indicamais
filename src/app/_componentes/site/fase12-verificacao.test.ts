import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detalhesDoItem } from "../../_lib/detalhes-item";
import { IDS_ESTILOS } from "./estilos";

// Verificação independente da Fase 12 (PR #33; IM-097, IM-101; D-023).
const DIR = __dirname;
const css = ["site-estilos.css", "site-estilos-novos.css"]
  .map((f) => readFileSync(join(DIR, f), "utf8"))
  .join("\n");

function variaveis(seletor: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`^${seletor}\\s*\\{([^}]*)\\}`, "gm");
  for (const m of css.matchAll(re)) {
    for (const v of m[1]!.matchAll(/(--s-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[v[1]!] = v[2]!;
  }
  return out;
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe("contraste dos novos elementos nos 21 estilos (D-023, WCAG AA)", () => {
  for (const id of IDS_ESTILOS) {
    it(`${id}: planos, equipe, lista e variações`, () => {
      const base = variaveis(`\\.site-${id}`);
      const faixa = { ...base, ...variaveis(`\\.site-${id} \\.st-faixa-alt`) };
      const falhas: string[] = [];
      for (const [ctx, v] of [
        ["base", base],
        ["faixa-alt", faixa],
      ] as const) {
        const par = (nome: string, a: string, b: string, min: number) => {
          const x = v[a];
          const y = v[b];
          if (!x || !y) return falhas.push(`${ctx} ${nome}: variavel ausente`);
          const r = razao(x, y);
          if (r < min) falhas.push(`${ctx} ${nome}: ${r.toFixed(2)} < ${min}`);
        };
        par("texto/superficie (plano, lista, select)", "--s-text", "--s-surface", 4.5);
        par("suave/superficie (preco periodo, equipe cargo)", "--s-suave", "--s-surface", 4.5);
        par("link/superficie (check dos planos)", "--s-link", "--s-surface", 3);
        par("borda-forte/superficie (select, botoes +/-)", "--s-borda-forte", "--s-surface", 3);
        par("foco/superficie", "--s-foco", "--s-surface", 3);
      }
      expect(falhas).toEqual([]);
    });
  }
});

// Ícone decorativo da Equipe (aria-hidden): fundo --s-surface e cor --s-link (corrigido; IM-101).
// Conferido na base e na faixa escura, nos 21 estilos.
describe("ícone decorativo da Equipe: link/surface >= 3 (base e faixa escura)", () => {
  for (const id of IDS_ESTILOS) {
    it(id, () => {
      const base = variaveis(`\.site-${id}`);
      const faixa = { ...base, ...variaveis(`\.site-${id} \.st-faixa-alt`) };
      for (const v of [base, faixa]) {
        expect(razao(v["--s-link"]!, v["--s-surface"]!)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe("entrada maliciosa em detalhesDoItem (D-023)", () => {
  it("tags viram texto curto (React escapa); nada é interpretado", () => {
    const d = detalhesDoItem("Tamanhos: <script>alert(1)</script>, <img src=x onerror=alert(1)>");
    expect(d.variacoes[0]?.opcoes.every((o) => o.length <= 30)).toBe(true);
  });
  it("ignora opções acima de 30 caracteres", () => {
    const d = detalhesDoItem(`Cores: ${"a".repeat(31)}, ok`);
    expect(d.variacoes[0]?.opcoes).toEqual(["ok"]);
  });
  it("periodicidade limitada a 40 caracteres", () => {
    expect(detalhesDoItem(`Periodicidade: ${"x".repeat(500)}`).periodicidade).toHaveLength(40);
  });
  it("descrição de 1000 caracteres com muitas linhas mantém opções curtas", () => {
    const desc = Array.from({ length: 150 }, (_, i) => `Tamanhos: a${i}`)
      .join("\n")
      .slice(0, 1000);
    const d = detalhesDoItem(desc);
    expect(d.variacoes.flatMap((g) => g.opcoes).every((o) => o.length <= 30)).toBe(true);
  });
  it("CRLF e caracteres de controle não quebram", () => {
    const d = detalhesDoItem("Tamanhos: P,\u0000M\r\nCores: azul\r\nPeriodicidade: mês");
    expect(d.periodicidade).toBe("mês");
    expect(d.variacoes).toHaveLength(2);
  });
});
