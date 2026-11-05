import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da migração que recoloca falhas de notificação de contato na fila (IM-027, IM-028, IM-080,
 * IM-086). Complementa o pgTAP (supabase/tests/database/indicacoes.test.sql), que roda no CI com banco real.
 */
const ARQ = "supabase/migrations/20261105160000_indicacoes_notificacao_recolocar_falhas.sql";
const sql = readFileSync(join(process.cwd(), ARQ), "utf8").replace(/--.*$/gm, "");
const ASSINATURA = "public.indicacoes_notificacoes_recolocar_falhas(integer, integer, integer)";

describe("migração indicacoes_notificacoes_recolocar_falhas", () => {
  it("só service_role executa; public, anon e authenticated sem acesso", () => {
    expect(sql).toMatch(
      new RegExp(
        `revoke all on function ${ASSINATURA.replace(/[().]/g, "\\$&")} from public, anon, authenticated;`,
        "i",
      ),
    );
    const grants = [...sql.matchAll(/grant execute on function[^;]+;/gi)].map((m) => m[0]);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatch(/to service_role;$/i);
    expect(grants[0]).not.toMatch(/\b(anon|authenticated)\b|to\s+public\b/i);
  });

  it("security definer com search_path vazio", () => {
    expect(sql).toMatch(/security definer set search_path = ''/i);
  });

  it("parâmetros hostis são limitados (limite 1..100, tentativas >= 1, espera >= 0, nulos com padrão)", () => {
    expect(sql).toMatch(/limit least\(greatest\(coalesce\(p_limite, 10\), 1\), 100\)/i);
    expect(sql).toMatch(/greatest\(coalesce\(p_tentativas_max, 3\), 1\)/i);
    expect(sql).toMatch(/greatest\(coalesce\(p_espera_minutos, 60\), 0\)/i);
  });

  it("só recoloca falha com tentativa sobrando, espera cumprida e nunca 'responsável sem e-mail'", () => {
    expect(sql).toMatch(/n\.estado = 'falhou'/);
    expect(sql).toMatch(/n\.tentativas < greatest/);
    expect(sql).toMatch(/<> 'responsável sem e-mail'/);
    expect(sql).toMatch(/n\.ultima_tentativa_em <= now\(\)/);
    expect(sql).toMatch(/for update skip locked/i);
  });

  it("só muda o estado: não toca em tentativas, erro, alerta, nem em outras tabelas", () => {
    const update = sql.match(
      /update public\.indicacoes_notificacao n\s+set([\s\S]*?)from escolhidas/i,
    )!;
    expect(update[1]!.trim()).toBe("estado = 'pendente'");
    expect(sql).not.toMatch(/\b(delete|insert|truncate|drop)\b/i);
    expect(sql).not.toMatch(/pontos_|relacionamento_|comissoes_|auth\./i);
    expect(sql).not.toMatch(/alter table|disable row level security|create policy/i);
  });
});
