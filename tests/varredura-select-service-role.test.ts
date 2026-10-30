import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura do código de produção (IM-029, IM-086): nenhuma consulta com select("*") ou select() sem
 * colunas (falha por privilégio de coluna e poderia expor responsavel_id/conta_id/autor_id) e nenhum uso de
 * service_role no app. Comentários são ignorados; strings e código, não.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx|mjs|js)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

function semComentarios(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const fontes = arquivos(join(process.cwd(), "src")).map((c) => ({
  c,
  t: semComentarios(readFileSync(c, "utf8")),
}));

/** Único arquivo que pode ler a chave de serviço (notificações do servidor, IM-027/IM-050). */
const ARQUIVO_SERVICO = join("src", "shared", "supabase", "servico.ts");
const eServico = (c: string) => c.endsWith(ARQUIVO_SERVICO);

describe("varredura do app", () => {
  it("encontra arquivos para varrer", () => {
    expect(fontes.length).toBeGreaterThan(20);
  });

  it("nenhum select('*') nem select() sem colunas", () => {
    const achados = fontes.filter(({ t }) =>
      /\.select\(\s*(\)|["'`]\s*\*\s*["'`]|["'`]\s*["'`]\s*\))/.test(t),
    );
    expect(achados.map((a) => a.c)).toEqual([]);
  });

  it("nenhum uso de service_role no app, exceto o cliente de serviço do servidor", () => {
    const achados = fontes.filter(({ c, t }) => !eServico(c) && /service[_-]?role/i.test(t));
    expect(achados.map((a) => a.c)).toEqual([]);
    expect(fontes.some(({ c }) => eServico(c))).toBe(true);
  });

  it("o cliente de serviço só é importado por arquivos de servidor aprovados e nunca por código de cliente", () => {
    const importadores = fontes.filter(
      ({ c, t }) => !eServico(c) && /supabase\/servico["']/.test(t),
    );
    expect(importadores.map((i) => i.c.split(/[\\/]/).pop()).sort()).toEqual([
      "notificacoes-contato.ts",
      "rotinas.ts",
    ]);
    const clientes = fontes.filter(({ t }) => /^\s*["']use client["']/.test(t));
    expect(clientes.length).toBeGreaterThan(5);
    for (const { t } of clientes) {
      expect(t).not.toMatch(
        /notificacoes-contato|supabase\/servico|supabase\/acesso-conta|agendador|banco-indicacoes/,
      );
    }
  });

  it("o cliente de serviço recusa o navegador e não lê chave em NEXT_PUBLIC_", () => {
    const f = fontes.find(({ c }) => eServico(c))!;
    expect(f.t).toMatch(/typeof window !== "undefined"/);
    expect(f.t).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/);
  });

  it("nenhuma consulta nomeia colunas que ninguém lê", () => {
    const proibidas = /select\([^)]*\b(responsavel_id|conta_id|autor_id|decidida_por)\b/;
    const achados = fontes.filter(({ t }) => proibidas.test(t));
    expect(achados.map((a) => a.c)).toEqual([]);
  });
});
