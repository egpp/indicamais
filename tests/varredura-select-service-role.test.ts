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

  it("nenhum uso de service_role no app", () => {
    const achados = fontes.filter(({ t }) => /service[_-]?role/i.test(t));
    expect(achados.map((a) => a.c)).toEqual([]);
  });

  it("nenhuma consulta nomeia colunas que ninguém lê", () => {
    const proibidas = /select\([^)]*\b(responsavel_id|conta_id|autor_id|decidida_por)\b/;
    const achados = fontes.filter(({ t }) => proibidas.test(t));
    expect(achados.map((a) => a.c)).toEqual([]);
  });
});
