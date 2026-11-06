import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CAMINHOS_PRIVADOS } from "../src/app/_lib/caminhos-privados";
import { CSP_COMPLETA, cabecalhosDeSeguranca } from "../src/shared/seguranca/cabecalhos";

vi.mock("@/shared/supabase/sessao", () => ({ renovarSessao: vi.fn() }));

const raiz = process.cwd();

/** Rotas de primeiro nível em src/app que são públicas por decisão (conteúdo para visitantes). */
const PUBLICAS = new Set([
  "ajuda",
  "beneficios",
  "categorias",
  "como-funciona",
  "fonts", // só arquivos de fonte locais, sem página
  "indique-e-ganhe",
  "item",
  "og",
  "perfil",
  "politica-de-privacidade",
]);

describe("RSA-12: lista de caminhos privados contra as rotas reais", () => {
  it("toda rota de primeiro nível de src/app é pública declarada ou está em CAMINHOS_PRIVADOS", () => {
    const base = join(raiz, "src/app");
    const topo = readdirSync(base).filter(
      (n) => statSync(join(base, n)).isDirectory() && !n.startsWith("_") && !n.startsWith("("),
    );
    const privados = new Set(CAMINHOS_PRIVADOS.map((c) => c.slice(1)));
    const faltando = topo.filter((n) => !PUBLICAS.has(n) && !privados.has(n));
    expect(faltando).toEqual([]);
  });

  it("nenhum caminho privado é também público declarado", () => {
    for (const c of CAMINHOS_PRIVADOS) expect(PUBLICAS.has(c.slice(1)), c).toBe(false);
  });
});

describe("RSA-11: matcher não abre áreas privadas por sufixo", () => {
  it("casa com áreas privadas e com ?query; extensões em maiúsculas não são excluídas", async () => {
    const { config } = await import("../src/proxy");
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of [
      "/administracao",
      "/minha-conta",
      "/meus-perfis/1",
      "/pontos",
      "/x.PNG",
      "/x.svgz",
    ]) {
      expect(re.test(p), p).toBe(true);
    }
    // /_next/staticfoo e /ogx não são o diretório excluído: continuam passando pelo proxy.
    expect(re.test("/ogx")).toBe(true);
  });
});

describe("RSA-01: CSP completa e cabeçalhos", () => {
  it("cada diretiva da CSP completa aparece uma vez e frame-ancestors/base-uri/object-src estão nas duas CSPs", () => {
    const nomes = CSP_COMPLETA.split("; ").map((d) => d.split(" ")[0]);
    expect(new Set(nomes).size).toBe(nomes.length);
    const h = cabecalhosDeSeguranca(true);
    const enforced = h.find((c) => c.key === "Content-Security-Policy")!.value;
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"]) {
      expect(enforced).toContain(d);
      expect(CSP_COMPLETA).toContain(d);
    }
    // A política aplicada de verdade não pode ter diretivas de carregamento (não quebra páginas).
    expect(enforced).not.toMatch(/default-src|script-src|img-src|connect-src|frame-src/);
  });

  it("o app não referencia domínios externos fora da CSP completa (src/app, src/shared, src/modules)", () => {
    const hosts = new Set<string>();
    const varrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.(tsx?|css)$/.test(n) && !/\.test\./.test(n)) {
          for (const m of readFileSync(p, "utf8").matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
            hosts.add(m[1]!.toLowerCase());
          }
        }
      }
    };
    for (const d of ["src/app", "src/shared", "src/modules"]) varrer(join(raiz, d));
    // Fora da CSP por não serem carregados pelo navegador: links (wa.me, google.com/maps) e chamadas só do
    // servidor (api.resend.com, nominatim). Se algum passar a ser carregado no cliente, entra na CSP.
    const ignorar =
      /^(localhost|example\.|exemplo\.|meusite\.|www\.w3\.org|schema\.org|nextjs\.org|.*\.example|wa\.me|www\.google\.com|api\.resend\.com|nominatim\.openstreetmap\.org)/;
    const naoCobertos = [...hosts].filter(
      (h) =>
        !ignorar.test(h) &&
        !CSP_COMPLETA.includes(h.replace(/^[^.]+\./, "*.")) &&
        !CSP_COMPLETA.includes(h),
    );
    // Lista os domínios encontrados fora da CSP para revisão manual antes de promover.
    expect(naoCobertos).toEqual([]);
  });
});
