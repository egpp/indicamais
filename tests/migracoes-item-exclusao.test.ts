import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-040 (IM-105, IM-108, IM-102, IM-078, IM-086): conferência estática da migração do modelo do item (sem banco).
 * O comportamento real está em supabase/tests/database/catalogo_item_exclusao.test.sql (pgTAP, roda no CI). Aqui
 * travamos o desenho: lista fechada de funções e privilégios, RLS com política por operação, histórico só de
 * inserção, exclusão lógica que esconde sem reescrever as leituras públicas, e a exclusão que libera a vaga do teto.
 */
const NOME = "20261114100000_catalogo_item_modelo_exclusao.sql";
const sql = readFileSync(join(process.cwd(), "supabase", "migrations", NOME), "utf8").replace(
  /--.*$/gm,
  "",
);

const corpo = (nome: string) =>
  new RegExp(
    `create (?:or replace )?function public\\.${nome}\\([\\s\\S]*?\\bas \\$\\$([\\s\\S]*?)\\$\\$;`,
    "i",
  ).exec(sql)?.[1] ?? "";

describe("D-040 · migração do modelo do item (20261114100000)", () => {
  it("tipo: 'procura' existe, mas fica bloqueado por CHECK próprio até o IM-109; 'produto' segue sendo a oferta", () => {
    expect(sql).toMatch(
      /constraint catalogo_item_tipo check \(tipo in \('produto', 'servico', 'imovel', 'procura'\)\)/,
    );
    expect(sql).toMatch(
      /constraint catalogo_item_procura_indisponivel check \(tipo <> 'procura'\)/,
    );
    expect(sql).not.toMatch(/'oferta'/);
  });

  it("colunas novas e invariantes: excluído nunca está publicado; localização em par; motivo até 500", () => {
    for (const c of ["cidade text", "uf text", "excluido_em timestamptz", "excluido_motivo text"])
      expect(sql).toContain(`add column ${c}`.replace("add column ", ""));
    expect(sql).toMatch(
      /excluido_por uuid references public\.contas_conta \(id\) on delete restrict/,
    );
    expect(sql).toMatch(/check \(excluido_em is null or publicado = false\)/);
    expect(sql).toMatch(/check \(\(cidade is null\) = \(uf is null\)\)/);
    expect(sql).toMatch(/check \(\(excluido_em is null\) = \(excluido_por is null\)\)/);
    expect(sql).toMatch(/char_length\(excluido_motivo\) <= 500/);
  });

  it("nenhuma linha é apagada e nenhuma FK deixa de ser RESTRICT", () => {
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/on delete cascade/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/drop (table|column)/i);
  });

  it("backfill: só preenche o que tem fonte, com gatilhos de usuário desligados e religados na mesma migração", () => {
    const i = sql.indexOf("disable trigger user");
    const u = sql.indexOf("update public.catalogo_item i");
    const f = sql.indexOf("enable trigger user");
    expect(i).toBeGreaterThan(-1);
    expect(u).toBeGreaterThan(i);
    expect(f).toBeGreaterThan(u);
    expect(sql).toMatch(/where i\.id = s\.id and s\.cidade is not null and s\.uf is not null/);
    // A conta não é fonte (não guarda localização).
    expect(sql.slice(u, f)).not.toMatch(/contas_conta/);
  });

  it("histórico catalogo_item_ciclo: RLS forçada, política por operação, só inserção, autor e conta fora do SELECT", () => {
    expect(sql).toMatch(/create table public\.catalogo_item_ciclo/);
    expect(sql).toMatch(/alter table public\.catalogo_item_ciclo enable row level security/);
    expect(sql).toMatch(/alter table public\.catalogo_item_ciclo force row level security/);
    expect(sql).toMatch(/revoke all on public\.catalogo_item_ciclo from anon, authenticated/);
    const pol = [
      ...sql.matchAll(/create policy (\w+) on public\.catalogo_item_ciclo\s+for (\w+)/g),
    ].map((m) => m[2]);
    expect(pol.sort()).toEqual(["delete", "insert", "select", "select", "update"]);
    expect(sql).toMatch(/catalogo_item_ciclo_insert_negado[\s\S]*with check \(false\)/);
    expect(sql).toMatch(
      /before update or delete on public\.catalogo_item_ciclo[\s\S]*administracao_registro_imutavel/,
    );
    const grants = [
      ...sql.matchAll(
        /grant (select|insert|update|delete)[^;]*on public\.catalogo_item_ciclo to ([^;]*);/g,
      ),
    ];
    expect(grants.map((g) => g[1])).toEqual(["select"]);
    expect(grants[0]![0]).not.toMatch(/autor_id|conta_id/);
    expect(grants[0]![2]).toBe("authenticated");
    // Um único evento de exclusão por item.
    expect(sql).toMatch(
      /create unique index catalogo_item_ciclo_uma_exclusao[\s\S]*where acao = 'excluir'/,
    );
    // Sem UPDATE nem DELETE do histórico em lugar nenhum da migração.
    expect(sql).not.toMatch(
      /update public\.catalogo_item_ciclo|delete from public\.catalogo_item_ciclo/,
    );
  });

  it("lista fechada de funções novas: SECURITY DEFINER, search_path vazio, só authenticated, dono checado dentro", () => {
    const DONO = [
      "catalogo_despublicar_item(uuid, text)",
      "catalogo_republicar_item(uuid)",
      "catalogo_excluir_item(uuid, text)",
    ];
    const criadas = [...sql.matchAll(/create function public\.(\w+)\(/g)].map((m) => m[1]).sort();
    expect(criadas).toEqual(
      [
        "catalogo_despublicar_item",
        "catalogo_excluir_item",
        "catalogo_item_versao_item_excluido",
        "catalogo_republicar_item",
      ].sort(),
    );
    for (const assinatura of DONO) {
      expect(sql).toContain(`revoke all on function public.${assinatura} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${assinatura} to authenticated;`);
    }
    // Nenhum EXECUTE para anon, service_role ou public.
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*\b(anon|public|service_role)\b/i);
    expect(sql).toMatch(
      /revoke all on function public\.catalogo_item_versao_item_excluido\(\) from public, anon, authenticated/,
    );
    for (const nome of [
      "catalogo_despublicar_item",
      "catalogo_republicar_item",
      "catalogo_excluir_item",
    ]) {
      const c = corpo(nome);
      const decl = new RegExp(
        `function public\\.${nome}\\([^)]*\\)[\\s\\S]*?language plpgsql security definer set search_path = ''`,
      ).test(sql);
      expect(decl, `${nome} sem security definer + search_path vazio`).toBe(true);
      expect(c, nome).toMatch(/auth\.uid\(\)/);
      expect(c, nome).toMatch(/i\.conta_id = v_uid/); // dono checado DENTRO da função
      expect(c, nome).toMatch(/raise exception 'item não encontrado' using errcode = 'P0002'/);
      expect(c, nome).not.toMatch(/delete from/i);
    }
  });

  it("idempotência e regras de conta: repetir não grava evento; suspensa/encerramento não exclui nem republica", () => {
    expect(corpo("catalogo_excluir_item")).toMatch(
      /if v_item\.excluido_em is not null then\s+return;/,
    );
    expect(corpo("catalogo_despublicar_item")).toMatch(/if not v_item\.publicado then\s+return;/);
    expect(corpo("catalogo_republicar_item")).toMatch(/if v_item\.publicado then\s+return;/);
    expect(corpo("catalogo_excluir_item")).toMatch(/contas_pode_publicar\(v_uid\)/);
    expect(corpo("catalogo_republicar_item")).toMatch(/contas_pode_publicar\(v_uid\)/);
    expect(corpo("catalogo_republicar_item")).toMatch(
      /versao_aprovada_id is null[\s\S]*item sem versão aprovada/,
    );
    expect(corpo("catalogo_excluir_item")).toMatch(
      /publicado = false, excluido_em = now\(\), excluido_por = v_uid/,
    );
  });

  it("excluir esconde SEM reescrever as leituras públicas: nenhuma visão pública nem a busca é recriada", () => {
    for (const v of ["catalogo_item_publico", "loja_item_publico", "perfis_perfil_publico"])
      expect(sql).not.toMatch(new RegExp(`view public\\.${v}\\b`));
    expect(sql).not.toMatch(/function public\.busca_publica/);
    // Leituras do dono e do administrador passam a ignorar o excluído.
    for (const v of [
      "catalogo_meus_itens",
      "administracao_meus_resultados",
      "administracao_fila_pendencias",
    ])
      expect(sql).toMatch(new RegExp(`create or replace view public\\.${v}\\b`));
    expect(sql).toMatch(/catalogo_item_select_proprio[\s\S]*excluido_em is null/);
    expect(sql).toMatch(/catalogo_item_update_proprio[\s\S]*excluido_em is null/);
    expect(sql).toMatch(/function public\.catalogo_eh_dono\([\s\S]*excluido_em is null/);
  });

  it("a exclusão não se desfaz e item excluído não recebe versão nova", () => {
    expect(sql).toMatch(/a exclusão do item não se desfaz/);
    expect(sql).toMatch(
      /create trigger catalogo_item_versao_item_excluido before insert or update on public\.catalogo_item_versao/,
    );
    expect(sql).toMatch(/raise exception 'item excluído' using errcode = 'P0002'/);
  });

  it("criação: localização obrigatória (herda do site no item de perfil) e checada depois do INSERT (perfil alheio segue 23503)", () => {
    const c = corpo("catalogo_criar_item");
    expect(c).toMatch(/informe cidade e UF juntas/);
    expect(c).toMatch(/p\.responsavel_id = v_uid/);
    const ins = c.indexOf("insert into public.catalogo_item (");
    const exige = c.indexOf("cidade e UF do item são obrigatórias");
    expect(ins).toBeGreaterThan(-1);
    expect(exige).toBeGreaterThan(ins);
    // Mesma assinatura (grants preservados) e teto antes de tudo.
    expect(sql).toMatch(
      /p_cidade text default null,\s+p_uf text default null\s+\) returns table \(o_item_id uuid, o_versao_id uuid\)/,
    );
    expect(c.indexOf("contas_exigir_teto_criacao")).toBeLessThan(ins);
  });

  it("teto: a exclusão libera a vaga em todas as contagens de item; despublicar não libera", () => {
    const t = corpo("contas_exigir_teto_criacao");
    expect(t.match(/i\.excluido_em is null/g)?.length).toBe(3);
    expect(t).not.toMatch(/publicado/);
    expect(t).toMatch(/pg_advisory_xact_lock/);
    expect(t).toMatch(/administracao_administrador/);
  });

  it("nada de service_role nem acesso de anon a tabelas novas, e nenhum GRANT de UPDATE/INSERT novo no item", () => {
    expect(sql).not.toMatch(/service_role/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*on public\.catalogo_item\b/i);
    expect(sql).toMatch(
      /grant select \(cidade, uf\) on public\.catalogo_item to anon, authenticated/,
    );
  });
});
