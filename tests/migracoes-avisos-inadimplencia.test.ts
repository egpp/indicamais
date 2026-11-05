import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática dos avisos de inadimplência (IM-072, IM-050, IM-053, IM-065, IM-086, D-029). Complementa o pgTAP
 * (banco real, no CI): aqui só se confere o TEXTO da migração.
 */
const NOME = "20261105150000_notificacoes_aviso_inadimplencia.sql";
const bruto = readFileSync(join(process.cwd(), "supabase", "migrations", NOME), "utf8");
const sql = bruto.replace(/--.*$/gm, "");
const visao =
  /create or replace view public\.notificacoes_meus_avisos as([\s\S]*?)\n\) x\n/i.exec(sql)?.[1] ??
  "";
const ramoInadimplencia = visao.slice(visao.indexOf("'inadimplencia'::text"));

describe("avisos de inadimplência: migração (IM-072)", () => {
  it("fica depois das migrações de comissões e não cria tabela nova de aviso (IM-053)", () => {
    expect(NOME > "20261105140000").toBe(true);
    expect(sql).not.toMatch(/create table/i);
  });

  it("deriva dos avisos das visões de leitura do módulo comissoes, sem copiar", () => {
    expect(ramoInadimplencia).toMatch(/from public\.comissoes_minha_situacao/);
    expect(ramoInadimplencia).toMatch(/from public\.comissoes_negocio_vinculos/);
  });

  it("origem nova aceita no estado de leitura e em marcar_lida", () => {
    expect(sql).toMatch(/check \(origem in \([^)]*'inadimplencia'\)\)/);
    expect(sql).toMatch(/p_origem not in \([^)]*'inadimplencia'\)/);
    expect(sql).toMatch(/security definer set search_path = ''/);
  });

  it("os quatro tipos existem", () => {
    expect(ramoInadimplencia).toMatch(/'inadimplencia_' \|\| t\.suf \|\| '_indicador'/);
    expect(ramoInadimplencia).toMatch(/'inadimplencia_' \|\| t\.suf \|\| '_negocio'/);
    expect(ramoInadimplencia).toMatch(/'atraso'::text as suf/);
    expect(ramoInadimplencia).toMatch(/'prazo'::text/);
  });

  it("id determinístico por papel + tipo + referência + competência (sem aviso duplicado)", () => {
    expect(ramoInadimplencia).toMatch(
      /md5\('inadimplencia:indicador:' \|\| t\.suf \|\| ':' \|\| s\.negocio_id::text \|\| ':' \|\| s\.inadimplente_desde::text\)::uuid/,
    );
    expect(ramoInadimplencia).toMatch(
      /md5\('inadimplencia:negocio:' \|\| t\.suf \|\| ':' \|\| v\.id::text \|\| ':' \|\| v\.inadimplente_desde::text\)::uuid/,
    );
  });

  it("só avisa vínculos ativos, não em dia, com mês encerrado (mês corrente não conta)", () => {
    expect(ramoInadimplencia).toMatch(/s\.clientes_ativos > 0 and not s\.em_dia/);
    expect(ramoInadimplencia).toMatch(/v\.situacao = 'ativo' and not v\.indicador_em_dia/);
    const meses = ramoInadimplencia.match(/inadimplente_desde < date_trunc\('month'/g) ?? [];
    expect(meses).toHaveLength(2);
  });

  it("antecedência vem da configuração, não de número fixo (IM-068)", () => {
    expect(sql).toMatch(/\('aviso_encerramento_antecedencia_dias', 7, 1, 365,/);
    const usos = ramoInadimplencia.match(/aviso_encerramento_antecedencia_dias/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(4);
    expect(ramoInadimplencia).not.toMatch(/interval '\d+ days?'/);
  });

  it("privacidade: ator sempre nulo; nenhuma coluna de pessoa, contato ou valor (IM-029, IM-041, IM-050)", () => {
    expect(ramoInadimplencia.match(/null::text,/g)?.length).toBe(2);
    expect(ramoInadimplencia).not.toMatch(
      /nome_exibicao|telefone|whatsapp|email|e_mail|indicador_ref|cliente_ref|indicador_id|cliente_id|valor_centavos|base_centavos/i,
    );
    expect(ramoInadimplencia).not.toMatch(/auth\.users|contas_conta/);
  });

  it("filtro fixo pelo usuário logado e sem acesso anônimo (IM-086)", () => {
    expect(sql).toMatch(/revoke all on public\.notificacoes_meus_avisos from anon, authenticated;/);
    expect(sql).toMatch(/grant select on public\.notificacoes_meus_avisos to authenticated;/);
    expect(sql).toMatch(/l\.conta_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(
      /revoke all on function public\.notificacoes_marcar_lida\(text, uuid\) from public, anon;/,
    );
  });

  it("isolamento (IM-065): só lê pontos, relacionamento e comissões; escreve apenas o parâmetro novo", () => {
    expect(sql).not.toMatch(/\b(update|delete from)\b/i);
    const inserts = [...sql.matchAll(/insert into\s+public\.(\w+)/gi)].map((m) => m[1]);
    expect(new Set(inserts)).toEqual(new Set(["comissoes_parametro", "notificacoes_leitura"]));
    expect(ramoInadimplencia).not.toMatch(/pontos_|relacionamento_/);
  });
});
