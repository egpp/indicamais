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
  it.fails(
    "RSA-01: respostas HTTP definem cabeçalhos de segurança (CSP, nosniff, frame-ancestors, Referrer-Policy)",
    () => {
      const fontes = ler("next.config.ts") + ler("public/_headers") + ler("src/proxy.ts");
      expect(fontes).toMatch(/Content-Security-Policy/i);
      expect(fontes).toMatch(/X-Content-Type-Options/i);
      expect(fontes).toMatch(/frame-ancestors|X-Frame-Options/i);
      expect(fontes).toMatch(/Referrer-Policy/i);
    },
  );

  it.fails("RSA-03: actions dos workflows fixadas por SHA de commit", () => {
    const dir = join(raiz, ".github/workflows");
    const usos = readdirSync(dir)
      .flatMap((f) => ler(`.github/workflows/${f}`).split("\n"))
      .filter((l) => /^\s*-?\s*uses:/.test(l));
    expect(usos.length).toBeGreaterThan(0);
    for (const l of usos) expect(l).toMatch(/@[0-9a-f]{40}\b/);
  });
});

describe("revisão de segurança do app: achados corrigidos (D-033)", () => {
  const migracao = () =>
    readdirSync(join(raiz, "supabase/migrations"))
      .filter((f) => f.endsWith("_indicacoes_contato_limites_destino_origem.sql"))
      .map((f) => ler(`supabase/migrations/${f}`))
      .join("\n");

  it("RSA-05: o limite de pedidos de contato também é por destino e por origem (hash), não só por WhatsApp", () => {
    const sql = migracao();
    expect(sql).toMatch(/contato_limite_por_destino/);
    expect(sql).toMatch(/contato_limite_por_origem/);
    expect(sql).toMatch(/p_origem_hash/);
  });

  it("RSA-05: contato e denúncia passam pelo Turnstile no servidor", () => {
    expect(ler("src/app/_lib/protecao-publica.ts")).toMatch(/verificarTurnstile/);
    expect(ler("src/app/acoes-indicacoes.ts")).toMatch(/protegerFormularioPublico/);
    expect(ler("src/app/acoes-ciclo-vida.ts")).toMatch(/protegerFormularioPublico/);
  });

  it("RSA-07: a origem da denúncia usa HMAC com segredo do servidor, não SHA-256 puro de IP+UA", () => {
    const fonte = ler("src/app/_lib/origem-denuncia.ts");
    expect(fonte).toMatch(/HMAC/);
    expect(fonte).toMatch(/DENUNCIA_HASH_SEGREDO/);
    expect(fonte).not.toMatch(/subtle\.digest/);
  });

  it("RSA-05 e RSA-07: os exemplos de ambiente listam os nomes novos, sem valores", () => {
    for (const arq of [".env.example", ".dev.vars.example"]) {
      const e = ler(arq);
      for (const nome of [
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY",
        "DENUNCIA_HASH_SEGREDO",
      ]) {
        expect(e, `${arq} sem ${nome}`).toMatch(new RegExp(`^${nome}=$`, "m"));
      }
    }
  });

  it("os limites padrão de LIMITES.contato espelham os parâmetros da migração", async () => {
    const { LIMITES } = await import("../src/shared/config/limites");
    const sql = migracao();
    expect(sql).toContain(
      `('contato_limite_por_destino', ${LIMITES.contato.limitePorDestinoPadrao},`,
    );
    expect(sql).toContain(
      `('contato_limite_por_origem', ${LIMITES.contato.limitePorOrigemPadrao},`,
    );
  });
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
