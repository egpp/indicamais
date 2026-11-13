import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-035 (IM-030, IM-015, IM-006, IM-086): conferência estática das migrações dos tetos (sem banco). O comportamento
 * é provado no pgTAP (supabase/tests/database/pontos_teto_diario.test.sql e contas_tetos_criacao.test.sql, que rodam
 * no CI); aqui travamos o desenho: parâmetros e faixas, ordem das regras, travas contra corrida, erro padronizado,
 * histórico só de inserção e independência de comissões e relacionamento. Complementa tests/revisao-seguranca-banco.test.ts.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const ler = (n: string) => readFileSync(join(DIR, n), "utf8").replace(/--.*$/gm, "");
const pontos = ler("20261109100000_pontos_teto_diario.sql");
const criacao = ler("20261109110000_contas_tetos_criacao.sql");

const corpoFuncao = (sql: string, nome: string) =>
  new RegExp(
    `create (?:or replace )?function public\\.${nome}\\([\\s\\S]*?\\bas \\$\\$([\\s\\S]*?)\\$\\$;`,
    "i",
  ).exec(sql)?.[1] ?? "";

describe("D-035 · teto diário de pontos (migração 20261109100000)", () => {
  const avaliar = corpoFuncao(pontos, "pontos_avaliar_pedido_interno");

  it("parâmetro auditado: 100 por dia, faixa 10 a 10000, na tabela de parâmetros de pontos", () => {
    expect(pontos).toMatch(
      /insert into public\.pontos_parametro[\s\S]*'teto_diario_pontos', 100, 10, 10000,/,
    );
    // A alteração segue pela função administrativa já existente (motivo + auditoria); a migração não abre escrita nova.
    expect(pontos).not.toMatch(/create policy|grant (insert|update|delete)/i);
  });

  it("regra cruzada: pontos_definir_parametro recusa teto < pontos por indicação (P0431), antes de gravar e auditar", () => {
    const f = corpoFuncao(pontos, "pontos_definir_parametro");
    expect(f).toContain("administracao_exigir_admin()");
    expect(f).toMatch(/raise exception 'pontos_teto_menor_que_indicacao' using errcode = 'P0431'/);
    expect(f).toMatch(/if v_teto < v_pts then/);
    // Recusa vem depois da faixa e ANTES do update e da auditoria.
    const faixa = f.indexOf("valor fora da faixa permitida");
    const recusa = f.indexOf("P0431");
    expect(faixa).toBeGreaterThan(-1);
    expect(recusa).toBeGreaterThan(faixa);
    expect(f.indexOf("update public.pontos_parametro")).toBeGreaterThan(recusa);
    expect(f.indexOf("insert into public.administracao_auditoria")).toBeGreaterThan(recusa);
    // Trava as duas linhas em ordem fixa de chave (sem corrida nem deadlock entre administradores).
    expect(f).toMatch(/order by pa\.chave for update/);
    expect(pontos).toMatch(
      /grant execute on function public\.pontos_definir_parametro\(text, integer, text\) to authenticated/,
    );
  });

  it("o motivo limite_diario é aceito na decisão e exige o teto gravado", () => {
    expect(pontos).toMatch(/'dentro_do_intervalo', 'limite_diario'\)/);
    expect(pontos).toMatch(/motivo <> 'limite_diario' or teto_diario is not null/);
  });

  it("dia civil de America/Sao_Paulo, contado pela data do PEDIDO (reprocessamento não desloca o dia)", () => {
    const janela = corpoFuncao(pontos, "pontos_janela_dia");
    expect(janela).toContain("America/Sao_Paulo");
    expect(avaliar).toMatch(/pontos_janela_dia\(v_p\.criado_em\)/);
    expect(avaliar).toMatch(/d\.pedido_criado_em >= v_ini and d\.pedido_criado_em < v_fim/);
  });

  it("soma só decisões pontuadas do indicador (reversão não devolve espaço; sem dupla contagem)", () => {
    expect(avaliar).toMatch(/sum\(d\.pontos\)[\s\S]*d\.indicador_id = v_indicador and d\.pontuado/);
    expect(avaliar).not.toMatch(/pontos_lancamento[\s\S]*sum/);
  });

  it("tudo ou nada: passou do teto = limite_diario, depois das regras de duplicidade e autoindicação", () => {
    expect(avaliar).toMatch(/elsif v_usado \+ v_pts > v_teto then\s+v_motivo := 'limite_diario'/);
    const ordem = [
      "'sem_atribuicao'",
      "'autoindicacao'",
      "'destino_indisponivel'",
      "'dentro_do_intervalo'",
      "'limite_diario'",
      "'pontuado'",
    ].map((m) => avaliar.indexOf(`v_motivo := ${m}`));
    expect(ordem.every((i) => i > -1)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("nunca recusa o pedido por causa do teto: só uma exceção no teto de decisão (pedido inexistente)", () => {
    const recusas = [...avaliar.matchAll(/raise exception '([^']*)'/g)].map((m) => m[1]);
    expect(recusas).toEqual(["pedido não encontrado"]);
    // O crédito só é gravado quando pontuado.
    expect(avaliar).toMatch(
      /if v_motivo = 'pontuado' then\s+insert into public\.pontos_lancamento/,
    );
    expect(avaliar.match(/insert into public\.pontos_lancamento/g)).toHaveLength(1);
  });

  it("serializa por indicador DEPOIS do lock da chave de duplicidade (mesma ordem sempre, sem deadlock)", () => {
    const chave = avaliar.indexOf("pontos_chave:");
    const indicador = avaliar.indexOf("pontos_indicador_dia:");
    const soma = avaliar.indexOf("sum(d.pontos)");
    expect(chave).toBeGreaterThan(-1);
    expect(indicador).toBeGreaterThan(chave);
    expect(soma).toBeGreaterThan(indicador);
  });

  it("M1: reprocessamento usa a mesma ordem de locks, sem espera (try-lock), e pula pedido com lock ocupado", () => {
    // Interno: modo sem espera usa try-lock na chave e depois no indicador; modo com espera (gatilho) mantém a ordem.
    const tryChave = avaliar.indexOf("pg_try_advisory_xact_lock(hashtextextended('pontos_chave:'");
    const tryInd = avaliar.indexOf(
      "pg_try_advisory_xact_lock(hashtextextended('pontos_indicador_dia:'",
    );
    expect(tryChave).toBeGreaterThan(-1);
    expect(tryInd).toBeGreaterThan(tryChave);
    expect(avaliar.match(/return null;/g)).toHaveLength(2);
    // Gatilho: assinatura original espera pelos locks (sem_espera = false).
    expect(corpoFuncao(pontos, "pontos_avaliar_pedido")).toMatch(
      /pontos_avaliar_pedido_interno\(p_pedido_id, false\)/,
    );
    // Lote: sem espera; pulado não conta nem vira falha. Pedido individual: erro 55P03 sem auditoria.
    const lote = corpoFuncao(pontos, "pontos_reprocessar_pendentes");
    expect(lote).toMatch(
      /if public\.pontos_avaliar_pedido_interno\(v_id, true\) is not null then\s+v_ok := v_ok \+ 1;/,
    );
    expect(lote).not.toMatch(/pontos_avaliar_pedido\(/);
    const unico = corpoFuncao(pontos, "pontos_reprocessar_pedido");
    expect(unico).toMatch(/pontos_avaliar_pedido_interno\(p_pedido_id, true\)/);
    expect(unico.indexOf("55P03")).toBeLessThan(unico.indexOf("administracao_auditoria"));
    expect(unico).toContain("administracao_exigir_permissao('reverter_pontos')");
    expect(pontos).toMatch(
      /revoke all on function public\.pontos_avaliar_pedido_interno\(uuid, boolean\) from public, anon, authenticated/,
    );
  });

  it("histórico só de inserção: nenhuma migração de teto faz UPDATE ou DELETE em decisão ou lançamento", () => {
    expect(pontos).not.toMatch(/\b(update|delete from)\s+public\.pontos_(decisao|lancamento)\b/i);
    expect(pontos).not.toMatch(/drop trigger|disable trigger/i);
  });

  it("não toca comissões nem relacionamento (módulos independentes, IM-065)", () => {
    expect(pontos).not.toMatch(/comissoes_|relacionamento_/);
    expect(criacao).not.toMatch(/comissoes_|relacionamento_|pontos_/);
  });

  it("leitura do indicador: só os próprios contatos e sem dado do visitante", () => {
    const visao =
      /create view public\.pontos_meus_limites_diarios as([\s\S]*?);/.exec(pontos)?.[1] ?? "";
    expect(visao).toMatch(/d\.indicador_id = \(select auth\.uid\(\)\)/);
    expect(visao).not.toMatch(/nome|whatsapp|email|mensagem|solicitante|chave_hash/i);
    expect(pontos).toMatch(
      /revoke all on public\.pontos_meus_limites_diarios from anon, authenticated/,
    );
    expect(pontos).toMatch(
      /revoke all on function public\.pontos_meu_limite_diario\(\) from public, anon;/,
    );
  });
});

describe("D-035 · tetos de criação por conta (migração 20261109110000)", () => {
  const guarda = corpoFuncao(criacao, "contas_exigir_teto_criacao");

  it("quatro parâmetros auditados em contas_parametro, com as faixas aceitas", () => {
    for (const linha of [
      "'tetos_perfis_por_conta', 3, 1, 50,",
      "'tetos_itens_por_perfil', 30, 1, 500,",
      "'tetos_anuncios_particulares', 10, 1, 200,",
      "'tetos_rascunhos_abertos', 10, 1, 100,",
    ]) {
      expect(criacao).toContain(linha);
    }
    // Sem tabela nova nem função administrativa nova: reaproveita contas_definir_parametro (motivo + auditoria).
    expect(criacao).not.toMatch(/create table/i);
    expect(criacao).not.toMatch(/create (or replace )?function public\.contas_definir/i);
  });

  it("erro padronizado P0430 com a chave do teto na mensagem, no detalhe e na dica", () => {
    expect(guarda).toMatch(/raise exception 'teto_atingido:%', v_chave using errcode = 'P0430'/);
    expect(guarda).toMatch(/detail = 'limite=' \|\| v_lim/);
    expect(guarda).toMatch(/hint = v_chave/);
    expect(guarda.match(/errcode = 'P0430'/g)).toHaveLength(2); // teto específico e teto de rascunhos
  });

  it("administrador não tem teto e a guarda sai antes de qualquer contagem ou trava", () => {
    const admin = guarda.indexOf("administracao_administrador");
    expect(admin).toBeGreaterThan(-1);
    expect(admin).toBeLessThan(guarda.indexOf("pg_advisory_xact_lock"));
    expect(admin).toBeLessThan(guarda.indexOf("count(*)"));
  });

  it("sem corrida: trava por conta ANTES de contar, na mesma transação do insert", () => {
    const trava = guarda.indexOf("pg_advisory_xact_lock(hashtextextended('contas_criacao:'");
    expect(trava).toBeGreaterThan(-1);
    expect(trava).toBeLessThan(guarda.indexOf("count(*)"));
    // A contagem é limitada pelo teto (nunca varre tudo).
    expect(guarda.match(/limit v_lim/g)!.length).toBeGreaterThanOrEqual(3);
    expect(guarda).not.toMatch(/pg_advisory_lock\(/); // nada de trava de sessão
  });

  it("rascunho aberto = site ou item sem nenhuma versão enviada, somados", () => {
    expect(guarda).toMatch(
      /perfis_perfil_versao v where v\.perfil_id = p\.id and v\.situacao <> 'rascunho'/,
    );
    expect(guarda).toMatch(
      /catalogo_item_versao v where v\.item_id = i\.id and v\.situacao <> 'rascunho'/,
    );
    expect(guarda).toMatch(/union all/);
  });

  it("a guarda é interna: sem EXECUTE para anon nem authenticated", () => {
    expect(criacao).toMatch(
      /revoke all on function public\.contas_exigir_teto_criacao\(uuid, text, uuid\) from public, anon, authenticated;/,
    );
    expect(criacao).not.toMatch(/grant execute on function public\.contas_exigir_teto_criacao/);
  });

  it("as duas funções de criação chamam a guarda ANTES do insert, com o responsável vindo de auth.uid()", () => {
    const perfil = corpoFuncao(criacao, "perfis_criar_rascunho");
    const item = corpoFuncao(criacao, "catalogo_criar_item");
    expect(perfil).toMatch(/v_uid uuid := \(select auth\.uid\(\)\)/);
    expect(perfil.indexOf("contas_exigir_teto_criacao(v_uid, 'perfil')")).toBeGreaterThan(-1);
    expect(perfil.indexOf("contas_exigir_teto_criacao")).toBeLessThan(
      perfil.indexOf("insert into public.perfis_perfil "),
    );
    expect(item).toMatch(/v_uid uuid := \(select auth\.uid\(\)\)/);
    expect(item).toMatch(
      /contas_exigir_teto_criacao\(v_uid, case when p_perfil_id is null then 'anuncio' else 'item_perfil' end, p_perfil_id\)/,
    );
    expect(item.indexOf("contas_exigir_teto_criacao")).toBeLessThan(
      item.indexOf("insert into public.catalogo_item "),
    );
    // Mesmas assinaturas das versões anteriores: create or replace mantém os GRANTs, sem drop.
    expect(criacao).not.toMatch(/drop function/i);
    expect(
      criacao.match(
        /create or replace function public\.(perfis_criar_rascunho|catalogo_criar_item)/g,
      ),
    ).toHaveLength(2);
  });

  it("só esses dois caminhos criam site ou item nas migrações (nenhum insert novo escapa do teto)", () => {
    const inserts: string[] = [];
    for (const n of readdirSync(DIR)
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const t = ler(n);
      if (/insert into public\.(perfis_perfil|catalogo_item)\s*\(/.test(t)) inserts.push(n);
    }
    expect(inserts).toEqual([
      "20261024150000_perfis_catalogo_rpcs_resultados.sql",
      "20261029100000_catalogo_anuncio_particular_localizacao.sql",
      "20261109110000_contas_tetos_criacao.sql",
    ]);
  });
});
