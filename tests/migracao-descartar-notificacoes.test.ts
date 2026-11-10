import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da migração que descarta notificações de contato (IM-027, IM-028, IM-086). Complementa o
 * pgTAP (supabase/tests/database/indicacoes.test.sql), que roda no CI com banco real.
 */
const ARQ = "supabase/migrations/20261110100000_indicacoes_notificacao_descartar.sql";
const sql = readFileSync(join(process.cwd(), ARQ), "utf8").replace(/--.*$/gm, "");
const lerSemComentario = (arq: string) =>
  readFileSync(join(process.cwd(), arq), "utf8").replace(/--.*$/gm, "");

const corpo = (nome: string) =>
  sql.match(new RegExp(`function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "i"))?.[0] ?? "";

describe("migração indicacoes_notificacao_descartar", () => {
  const f = corpo("indicacoes_notificacoes_descartar");

  it("os checks aceitam o estado e o evento novos e mantêm os antigos", () => {
    expect(sql).toMatch(/check \(estado in \('pendente', 'enviada', 'falhou', 'descartada'\)\)/);
    expect(sql).toMatch(
      /check \(evento in \('tentativa_enviada', 'tentativa_falhou', 'reenvio_solicitado', 'alerta_tratado', 'descartada'\)\)/,
    );
  });

  it("assinatura, security definer, search_path vazio e guarda de administrador na primeira linha", () => {
    expect(f).toMatch(
      /indicacoes_notificacoes_descartar\(p_pedido_ids uuid\[\], p_motivo text\) returns integer/,
    );
    expect(f).toMatch(/security definer set search_path = ''/i);
    expect(f).toMatch(/v_admin uuid := public\.administracao_exigir_admin\(\);/);
  });

  it("grants: sem public/anon, só authenticated", () => {
    expect(sql).toMatch(
      /revoke all on function public\.indicacoes_notificacoes_descartar\(uuid\[\], text\) from public, anon;/,
    );
    const grants = [
      ...sql.matchAll(
        /grant execute on function public\.indicacoes_notificacoes_descartar[^;]+;/gi,
      ),
    ].map((m) => m[0]);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatch(/to authenticated;$/);
  });

  it("motivo obrigatório (mín. 10), array limitado a 500, vazio recusado", () => {
    expect(f).toMatch(/char_length\(v_motivo\) < 10/);
    expect(f).toMatch(/cardinality\(p_pedido_ids\) > 500/);
    expect(f).toMatch(/p_pedido_ids is null or coalesce\(cardinality\(p_pedido_ids\), 0\) = 0/);
  });

  it("age só em pendente/falhou, nunca apaga e não mexe em tentativas", () => {
    expect(f).toMatch(/n\.estado in \('pendente', 'falhou'\)/);
    expect(f).not.toMatch(/\bdelete\b|\btruncate\b|\bdrop\b/i);
    const update = f.match(/update public\.indicacoes_notificacao\s+set([\s\S]*?)where/i)![1]!;
    expect(update).toMatch(/estado = 'descartada'/);
    expect(update).not.toMatch(/tentativas\s*=/);
  });

  it("grava histórico (descartada, admin) e auditoria completa por pedido, na mesma função", () => {
    expect(f).toMatch(
      /insert into public\.indicacoes_notificacao_historico[\s\S]*'descartada', 'admin'/,
    );
    const aud = f.match(/insert into public\.administracao_auditoria\s*\(([^)]*)\)/i)![1]!;
    for (const c of ["autor_id", "acao", "motivo", "valor_anterior", "valor_novo"]) {
      expect(aud).toContain(c);
    }
    expect(f).toMatch(/'descartar_notificacao_contato'/);
    expect(f).toMatch(
      /valor_anterior|jsonb_build_object\('estado', r\.estado, 'tentativas', r\.tentativas, 'alerta_estado', r\.alerta_estado\)/,
    );
    expect(f).toMatch(/return v_qtd;/);
  });

  it("solicitar_reenvio bloqueia descartada e o registro do servidor a ignora", () => {
    expect(corpo("indicacoes_solicitar_reenvio")).toMatch(/v_estado = 'descartada'/);
    expect(corpo("indicacoes_notificacao_registrar")).toMatch(
      /v_estado in \('enviada', 'descartada'\)/,
    );
  });

  it("as filas do servidor continuam filtrando só pendente/falhou (descartada fica fora)", () => {
    const pend = lerSemComentario(
      "supabase/migrations/20261030120000_indicacoes_leitura_notificacao.sql",
    );
    expect(pend).toMatch(/where n\.estado = 'pendente'/);
    const rec = lerSemComentario(
      "supabase/migrations/20261105160000_indicacoes_notificacao_recolocar_falhas.sql",
    );
    expect(rec).toMatch(/n\.estado = 'falhou'/);
  });

  it("não edita migrações antigas: só cria objetos novos e substitui funções por create or replace", () => {
    expect(sql).not.toMatch(/\bdrop (table|function|view)\b/i);
    expect(sql).not.toMatch(/\b(delete from|truncate)\b/i);
  });
});
