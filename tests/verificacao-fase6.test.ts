import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Verificação independente da Fase 6 (IM-077, IM-080, IM-081, IM-042): nenhuma função de invalidar, suspender, reativar,
 * anonimizar ou reverter pontos escreve na base de relacionamento nem altera pedidos de contato.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const ler = (n: RegExp) =>
  readdirSync(DIR)
    .filter((f) => n.test(f))
    .map((f) => readFileSync(join(DIR, f), "utf8").replace(/--.*$/gm, ""))
    .join("\n");

const ESCRITA =
  /(insert\s+into|update|delete\s+from)\s+public\.(relacionamento_\w+|indicacoes_pedido_contato)\b/i;

describe("Fase 6: relacionamento e pedidos intactos (IM-042)", () => {
  it.each([
    ["invalidar indicação", /administracao_invalidar_indicacao/],
    ["suspender e reativar", /administracao_suspensao_reativacao/],
    ["encerramento e anonimização", /contas_encerramento/],
    ["reversão de pontos", /pontos_reversao_leitura|pontos_modelo/],
  ])("%s não escreve em relacionamento_* nem em pedidos", (_n, arq) => {
    expect(ler(arq)).not.toMatch(ESCRITA);
  });
});
