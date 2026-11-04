import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da migração de liberação inicial dos estilos 6 a 21 (IM-091, IM-100, IM-086, D-016, D-021).
 * Só confere o TEXTO da migração; o efeito no banco é coberto por supabase/tests/database/perfis_estilo_pagina.test.sql.
 */
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261104130000_perfis_estilos_liberacao_inicial.sql",
  ),
  "utf8",
).replace(/--.*$/gm, "");

const JA_LIGADOS = [
  "minimalista",
  "saude_bem_estar",
  "beleza_estetica",
  "gastronomia",
  "construcao_reformas",
];

describe("liberação inicial dos estilos 6 a 21", () => {
  const lista = sql.match(/e\.id in \(([\s\S]*?)\)\s*returning/i)![1]!;
  const ids = [...lista.matchAll(/'(\w+)'/g)].map((m) => m[1]!);

  it("libera exatamente os 16 estilos desabilitados, incluindo moto_bike, sem tocar nos 5 já ligados", () => {
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
    expect(ids).toContain("moto_bike");
    for (const id of JA_LIGADOS) expect(ids).not.toContain(id);
  });

  it("é idempotente: update restrito a ids listados e a habilitado = false", () => {
    expect(sql).toMatch(/set habilitado = true/i);
    expect(sql).toMatch(/where e\.habilitado = false/i);
  });

  it("só muda dados: sem DDL, política, função ou privilégio", () => {
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+(table|policy|function|trigger|view)\b/i);
    expect(sql).not.toMatch(/\b(grant|revoke|delete)\b/i);
  });

  it("grava auditoria com motivo, valor anterior e valor novo, só das linhas alteradas", () => {
    expect(sql).toMatch(/insert into public\.administracao_auditoria/i);
    expect(sql).toMatch(
      /liberação inicial dos estilos 6 a 21, aprovada por Emerson em 04\/11\/2026/,
    );
    expect(sql).toMatch(/jsonb_build_object\('habilitado', false\)/);
    expect(sql).toMatch(/jsonb_build_object\('habilitado', true\)/);
    expect(sql).toMatch(/from alvo/i);
  });
});
