import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Revisão de segurança da aplicação (docs/revisao-seguranca-app.md). `it.fails` documenta achados ABERTOS: o teste
 * passa enquanto o defeito existir e quebra quando for corrigido (aí troque por `it` normal).
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

describe("revisão de segurança do app: achados abertos", () => {
  // RSA-01, RSA-03, RSA-08, RSA-11 e RSA-12 foram corrigidos: testes em tests/hardening-config.test.ts.

  it.fails(
    "RSA-05: o limite de pedidos de contato não depende só do WhatsApp informado pelo visitante",
    () => {
      const sql = readdirSync(join(raiz, "supabase/migrations"))
        .filter((f) => f.endsWith("_indicacoes_rpcs_link_contato.sql"))
        .map((f) => ler(`supabase/migrations/${f}`))
        .join("\n");
      // Esperado após a correção: limite também por destino (perfil/item) ou por origem (hash de IP).
      expect(sql).toMatch(/limite[^\n]*(destino|origem)|origem_hash/i);
    },
  );

  it.fails(
    "RSA-07: a origem da denúncia usa hash com segredo (HMAC/sal), não SHA-256 puro de IP+UA",
    () => {
      expect(ler("src/app/_lib/origem-denuncia.ts")).toMatch(
        /HMAC|importKey|\bsal\b|\bsalt\b|pepper/i,
      );
    },
  );
});

describe("revisão de segurança do app: verificações que passam", () => {
  it(".gitignore bloqueia .env* e .dev.vars* (exceto os exemplos)", () => {
    const g = ler(".gitignore");
    expect(g).toMatch(/^\.env\*$/m);
    expect(g).toMatch(/^!\.env\.example$/m);
    expect(g).toMatch(/^\.dev\.vars\*$/m);
    expect(g).toMatch(/^!\.dev\.vars\.example$/m);
  });

  it("caminho de retorno só aceita caminho interno (open redirect)", async () => {
    const { caminhoSeguro } = await import("../src/app/_lib/destino");
    for (const ruim of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "/a\nb",
    ]) {
      expect(caminhoSeguro(ruim)).toBe("/minha-conta");
    }
    expect(caminhoSeguro("/meus-perfis")).toBe("/meus-perfis");
  });
});
