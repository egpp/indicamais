import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CSP_BASICA,
  CSP_COMPLETA,
  cabecalhosDeSeguranca,
} from "../src/shared/seguranca/cabecalhos";

vi.mock("@/shared/supabase/sessao", () => ({ renovarSessao: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: () => {} }));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
const valor = (lista: { key: string; value: string }[], k: string) =>
  lista.find((c) => c.key.toLowerCase() === k.toLowerCase())?.value;

describe("RSA-01: cabeçalhos de segurança", () => {
  it("define os cabeçalhos essenciais", () => {
    const h = cabecalhosDeSeguranca(false);
    expect(valor(h, "X-Content-Type-Options")).toBe("nosniff");
    expect(valor(h, "X-Frame-Options")).toBe("DENY");
    expect(valor(h, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valor(h, "Permissions-Policy")).toMatch(/camera=\(\)/);
    expect(valor(h, "Content-Security-Policy")).toBe(CSP_BASICA);
    expect(CSP_BASICA).toContain("frame-ancestors 'none'");
    expect(valor(h, "Content-Security-Policy-Report-Only")).toBe(CSP_COMPLETA);
  });

  it("CSP completa cobre Supabase, mapa do OpenStreetMap e proíbe origens não previstas", () => {
    expect(CSP_COMPLETA).toContain("default-src 'self'");
    expect(CSP_COMPLETA).toMatch(/img-src[^;]*https:\/\/\*\.supabase\.co/);
    expect(CSP_COMPLETA).toMatch(/connect-src[^;]*https:\/\/\*\.supabase\.co/);
    expect(CSP_COMPLETA).toContain("frame-src https://www.openstreetmap.org");
    expect(CSP_COMPLETA).toContain("object-src 'none'");
    expect(CSP_COMPLETA).not.toMatch(/\*(;|$)|https:(;|\s|$)/);
  });

  it("HSTS só em produção", () => {
    expect(valor(cabecalhosDeSeguranca(false), "Strict-Transport-Security")).toBeUndefined();
    expect(valor(cabecalhosDeSeguranca(true), "Strict-Transport-Security")).toMatch(/max-age=/);
  });

  it("não sobrescreve Cache-Control", () => {
    expect(valor(cabecalhosDeSeguranca(true), "Cache-Control")).toBeUndefined();
    expect(ler("public/_headers")).toMatch(
      /\/_next\/static\/\*\s+Cache-Control: public,max-age=31536000,immutable/,
    );
  });

  it("next.config.ts publica os cabeçalhos em todas as rotas", async () => {
    const { default: cfg } = await import("../next.config");
    const regras = await cfg.headers!();
    expect(regras[0]!.source).toBe("/:path*");
    expect(valor(regras[0]!.headers, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("public/_headers espelha os cabeçalhos base para arquivos estáticos", () => {
    const h = ler("public/_headers");
    expect(h).toMatch(/X-Content-Type-Options: nosniff/);
    expect(h).toMatch(/X-Frame-Options: DENY/);
    expect(h).toMatch(/Referrer-Policy: strict-origin-when-cross-origin/);
    const base = cabecalhosDeSeguranca(false);
    expect(h).toContain(`Permissions-Policy: ${valor(base, "Permissions-Policy")}`);
  });
});

describe("RSA-11: matcher do proxy", () => {
  it("o matcher exclui estáticos de verdade, mas não caminhos que só terminam em letras iguais", async () => {
    const { config } = await import("../src/proxy");
    const re = new RegExp(`^${config.matcher[0]}$`);
    // Passam pelo proxy (casam):
    for (const p of ["/", "/perfil/xpng", "/perfil/foto-svg", "/entrar", "/minha-conta"]) {
      expect(re.test(p), p).toBe(true);
    }
    // Estáticos ficam de fora:
    for (const p of [
      "/logo.svg",
      "/marca/a.png",
      "/x.jpg",
      "/x.jpeg",
      "/x.gif",
      "/x.webp",
      "/x.ico",
      "/favicon.ico",
      "/_next/static/chunks/a.js",
      "/_next/image",
      "/og/perfil",
    ]) {
      expect(re.test(p), p).toBe(false);
    }
  });
});

describe("RSA-03: actions fixadas por SHA", () => {
  it("todo `uses:` tem SHA de 40 caracteres e a tag em comentário", () => {
    const dir = join(raiz, ".github/workflows");
    const usos = readdirSync(dir)
      .flatMap((f) => ler(`.github/workflows/${f}`).split("\n"))
      .filter((l) => /^\s*-?\s*uses:/.test(l));
    expect(usos.length).toBeGreaterThan(0);
    for (const l of usos) expect(l).toMatch(/@[0-9a-f]{40} # v\d/);
  });
});

describe("RSA-12: robots e noindex", () => {
  it("robots bloqueia tudo com indexação desligada e só as áreas privadas quando ligada", async () => {
    const { default: robots } = await import("../src/app/robots");
    vi.stubEnv("PUBLICO_INDEXAVEL", "");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
    vi.stubEnv("PUBLICO_INDEXAVEL", "sim");
    const regra = robots().rules as { disallow: string[] };
    for (const c of ["/administracao", "/painel", "/minha-conta", "/entrar", "/auth"]) {
      expect(regra.disallow).toContain(c);
    }
    vi.unstubAllEnvs();
  });

  it("páginas de autenticação declaram noindex", () => {
    for (const d of [
      "entrar",
      "cadastro",
      "recuperar-senha",
      "redefinir-senha",
      "reenviar-confirmacao",
    ]) {
      expect(ler(`src/app/${d}/page.tsx`), d).toMatch(/\.\.\.SEM_INDEXACAO/);
    }
  });
});
