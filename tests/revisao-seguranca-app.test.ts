import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Revisão de segurança da aplicação (docs/revisao-seguranca-app.md). `it.fails` documenta achados ABERTOS: o teste
 * passa enquanto o defeito existir e quebra quando for corrigido (aí troque por `it` normal).
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

// Achados abertos: nenhum. RSA-01, RSA-03, RSA-08, RSA-11 e RSA-12 têm teste em tests/hardening-config.test.ts.

describe("revisão de segurança do app: achados corrigidos (D-033)", () => {
  const migracao = () =>
    readdirSync(join(raiz, "supabase/migrations"))
      .filter((f) => f.endsWith("_indicacoes_contato_limites_destino_origem.sql"))
      .map((f) => ler(`supabase/migrations/${f}`))
      .join("\n");

  it("RSA-05: o limite por origem (hash) recusa; o por destino é só alarme, com parâmetros do S-03 (uma casa só)", () => {
    const sql = migracao();
    const semComentarios = sql.replace(/--.*$/gm, "");
    expect(semComentarios).toMatch(/contato_limite_por_origem/);
    expect(semComentarios).toMatch(/p_origem_hash/);
    expect(semComentarios).toMatch(/errcode = 'P0429'/);
    // Sem parâmetro próprio de destino (o do S-03 é contato_limite_por_destino_hora) e sem recusa por destino na RPC.
    expect(semComentarios).not.toMatch(/contato_limite_por_destino(?!_hora)/);
    expect(semComentarios).not.toMatch(/indicacoes_contato_destino/);
  });

  it("RSA-05: a migração vem DEPOIS do S-03 (db push aceita a ordem) e não isenta service_role na RPC", () => {
    const nomes = readdirSync(join(raiz, "supabase/migrations")).sort();
    const minha = nomes.find((f) => f.endsWith("_indicacoes_contato_limites_destino_origem.sql"))!;
    const s03 = nomes.find((f) => f.endsWith("_seguranca_indicacoes_limites_contato.sql"))!;
    expect(minha > s03).toBe(true);
    const sql = ler(`supabase/migrations/${minha}`).replace(/--.*$/gm, "");
    const rpc = sql.slice(
      sql.indexOf("create function public.indicacoes_enviar_contato("),
      sql.indexOf("revoke all on function public.indicacoes_enviar_contato("),
    );
    expect(rpc).not.toMatch(/service_role/);
    // Ordem das travas: WhatsApp, origem (RPC) e depois link e destino (gatilho do S-03).
    expect(rpc.indexOf("'indicacoes_contato:'")).toBeLessThan(
      rpc.indexOf("'indicacoes_contato_origem:'"),
    );
    const gatilho = sql.slice(
      sql.indexOf("create or replace function public.indicacoes_pedido_limitar"),
    );
    expect(gatilho.indexOf("indicacoes_link:")).toBeLessThan(
      gatilho.indexOf("indicacoes_destino:"),
    );
    // O limite por link também conta a origem, sem recusar (só tira a atribuição).
    expect(gatilho).toMatch(/p\.origem_hash = new\.origem_hash/);
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
