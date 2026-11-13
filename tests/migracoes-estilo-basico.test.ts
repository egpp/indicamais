import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Verificação estática da migração do 22º estilo "basico" e do novo default (IM-110, D-040). Nada é aplicado ao banco. */
const DIR = join(process.cwd(), "supabase", "migrations");
const ler = (n: string) =>
  readFileSync(join(DIR, n), "utf8").replace(/--.*$/gm, "").replace(/\r\n/g, "\n");
const sql = ler("20261113100000_perfis_estilo_basico.sql");

describe("migração perfis_estilo_basico", () => {
  it("o check de ids é o do moto_bike mais 'basico' (22 ids, nenhum removido)", () => {
    const pegar = (s: string) =>
      [
        .../add constraint perfis_estilo_pagina_id check \(id in \(([\s\S]*?)\)\);/
          .exec(s)![1]!
          .matchAll(/'([a-z_]+)'/g),
      ].map((m) => m[1]!);
    const antes = pegar(ler("20261104120000_perfis_estilo_moto_bike.sql"));
    const depois = pegar(sql);
    expect(antes).toHaveLength(21);
    expect(depois).toHaveLength(22);
    expect(depois).toEqual([...antes, "basico"]);
  });

  it("insere basico habilitado na ordem 22, sem colidir com as ordens anteriores", () => {
    expect(sql).toMatch(/\('basico', 'Básico', 22, true\)/);
  });

  it("troca só o default da coluna, sem reescrever linhas existentes", () => {
    expect(sql).toMatch(
      /alter table public\.perfis_perfil alter column estilo_pagina set default 'basico'/,
    );
    expect(sql).not.toMatch(/\b(update|delete)\b\s+(from\s+)?public\./i);
  });

  it("insere o estilo antes de usá-lo como default (FK para o catálogo)", () => {
    expect(sql.indexOf("insert into public.perfis_estilo_pagina")).toBeLessThan(
      sql.indexOf("set default 'basico'"),
    );
  });

  it("não mexe em políticas, RLS, gatilho, grants nem cria função", () => {
    expect(sql).not.toMatch(
      /create policy|drop policy|disable row level security|disable trigger|grant|service_role|create (or replace )?function/i,
    );
  });
});
