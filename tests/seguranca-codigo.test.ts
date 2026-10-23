import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** IM-086: varredura estática do código de produção em busca de segredos e uso de service_role. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const fontes = arquivos(join(process.cwd(), "src")).map((c) => ({
  c,
  t: readFileSync(c, "utf8"),
}));

describe("código de produção (IM-086)", () => {
  it("não lê variável de service_role em nenhum arquivo", () => {
    const uso = fontes.filter(({ t }) => /process\.env\.[A-Z_]*SERVICE_ROLE/i.test(t));
    expect(uso.map((u) => u.c)).toEqual([]);
  });

  it("nenhuma variável NEXT_PUBLIC_ carrega segredo", () => {
    const nomes = fontes.flatMap(({ t }) =>
      [...t.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0]),
    );
    for (const n of nomes) expect(n).not.toMatch(/SECRET|SERVICE|PASSWORD|PRIVATE/);
  });

  it("não há chaves ou strings de conexão embutidas", () => {
    const achados = fontes.filter(({ t }) =>
      /sb_secret_|eyJ[A-Za-z0-9_-]{20,}|postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/.test(t),
    );
    expect(achados.map((a) => a.c)).toEqual([]);
  });

  it("nenhum log registra senha, token ou código", () => {
    const logs = fontes.filter(({ t }) =>
      /console\.\w+\([^)]*(senha|password|token|code)\b/i.test(t),
    );
    expect(logs.map((a) => a.c)).toEqual([]);
  });
});
