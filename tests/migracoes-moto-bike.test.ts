import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDS_ESTILOS } from "../src/app/_componentes/site/estilos";

/** Verificação estática da migração do 21º estilo (IM-100, IM-091, D-021). Nada é aplicado ao banco. */
const DIR = join(process.cwd(), "supabase", "migrations");
const ler = (n: string) =>
  readFileSync(join(DIR, n), "utf8").replace(/--.*$/gm, "").replace(/\r\n/g, "\n");
const sql = ler("20261104120000_perfis_estilo_moto_bike.sql");

describe("migração perfis_estilo_moto_bike", () => {
  it("o check de ids lista exatamente os ids do código (21)", () => {
    const bloco = /add constraint perfis_estilo_pagina_id check \(id in \(([\s\S]*?)\)\);/.exec(
      sql,
    )![1];
    const ids = [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(ids).toHaveLength(21);
    expect([...ids].sort()).toEqual([...IDS_ESTILOS].sort());
  });

  it("insere moto_bike desabilitado, na ordem 21, sem tocar em políticas, RLS ou gatilho", () => {
    expect(sql).toMatch(/\('moto_bike', 'Moto e Bike', 21, false\)/);
    expect(sql).not.toMatch(
      /create policy|drop policy|disable row level security|disable trigger/i,
    );
    expect(sql).not.toMatch(/\b(update|delete)\b\s+(from\s+)?public\./i);
    expect(sql).not.toMatch(/grant|service_role/i);
  });

  it("ordem 21 não colide com a migração original", () => {
    const orig = ler("20261102160000_perfis_estilo_pagina.sql");
    const ordens = [...orig.matchAll(/'\w+', '[^']+', (\d+), (?:true|false)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...ordens)).toBe(20);
  });
});
