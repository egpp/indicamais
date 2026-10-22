import { describe, expect, it } from "vitest";
import { ESLint, type Linter } from "eslint";
import path from "node:path";
import boundaries from "../eslint.boundaries.mjs";

// IM-001 / IM-002: prova que a regra de lint impede importar o interior de outro modulo.
const raiz = path.resolve(__dirname, "..");
const eslint = new ESLint({
  cwd: raiz,
  overrideConfigFile: true,
  overrideConfig: boundaries as unknown as Linter.Config[],
});

async function lint(arquivo: string) {
  const [r] = await eslint.lintFiles([arquivo]);
  return r.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("fronteiras entre modulos", () => {
  const permitidos = [
    "tests/fixtures/app/ok-usa-index.ts",
    "tests/fixtures/modules/perfis/ok-usa-index-de-outro.ts",
    "tests/fixtures/modules/contas/ok-relativo-interno.ts",
    "tests/fixtures/modules/perfis/sub/ok-relativo-na-pasta.ts",
  ];
  const proibidos = [
    "tests/fixtures/app/viola-alias-interno.ts",
    "tests/fixtures/modules/perfis/viola-alias-interno-de-outro.ts",
    "tests/fixtures/modules/perfis/viola-relativo-de-outro.ts",
    "tests/fixtures/modules/perfis/sub/viola-relativo-profundo.ts",
  ];

  it.each(permitidos)("passa no lint: %s", async (arquivo) => {
    expect(await lint(arquivo)).toEqual([]);
  });

  it.each(proibidos)("falha no lint: %s", async (arquivo) => {
    expect((await lint(arquivo)).length).toBeGreaterThan(0);
  });

  it("shared nao pode importar modulos", async () => {
    const [r] = await eslint.lintText(
      'import { a } from "@/modules/contas";\nexport const b = a;\n',
      {
        filePath: path.join(raiz, "src/shared/exemplo.ts"),
      },
    );
    expect(r.messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("modulo ativo real nao importa internos de outro (simulado em src/modules)", async () => {
    const [r] = await eslint.lintText(
      'import { a } from "@/modules/pontos/interno";\nexport const b = a;\n',
      {
        filePath: path.join(raiz, "src/modules/indicacoes/servico.ts"),
      },
    );
    expect(r.messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });
});
