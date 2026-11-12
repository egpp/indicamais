import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da Fase 7 (módulo comissoes: IM-061 a IM-073, IM-078, IM-086, D-025). Complementa o pgTAP
 * (supabase/tests/database/comissoes.test.sql, banco real no CI): aqui só se confere o TEXTO das migrações.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR).filter((n) => /_comissoes_.*\.sql$/.test(n));
const ler = (n: RegExp) =>
  arquivos
    .filter((a) => n.test(a))
    .map((a) => readFileSync(join(DIR, a), "utf8").replace(/--.*$/gm, "").replace(/\r\n/g, "\n"))
    .join("\n");

const modelo = ler(/comissoes_modelo/);
const habilitacao = ler(/comissoes_habilitacao_ofertas/);
const fluxo = ler(/comissoes_fluxo/);
const leitura = ler(/comissoes_leitura/);
const leiturasAdmin = ler(/comissoes_admin_leituras/);
const modulo = [modelo, habilitacao, fluxo, leitura, leiturasAdmin].join("\n");

const corpo = (texto: string, nome: string) =>
  [
    ...texto.matchAll(
      new RegExp(`create (?:or replace )?function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "gi"),
    ),
  ]
    .map((m) => m[0])
    .at(-1) ?? "";

const tabelas = [...modelo.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]!);
const funcoes = [...modulo.matchAll(/create function public\.(\w+)\(([\s\S]*?)\$\$;/gi)].map(
  (m) => ({
    nome: m[1]!,
    corpo: m[0]!,
  }),
);

describe("comissoes: tabelas (IM-086, IM-065)", () => {
  it("as migrações existem na ordem certa e as 16 tabelas têm prefixo comissoes_", () => {
    expect(arquivos.length).toBe(5);
    expect(tabelas).toHaveLength(16);
    for (const t of tabelas) expect(t).toMatch(/^comissoes_/);
  });

  it.each(tabelas)("%s: RLS forçada, quatro políticas e sem privilégio de escrita", (t) => {
    expect(modelo).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    expect(modelo).toMatch(new RegExp(`alter table public\\.${t} force row level security`));
    expect(modelo).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`));
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(modelo, `${t} sem política de ${op}`).toMatch(
        new RegExp(`create policy \\w+ on public\\.${t}\\s+for ${op}\\b`),
      );
    }
    expect(modelo).not.toMatch(new RegExp(`grant (insert|update|delete)[^;]*${t}`, "i"));
    // select só do administrador; escrita sempre negada ao cliente
    expect(modelo).toMatch(
      new RegExp(
        `create policy ${t}_select_admin on public\\.${t}\\s+for select to authenticated using \\(\\(select public\\.administracao_eh_admin\\(\\)\\)\\)`,
      ),
    );
    expect(modelo).toMatch(
      new RegExp(
        `create policy ${t}_insert_negado on public\\.${t}\\s+for insert to authenticated with check \\(false\\)`,
      ),
    );
  });

  it("histórico só de inserção: toda tabela, menos o parâmetro, tem gatilho de imutabilidade", () => {
    for (const t of tabelas.filter((x) => x !== "comissoes_parametro")) {
      expect(modelo, t).toMatch(
        new RegExp(
          `create trigger ${t}_imutavel before update or delete on public\\.${t}\\s+for each row execute function public\\.administracao_registro_imutavel\\(\\)`,
        ),
      );
    }
  });

  it("não toca nas tabelas de pontos, relacionamento ou social (IM-065)", () => {
    expect(modulo).not.toMatch(
      /(?:from|join|into|update|references)\s+public\.(pontos_|relacionamento_|social_)/,
    );
  });

  it("não guarda dados privados de cliente: nome, telefone, e-mail (IM-029, IM-041)", () => {
    expect(modelo).not.toMatch(/\b(whatsapp|telefone|email|nome_completo|nome_exibicao)\b/i);
  });

  it("valores em centavos inteiros e datas em UTC; moeda nunca em numeric/float", () => {
    expect(modelo).toMatch(/valor_centavos integer not null/);
    expect(modelo).not.toMatch(/\b(numeric|float|double precision|real|money)\b/i);
  });

  it("só oferta recorrente mensal; venda avulsa não é representável (IM-062)", () => {
    expect(modelo).toMatch(/comissoes_oferta_so_recorrente check \(periodicidade = 'mensal'\)/);
  });

  it("mononível: vínculo sem nível, cliente único por negócio, sem autoindicação (IM-063)", () => {
    const v = modelo.match(/create table public\.comissoes_vinculo \([\s\S]*?\n\);/)![0];
    expect(v).not.toMatch(/nivel|pai_id|superior|recrut/i);
    expect(v).toMatch(/unique \(perfil_id, cliente_id\)/);
    expect(v).toMatch(/check \(indicador_id <> cliente_id\)/);
  });

  it("duplicidade impedida por restrição única (IM-064)", () => {
    expect(modelo).toMatch(/comissoes_pagamento_unico unique \(assinatura_id, competencia\)/);
    expect(modelo).toMatch(/comissoes_comissao_pagamento_unico unique \(pagamento_id\)/);
    expect(modelo).toMatch(/comissoes_decisao_pagamento_unico unique \(pagamento_id\)/);
    expect(modelo).toMatch(
      /create unique index comissoes_lancamento_comissao_unico on public\.comissoes_lancamento \(comissao_id\) where tipo = 'comissao'/,
    );
    expect(modelo).toMatch(
      /create unique index comissoes_lancamento_reversao_unica on public\.comissoes_lancamento \(original_id\) where original_id is not null/,
    );
  });

  it("percentual congelado na comissão e histórico de percentuais (IM-069, IM-073)", () => {
    expect(modelo).toMatch(/percentual_bp integer not null/);
    expect(modelo).toMatch(/valor_centavos = \(base_centavos::bigint \* percentual_bp \/ 10000\)/);
    expect(modelo).toMatch(/create table public\.comissoes_oferta_percentual/);
  });

  it("prazo de inadimplência: parâmetro próprio, padrão 60 dias (IM-068, D-025)", () => {
    expect(modelo).toMatch(/\('prazo_inadimplencia_dias', 60, 1, 365,/);
  });
});

describe("comissoes: funções (IM-086)", () => {
  it("encontra as funções do módulo", () => {
    expect(funcoes.length).toBeGreaterThan(20);
  });

  it.each(funcoes.map((f) => [f.nome, f.corpo] as const))(
    "%s: search_path vazio e REVOKE explícito, sem grant a anon",
    (nome, c) => {
      expect(c).toMatch(/set search_path = ''/);
      expect(modulo).toMatch(new RegExp(`revoke all on function public\\.${nome}\\(`));
      expect(modulo).not.toMatch(
        new RegExp(`grant execute on function public\\.${nome}\\([^)]*\\) to[^;]*\\banon\\b`, "i"),
      );
    },
  );

  it("funções internas não são chamáveis pela API", () => {
    for (const n of [
      "comissoes_hoje",
      "comissoes_parametro_valor",
      "comissoes_modulo_ativo",
      "comissoes_oferta_ativa",
      "comissoes_percentual_vigente",
      "comissoes_exigir_responsavel",
      "comissoes_situacao_indicador",
      "comissoes_avaliar_pagamento",
      "comissoes_inserir_reversao",
    ]) {
      expect(modulo, n).toMatch(
        new RegExp(
          `revoke all on function public\\.${n}\\([^)]*\\) from public, anon, authenticated;`,
        ),
      );
      expect(modulo, n).not.toMatch(
        new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to`, "i"),
      );
    }
  });

  it("ações administrativas: só administrador geral, motivo obrigatório e auditoria na MESMA função", () => {
    const admin: Record<string, string> = {
      comissoes_definir_parametro: fluxo + habilitacao,
      comissoes_definir_habilitacao: habilitacao,
      comissoes_registrar_vinculo: fluxo,
      comissoes_registrar_assinatura: fluxo,
      comissoes_cancelar_assinatura: fluxo,
      comissoes_confirmar_pagamento: fluxo,
      comissoes_estornar_pagamento: fluxo,
      comissoes_reverter_comissao: fluxo,
      comissoes_avancar_repasse: fluxo,
      comissoes_encerrar_vinculo: fluxo,
    };
    for (const [nome, texto] of Object.entries(admin)) {
      const c = corpo(texto, nome);
      expect(c, nome).toMatch(/administracao_exigir_admin\(\)/);
      expect(c, nome).toMatch(/motivo obrigatório/);
      expect(c, nome).toMatch(/insert into public\.administracao_auditoria/);
      expect(c, nome).toMatch(/valor_anterior/);
      expect(modulo, nome).toMatch(
        new RegExp(`grant execute on function public\\.${nome}\\([^)]*\\) to authenticated;`),
      );
    }
    const lista = corpo(fluxo, "comissoes_listar_vinculos_vencidos");
    expect(lista).toMatch(/administracao_exigir_admin\(\)/);
  });

  it("nenhuma ação de comissões usa permissão delegada nem rotina agendada (IM-061, IM-068)", () => {
    expect(modulo).not.toMatch(/administracao_exigir_permissao/);
    expect(modulo).not.toMatch(/to service_role/);
    expect(modulo).not.toMatch(/pg_cron|cron\.schedule/);
  });

  it("habilitação: idempotente, cria a rede e não ativa integração financeira (IM-061, IM-063)", () => {
    const c = corpo(habilitacao, "comissoes_definir_habilitacao");
    expect(c).toMatch(/if v_atual = p_ativa then\s+return null/);
    expect(c).toMatch(/insert into public\.comissoes_rede/);
    expect(c).toMatch(/pg_advisory_xact_lock/);
  });

  it("anunciante: só o responsável do negócio e só com o módulo habilitado (IM-061, IM-062)", () => {
    const g = corpo(habilitacao, "comissoes_exigir_responsavel");
    expect(g).toMatch(/responsavel_id = v_uid/);
    expect(g).toMatch(/contas_acesso_permitido\(v_uid\)/);
    expect(g).toMatch(/errcode = '42501'/);
    for (const f of [
      "comissoes_criar_oferta",
      "comissoes_alterar_percentual_oferta",
      "comissoes_definir_oferta_ativa",
    ]) {
      const c = corpo(habilitacao, f);
      expect(c, f).toMatch(/comissoes_exigir_responsavel\(/);
      expect(c, f).not.toMatch(/administracao_exigir_admin/);
    }
    expect(corpo(habilitacao, "comissoes_criar_oferta")).toMatch(
      /comissoes_modulo_ativo\(p_perfil\)/,
    );
  });

  it("confirmação de pagamento: idempotente e a comissão nasce na mesma transação (IM-064, IM-070)", () => {
    const c = corpo(fluxo, "comissoes_confirmar_pagamento");
    expect(c).toMatch(/return v_pag;/);
    expect(c).toMatch(/comissoes_avaliar_pagamento\(v_pag, v_admin\)/);
    expect(c).toMatch(/competência deve ser o dia 1 do mês/);
    expect(c).toMatch(/pg_advisory_xact_lock/);
  });

  it("avaliação: sem vínculo, vínculo encerrado, módulo desativado, oferta inativa e inadimplência bloqueiam só a nova comissão", () => {
    const c = corpo(fluxo, "comissoes_avaliar_pagamento");
    for (const m of [
      "sem_vinculo",
      "vinculo_encerrado",
      "modulo_desativado",
      "oferta_inativa",
      "indicador_inadimplente",
      "valor_zero",
      "gerada",
    ]) {
      expect(c, m).toContain(`'${m}'`);
    }
    // percentual vigente no momento, congelado na linha; nunca recalcula comissão existente
    expect(c).toMatch(/comissoes_percentual_vigente\(v_a\.oferta_id\)/);
    expect(c).not.toMatch(/update public\.comissoes_/i);
    expect(c).not.toMatch(/delete from public\.comissoes_/i);
  });

  it("tolerância do mês corrente: só meses encerrados contam como em aberto (D-026, IM-066, IM-072)", () => {
    const c = corpo(fluxo, "comissoes_situacao_indicador");
    expect(c).toMatch(/\(v_mes - interval '1 month'\)/);
    expect(c).not.toMatch(/v_mes::timestamp, interval/);
  });

  it("reversão: lançamento novo que aponta o original, uma só vez, comissão paga exige confirmação (IM-073, IM-078)", () => {
    const c = corpo(fluxo, "comissoes_inserir_reversao");
    expect(c).toMatch(/original_id/);
    expect(c).toMatch(/-v_orig\.valor_centavos/);
    expect(c).toMatch(/comissão já revertida/);
    expect(c).toMatch(/errcode = 'P0410'/);
    const est = corpo(fluxo, "comissoes_estornar_pagamento");
    expect(est).toMatch(/comissoes_inserir_reversao\(/);
  });

  it("nenhuma migração do módulo faz UPDATE ou DELETE em histórico (só o parâmetro muda)", () => {
    const sem = modulo.replace(/create trigger[\s\S]*?;/gi, "");
    const alvos = [...sem.matchAll(/\b(update|delete from)\s+public\.(\w+)/gi)].map((m) => m[2]);
    expect(alvos.every((a) => a === "comissoes_parametro")).toBe(true);
  });

  it("encerramento de vínculo: só administrador, respeita o prazo e não restaura (IM-068, IM-072)", () => {
    const c = corpo(fluxo, "comissoes_encerrar_vinculo");
    expect(c).toMatch(/prazo_inadimplencia_dias/);
    expect(c).toMatch(/o prazo de inadimplência ainda não venceu/);
    expect(modulo).not.toMatch(/restaurar|reativar_vinculo/i);
  });
});

describe("comissoes: leitura sem dados privados (IM-029, IM-041, IM-050)", () => {
  const visoes = [
    ...leitura.matchAll(
      /create view public\.(\w+)(\s+with \(security_invoker = true\))? as([\s\S]*?);/gi,
    ),
  ].map((m) => ({ nome: m[1]!, corpo: m[3]! }));

  it("as sete visões do indicador e do anunciante", () => {
    expect(visoes.map((v) => v.nome).sort()).toEqual([
      "comissoes_meu_saldo",
      "comissoes_meus_negocios",
      "comissoes_minha_situacao",
      "comissoes_minhas_comissoes",
      "comissoes_minhas_ofertas",
      "comissoes_negocio_comissoes",
      "comissoes_negocio_vinculos",
    ]);
  });

  it.each(visoes.map((v) => [v.nome, v.corpo] as const))(
    "%s: filtro por auth.uid(), sem anon e sem colunas privadas",
    (nome, c) => {
      expect(c).toMatch(/\(select auth\.uid\(\)\)/);
      expect(leitura).toMatch(
        new RegExp(`revoke all on public\\.${nome} from anon, authenticated`),
      );
      expect(leitura).toMatch(new RegExp(`grant select on public\\.${nome} to authenticated;`));
      expect(leitura).not.toMatch(
        new RegExp(`grant select on public\\.${nome} to[^;]*\\banon\\b`, "i"),
      );
      // ids só entram dentro do sha256 (referência opaca); nunca como coluna
      const colunas = c.split(/\bfrom\b/i)[0]!.replace(/encode\(sha256\([\s\S]*?\), 'hex'\)/g, "");
      expect(colunas).not.toMatch(
        /cliente_id|conta_id|whatsapp|telefone|email|nome_completo|nome_exibicao/i,
      );
      expect(colunas).not.toMatch(/\bindicador_id\b/);
      expect(colunas).not.toMatch(/\bautor_id\b|\bmotivo\b/);
    },
  );

  it("o anunciante só enxerga o próprio negócio e o indicador só as próprias comissões", () => {
    for (const n of [
      "comissoes_meus_negocios",
      "comissoes_minhas_ofertas",
      "comissoes_negocio_comissoes",
      "comissoes_negocio_vinculos",
    ]) {
      expect(visoes.find((v) => v.nome === n)!.corpo, n).toMatch(
        /responsavel_id = \(select auth\.uid\(\)\)/,
      );
    }
    for (const n of ["comissoes_minhas_comissoes", "comissoes_meu_saldo"]) {
      expect(visoes.find((v) => v.nome === n)!.corpo, n).toMatch(
        /indicador_id = \(select auth\.uid\(\)\)/,
      );
    }
  });
});

describe("comissoes: visões não chamam função sem EXECUTE do chamador (revisão independente, 05/11/2026)", () => {
  // Visão sem security_invoker avalia as TABELAS com os direitos do dono, mas as FUNÇÕES com os direitos de quem consulta
  // (doc do PostgreSQL, CREATE VIEW). Função interna sem EXECUTE para authenticated faz a visão falhar com 42501.
  // Foi o que derrubou o pgTAP do CI (comissoes.test.sql:123, "permission denied for function comissoes_percentual_vigente").
  const chamaveis = new Set(
    [...modulo.matchAll(/grant execute on function public\.(\w+)\([^)]*\) to authenticated/gi)].map(
      (m) => m[1]!,
    ),
  );
  const proprias = funcoes.map((f) => f.nome);
  const visoesLeitura = [...leitura.matchAll(/create view public\.(\w+)[\s\S]*?;/gi)].map((m) => ({
    nome: m[1]!,
    corpo: m[0]!,
  }));

  it.each(visoesLeitura.map((v) => [v.nome, v.corpo] as const))(
    "%s: só chama funções que o usuário autenticado pode executar",
    (nome, corpoVisao) => {
      const usadas = proprias.filter((f) => new RegExp(`public\\.${f}\\s*\\(`).test(corpoVisao));
      const semAcesso = usadas.filter((f) => !chamaveis.has(f));
      expect(semAcesso, `${nome} chama função interna sem EXECUTE para authenticated`).toEqual([]);
    },
  );

  it("funções que aceitam uuid arbitrário nunca são liberadas a authenticated", () => {
    expect([...chamaveis]).not.toContain("comissoes_situacao_indicador");
    expect([...chamaveis]).not.toContain("comissoes_avaliar_pagamento");
    expect([...chamaveis]).not.toContain("comissoes_inserir_reversao");
  });
});

describe("comissoes: correções da revisão (D1, D3, D4, D5)", () => {
  it("D3: estorno de pagamento não refaz reversão já existente", () => {
    const c = corpo(fluxo, "comissoes_estornar_pagamento");
    expect(c).toMatch(/r\.tipo = 'reversao'/);
    expect(c).toMatch(/if v_rev is null then/);
  });

  it("D4: mesmo cliente, oferta e competência não são pagos duas vezes por assinaturas diferentes", () => {
    const c = corpo(fluxo, "comissoes_confirmar_pagamento");
    expect(c).toMatch(/a2\.oferta_id = v_a\.oferta_id and a2\.cliente_id = v_a\.cliente_id/);
    expect(c).toMatch(/competência já paga para este cliente nesta oferta/);
  });

  it("D5: valor diferente da assinatura exige justificativa e vai para a auditoria; cliente válido", () => {
    const c = corpo(fluxo, "comissoes_confirmar_pagamento");
    expect(c).toMatch(/p_valor_centavos <> v_a\.valor_centavos/);
    expect(c).toMatch(/'valor_diferente'/);
    const r = corpo(fluxo, "comissoes_registrar_assinatura");
    expect(r).toMatch(/p_cliente = v_resp/);
    expect(r).toMatch(/contas_acesso_permitido\(p_cliente\)/);
  });

  it("D1: invólucros de situação não aceitam parâmetros e filtram por auth.uid()", () => {
    for (const n of [
      "comissoes_situacoes_como_indicador",
      "comissoes_situacoes_como_responsavel",
    ]) {
      const c = corpo(leitura, n);
      expect(c, n).toMatch(/\(select auth\.uid\(\)\)/);
      expect(leitura, n).toMatch(new RegExp(`function public\\.${n}\\(\\)`));
    }
  });
});

describe("comissoes: leituras do administrador e nome público do negócio (migração 20261105140000)", () => {
  const adminFns = [
    "comissoes_admin_listar_negocios",
    "comissoes_admin_listar_assinaturas",
    "comissoes_admin_listar_pagamentos",
    "comissoes_admin_listar_comissoes",
    "comissoes_admin_listar_vinculos",
    "comissoes_admin_prazo_inadimplencia",
  ];

  it("só cria funções: sem visão, tabela, política nem alteração de privilégio de tabela (RLS não muda)", () => {
    expect(leiturasAdmin).not.toMatch(
      /create (or replace )?view|create table|create policy|alter table/i,
    );
    expect(leiturasAdmin).not.toMatch(/grant (select|insert|update|delete)/i);
    expect(leiturasAdmin).not.toMatch(/(update|delete from|insert into)\s+public\./i);
  });

  it.each(adminFns)("%s: exige administrador geral, sem anon, search_path vazio", (n) => {
    const c = corpo(leiturasAdmin, n);
    expect(c, n).toMatch(/perform public\.administracao_exigir_admin\(\)/);
    expect(c, n).toMatch(/security definer set search_path = ''/);
    expect(leiturasAdmin, n).toMatch(
      new RegExp(`revoke all on function public\\.${n}\\([^)]*\\) from public, anon;`),
    );
    expect(leiturasAdmin, n).toMatch(
      new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to authenticated;`),
    );
    expect(leiturasAdmin, n).not.toMatch(
      new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to[^;]*\\banon\\b`, "i"),
    );
  });

  it.each(adminFns.filter((n) => n !== "comissoes_admin_prazo_inadimplencia"))(
    "%s: paginação limitada a 100 e total do filtro",
    (n) => {
      const c = corpo(leiturasAdmin, n);
      expect(c).toMatch(/least\(greatest\(coalesce\(p_limite, 50\), 1\), 100\)/);
      expect(c).toMatch(/count\(\*\) over \(\)/);
    },
  );

  it("nenhuma leitura do administrador toca contas_conta, contato, nome completo ou motivo interno (IM-029, IM-041, IM-050)", () => {
    const texto = adminFns.map((n) => corpo(leiturasAdmin, n)).join("\n");
    expect(texto).not.toMatch(
      /contas_conta|whatsapp|telefone|\bemail\b|nome_completo|nome_exibicao|contato/i,
    );
    // o único "motivo" lido é o código fixo da decisão do pagamento; o texto livre do administrador não é coluna
    expect(texto.match(/\b\w+\.motivo\b/g)).toEqual(["d.motivo"]);
  });

  it("não cria atalho para as funções internas nem aceita uuid arbitrário fora do administrador", () => {
    for (const n of [
      "comissoes_hoje",
      "comissoes_parametro_valor",
      "comissoes_situacao_indicador",
    ]) {
      expect(leiturasAdmin).not.toMatch(new RegExp(`grant execute on function public\\.${n}\\(`));
    }
  });

  it("indicador: invólucro sem parâmetros, filtro fixo em auth.uid() e só nome de site público", () => {
    const c = corpo(leiturasAdmin, "comissoes_meus_negocios_vinculados");
    expect(c).toMatch(/function public\.comissoes_meus_negocios_vinculados\(\)/);
    expect(c).toMatch(/cv\.indicador_id = \(select auth\.uid\(\)\)/);
    expect(c).toMatch(/case when p\.publicado then v\.nome end/);
    expect(c).not.toMatch(/responsavel_id|cliente_id|administracao_exigir_admin/);
    expect(leiturasAdmin).toMatch(
      /grant execute on function public\.comissoes_meus_negocios_vinculados\(\) to authenticated;/,
    );
  });
});

describe("comissoes: leituras do administrador, revisão adversarial do verificador", () => {
  const todas = [
    "comissoes_admin_listar_negocios",
    "comissoes_admin_listar_assinaturas",
    "comissoes_admin_listar_pagamentos",
    "comissoes_admin_listar_comissoes",
    "comissoes_admin_listar_vinculos",
    "comissoes_admin_prazo_inadimplencia",
    "comissoes_meus_negocios_vinculados",
  ];

  it("as 7 funções têm revoke de public e anon, grant só a authenticated e nenhuma outra função nova", () => {
    const criadas = [...leiturasAdmin.matchAll(/create function public\.(\w+)\(/g)].map(
      (m) => m[1],
    );
    expect([...criadas].sort()).toEqual([...todas].sort());
    const grants = [...leiturasAdmin.matchAll(/grant execute on function [^;]*? to ([^;]+);/g)];
    expect(grants).toHaveLength(7);
    for (const g of grants) expect(g[1].trim()).toBe("authenticated");
    expect(leiturasAdmin).not.toMatch(/to anon|to service_role/i);
  });

  it("o guarda do administrador vem antes de qualquer leitura de dados", () => {
    for (const n of todas.filter((x) => x.startsWith("comissoes_admin_"))) {
      const c = corpo(leiturasAdmin, n);
      const iGuarda = c.indexOf("perform public.administracao_exigir_admin()");
      expect(iGuarda, n).toBeGreaterThan(-1);
      expect(c.indexOf("return query"), n).toBeGreaterThan(iGuarda);
    }
  });

  it("busca é literal (position), sem LIKE/ILIKE/regex nem SQL dinâmico", () => {
    expect(leiturasAdmin).not.toMatch(/\b(i?like|similar to)\b|\s~\*?\s|execute\s+(format|'|\$)/i);
    expect(corpo(leiturasAdmin, "comissoes_admin_listar_negocios")).toMatch(
      /position\(v_busca in lower\(b\.slug\)\)/,
    );
  });

  it("deslocamento é saneado e filtros inválidos dão 22023", () => {
    for (const n of todas.filter((x) => x.startsWith("comissoes_admin_listar_"))) {
      const c = corpo(leiturasAdmin, n);
      expect(c, n).toMatch(/greatest\(coalesce\(p_deslocamento, 0\), 0\)/);
      expect(c, n).toMatch(/errcode = '22023'/);
    }
  });

  it("nome do negócio só sai de versão aprovada e site publicado, nas duas visões", () => {
    const c1 = corpo(leiturasAdmin, "comissoes_admin_listar_negocios");
    const c2 = corpo(leiturasAdmin, "comissoes_meus_negocios_vinculados");
    for (const c of [c1, c2]) {
      expect(c).toMatch(/v\.id = p\.versao_aprovada_id and v\.situacao = 'aprovada'/);
      expect(c).toMatch(/case when p\.publicado then/);
    }
    expect(c2).toMatch(/case when p\.publicado then p\.slug end/);
  });

  it("nenhuma assinatura de retorno carrega dado privado", () => {
    const retornos = leiturasAdmin.match(/returns table \(([\s\S]*?)\)\s*language/g) ?? [];
    expect(retornos).toHaveLength(7);
    for (const r of retornos)
      expect(r).not.toMatch(/telefone|whatsapp|email|nome_completo|contato|motivo|responsavel/i);
  });
});
