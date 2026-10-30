import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática das migrações (IM-086, IM-029): complementa o pgTAP, que roda no CI com banco real.
 * Aqui só se confere o TEXTO das migrações, sem banco: RLS ativada e forçada em toda tabela, política por
 * operação, funções SECURITY DEFINER com search_path vazio e sem EXECUTE para PUBLIC/anon indevido, visões
 * públicas sem colunas privadas e visões "definer" apenas as conhecidas e travadas por auth.uid()/admin.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR).filter((n) => n.endsWith(".sql"));
const sql = arquivos.map((n) => ({ n, t: readFileSync(join(DIR, n), "utf8") }));
const tudo = sql.map((s) => s.t).join("\n");
const semComentario = (t: string) => t.replace(/--.*$/gm, "");
const codigo = semComentario(tudo);

const tabelas = [...codigo.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]!);
const OPERACOES = ["select", "insert", "update", "delete"] as const;

describe("migrações: RLS", () => {
  it("encontra as tabelas das Fases 1 e 2", () => {
    expect(tabelas.length).toBeGreaterThanOrEqual(13);
  });

  it.each(tabelas)("%s: RLS ativada e forçada", (t) => {
    expect(codigo).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    expect(codigo).toMatch(new RegExp(`alter table public\\.${t} force row level security`, "i"));
  });

  it.each(tabelas)("%s: política explícita para select, insert, update e delete", (t) => {
    for (const op of OPERACOES) {
      const re = new RegExp(`create policy \\w+ on public\\.${t}\\s+for ${op}\\b`, "i");
      const reLista = new RegExp(`create policy \\w+ on public\\.${t}\\s+for [a-z, ]*${op}`, "i");
      expect(re.test(codigo) || reLista.test(codigo), `${t} sem política de ${op}`).toBe(true);
    }
  });

  it.each(tabelas)("%s: privilégios padrão revogados de anon e authenticated", (t) => {
    expect(codigo).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`, "i"));
  });

  it("nenhuma política concede escrita a anon nas tabelas de perfis, itens e administração", () => {
    const politicas = [
      ...codigo.matchAll(
        /create policy (\w+) on public\.(\w+)\s+for (\w+) to ([^\n]+?)(?:\s+using|\s+with)/gi,
      ),
    ];
    const sensiveis = politicas.filter(([, , tabela]) =>
      /^(perfis_|catalogo_item|administracao_)/.test(tabela!),
    );
    const anonEscreve = sensiveis.filter(
      ([, , , op, para]) => op!.toLowerCase() !== "select" && /\banon\b/i.test(para!),
    );
    // Só as políticas "negado" (using false / with check false) podem citar anon em escrita.
    for (const [nome] of anonEscreve) expect(nome).toMatch(/negado/);
  });
});

describe("migrações: funções", () => {
  const funcoes = [
    ...codigo.matchAll(/create (?:or replace )?function public\.(\w+)\(([\s\S]*?)\$\$;/gi),
  ].map((m) => ({
    nome: m[1]!,
    corpo: m[0]!,
  }));

  it("encontra as funções", () => {
    expect(funcoes.length).toBeGreaterThan(20);
  });

  it.each(funcoes.map((f) => [f.nome, f.corpo] as const))(
    "%s: search_path vazio (todas) e nunca sem REVOKE explícito",
    (nome, corpo) => {
      expect(corpo, `${nome} sem search_path vazio`).toMatch(/set search_path = ''/i);
      expect(codigo, `${nome} sem revoke all`).toMatch(
        new RegExp(`revoke all on function public\\.${nome}\\(`, "i"),
      );
    },
  );

  it("funções administrativas nunca são executáveis por anon", () => {
    const nomes = funcoes
      .filter((f) => /administracao_exigir_admin\(\)/.test(f.corpo))
      .map((f) => f.nome);
    expect(nomes.length).toBeGreaterThan(3);
    for (const n of nomes) {
      expect(codigo).not.toMatch(
        new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to[^;]*\\banon\\b`, "i"),
      );
    }
  });

  it("nenhuma função concede execute a anon, exceto as de leitura pública conhecidas", () => {
    const concedidas = [
      ...codigo.matchAll(/grant execute on function public\.(\w+)\([^)]*\)\s+to ([^;]+);/gi),
    ]
      .filter(([, , para]) => /\banon\b/i.test(para!))
      .map(([, nome]) => nome!)
      .sort();
    expect(concedidas).toEqual([
      "busca_normalizar",
      "busca_publica",
      "catalogo_imagem_publica",
      "indicacoes_enviar_contato",
      "perfis_perfil_disponivel",
      "pontos_beneficio_no_prazo",
    ]);
  });
});

describe("migrações: visões", () => {
  const visoes = [
    ...codigo.matchAll(
      /create view public\.(\w+)(\s+with \(security_invoker = true\))? as([\s\S]*?);/gi,
    ),
  ].map((m) => ({ nome: m[1]!, invoker: Boolean(m[2]), corpo: m[3]! }));

  it("encontra as visões", () => {
    expect(visoes.map((v) => v.nome).sort()).toEqual(
      expect.arrayContaining([
        "administracao_consulta_negocios",
        "administracao_fila_contatos",
        "administracao_fila_pendencias",
        "administracao_meus_resultados",
        "administracao_patrocinador_publico",
        "catalogo_item_publico",
        "catalogo_meus_itens",
        "indicacoes_meus_links",
        "indicacoes_meus_pedidos",
        "indicacoes_minhas_indicacoes",
        "perfis_meus_perfis",
        "perfis_perfil_publico",
      ]),
    );
  });

  it("visões públicas são security_invoker e não trazem colunas privadas", () => {
    for (const nome of [
      "perfis_perfil_publico",
      "catalogo_item_publico",
      "administracao_patrocinador_publico",
    ]) {
      const v = visoes.find((x) => x.nome === nome)!;
      expect(v.invoker, `${nome} deve ser security_invoker`).toBe(true);
      expect(v.corpo).not.toMatch(/responsavel_id|conta_id|whatsapp|autor_id|\bemail\b/i);
    }
  });

  it("visões sem security_invoker são só as conhecidas, sem acesso a anon e travadas por quem chama", () => {
    // Visão recriada em migração posterior aparece mais de uma vez: deduplica por nome.
    const definer = [...new Set(visoes.filter((v) => !v.invoker).map((v) => v.nome))].sort();
    expect(definer).toEqual([
      "administracao_consulta_negocios",
      "administracao_fila_contatos",
      "administracao_fila_pendencias",
      "administracao_meus_resultados",
      "administracao_pontos_decisoes",
      "administracao_pontos_falhas",
      "administracao_pontos_lancamentos",
      "administracao_pontos_saldos",
      "catalogo_meus_itens",
      "indicacoes_meus_links",
      "indicacoes_meus_pedidos",
      "indicacoes_minhas_indicacoes",
      "notificacoes_meus_avisos",
      "notificacoes_quem_me_indicou",
      "perfis_meus_perfis",
      "pontos_meu_saldo",
      "pontos_meus_lancamentos",
      "relacionamento_meu_resumo",
      "relacionamento_meus_membros",
      "relacionamento_minhas_participacoes",
    ]);
    for (const v of visoes.filter((x) => !x.invoker)) {
      expect(v.corpo, `${v.nome} sem filtro por auth.uid()/administrador`).toMatch(
        /auth\.uid\(\)|administracao_eh_admin\(\)/,
      );
      expect(codigo).toMatch(
        new RegExp(`revoke all on public\\.${v.nome} from anon, authenticated`, "i"),
      );
      expect(codigo).not.toMatch(
        new RegExp(`grant select on public\\.${v.nome} to[^;]*\\banon\\b`, "i"),
      );
    }
  });

  it("a consulta do administrador não expõe contato nem dado de visitante", () => {
    const v = visoes.find((x) => x.nome === "administracao_consulta_negocios")!;
    expect(v.corpo).not.toMatch(/whatsapp|telefone|email|visitante|contato/i);
  });

  it("o resultado da revisão ao responsável não expõe o id do administrador nem e-mail", () => {
    const v = visoes.find((x) => x.nome === "administracao_meus_resultados")!;
    // autor_id só entra dentro do sha256; nunca como coluna da visão.
    const semHash = v.corpo.replace(/encode\(sha256\([\s\S]*?\), 'hex'\)/gi, "");
    expect(semHash).not.toMatch(/autor_id|decidida_por|email/i);
  });
});

describe("migrações: módulo indicacoes (IM-024 a IM-029, IM-041, IM-050, IM-086)", () => {
  const modulo = semComentario(
    sql
      .filter((s) => /indicacoes/.test(s.n))
      .map((s) => s.t)
      .join("\n"),
  );
  const visoesModulo = [...modulo.matchAll(/create view public\.(\w+) as([\s\S]*?);/gi)].map(
    (m) => ({ nome: m[1]!, corpo: m[2]! }),
  );
  const tabelasModulo = [...modulo.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]!);

  it("encontra as seis tabelas e as quatro visões do módulo", () => {
    expect([...tabelasModulo].sort()).toEqual([
      "indicacoes_evento",
      "indicacoes_link",
      "indicacoes_notificacao",
      "indicacoes_notificacao_historico",
      "indicacoes_parametro",
      "indicacoes_pedido_contato",
    ]);
    expect(visoesModulo.map((v) => v.nome).sort()).toEqual([
      "administracao_fila_contatos",
      "indicacoes_meus_links",
      "indicacoes_meus_pedidos",
      "indicacoes_minhas_indicacoes",
    ]);
  });

  it("a visão do indicador não tem dado do visitante (IM-029)", () => {
    const v = visoesModulo.find((x) => x.nome === "indicacoes_minhas_indicacoes")!;
    expect(v.corpo).not.toMatch(/p\.nome|whatsapp|email|mensagem|solicitante|chave_idempot/i);
  });

  it("nenhuma visão do módulo expõe id de conta (indicador, responsável, solicitante)", () => {
    for (const v of visoesModulo) {
      const colunas = v.corpo.split(/\bfrom\b/i)[0]!;
      expect(colunas, v.nome).not.toMatch(
        /indicador_id|responsavel_id|conta_id|solicitante_id|autor_id/i,
      );
    }
  });

  it("anon e authenticated não recebem privilégio direto em pedidos, links, notificações e histórico", () => {
    for (const t of [
      "indicacoes_pedido_contato",
      "indicacoes_link",
      "indicacoes_notificacao",
      "indicacoes_notificacao_historico",
    ]) {
      expect(modulo, t).not.toMatch(
        new RegExp(`grant [a-z, ()_]*on public\\.${t} to[^;]*\\b(anon|authenticated)\\b`, "i"),
      );
    }
  });

  it("funções do servidor só para service_role; internas sem grant", () => {
    for (const f of ["indicacoes_notificacoes_pendentes", "indicacoes_notificacao_registrar"]) {
      expect(modulo).toMatch(
        new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`, "i"),
      );
      expect(modulo).not.toMatch(
        new RegExp(
          `grant execute on function public\\.${f}\\([^)]*\\) to[^;]*\\b(anon|authenticated)\\b`,
          "i",
        ),
      );
    }
    for (const f of ["indicacoes_resolver_destino", "indicacoes_parametro_valor"]) {
      expect(modulo).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\(`, "i"));
    }
  });

  it("WhatsApp validado com [0-9], nunca com a classe de dígitos do regex", () => {
    expect(modulo).toContain("^\\+55[0-9]{10,11}$");
    expect(modulo).not.toContain("\\d");
  });

  it("pedidos, eventos, histórico e links têm gatilho de só inserção", () => {
    for (const t of [
      "indicacoes_pedido_contato",
      "indicacoes_evento",
      "indicacoes_notificacao_historico",
      "indicacoes_link",
    ]) {
      expect(modulo, t).toMatch(
        new RegExp(
          `before update or delete on public\\.${t}\\s+for each row execute function public\\.administracao_registro_imutavel`,
          "i",
        ),
      );
    }
  });

  it("ações administrativas gravam auditoria", () => {
    for (const f of [
      "indicacoes_tratar_alerta",
      "indicacoes_definir_parametro",
      "indicacoes_solicitar_reenvio",
    ]) {
      const m = modulo.match(
        new RegExp(`create function public\\.${f}\\(([\\s\\S]*?)\\$\\$;`, "i"),
      );
      expect(m?.[0], f).toMatch(/insert into public\.administracao_auditoria/);
    }
  });
});

describe("migrações: módulo pontos (IM-030 a IM-036, IM-078, IM-079, IM-086)", () => {
  const modulo = semComentario(
    sql
      .filter((s) => /pontos/.test(s.n))
      .map((s) => s.t)
      .join("\n"),
  );
  // Função recriada em migração posterior: vale a ÚLTIMA definição.
  const corpoFuncao = (nome: string) =>
    [...modulo.matchAll(new RegExp(`create function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "gi"))]
      .map((m) => m[0])
      .at(-1) ?? "";

  it("tem as sete tabelas do módulo", () => {
    expect([...modulo.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]).sort()).toEqual([
      "pontos_beneficio",
      "pontos_beneficio_revisao",
      "pontos_beneficio_versao",
      "pontos_decisao",
      "pontos_falha",
      "pontos_lancamento",
      "pontos_parametro",
    ]);
  });

  it("lançamentos, decisões, falhas e revisões são só de inserção (gatilho vale para service_role)", () => {
    for (const t of [
      "pontos_lancamento",
      "pontos_decisao",
      "pontos_falha",
      "pontos_beneficio_revisao",
    ]) {
      expect(modulo, t).toMatch(
        new RegExp(
          `before update or delete on public\\.${t}\\s+for each row execute function public\\.administracao_registro_imutavel`,
          "i",
        ),
      );
    }
  });

  it("nenhum privilégio de tabela a anon/authenticated em lançamentos, decisões e falhas; sem escrita direta", () => {
    for (const t of ["pontos_lancamento", "pontos_decisao", "pontos_falha"]) {
      expect(modulo, t).not.toMatch(
        new RegExp(`grant [a-z, ()_]*on public\\.${t} to[^;]*\\b(anon|authenticated)\\b`, "i"),
      );
    }
    expect(modulo).not.toMatch(/grant (insert|update|delete)[^;]*on public\.pontos_/i);
  });

  it("nenhuma visão do módulo devolve id de conta nem dado do visitante", () => {
    // Visão recriada em migração posterior: vale a última definição de cada nome.
    const ultimas = new Map<string, string>();
    for (const m of modulo.matchAll(/create view public\.(\w+)[^;]*? as([\s\S]*?);/gi)) {
      ultimas.set(m[1]!, m[2]!);
    }
    const visoes = [...ultimas].map(([nome, corpo]) => ({ nome, corpo }));
    expect(visoes.length).toBe(9);
    for (const v of visoes) {
      const colunas = v.corpo.split(/\bfrom\b/i)[0]!.replace(/sha256\([\s\S]*?\), 'hex'\)/gi, "");
      expect(colunas, v.nome).not.toMatch(
        /indicador_id|responsavel_id|conta_id|solicitante_id|autor_id|dono_id/i,
      );
      expect(v.corpo, v.nome).not.toMatch(/whatsapp|\bemail\b|mensagem|p\.nome/i);
    }
  });

  it("ações administrativas gravam auditoria", () => {
    for (const f of [
      "pontos_definir_parametro",
      "pontos_reverter_credito",
      "pontos_reprocessar_pedido",
      "pontos_decidir_beneficio_versao",
      "pontos_admin_cadastrar_beneficio",
      "pontos_admin_editar_proposta_beneficio",
      "pontos_admin_definir_beneficio_ativo",
    ]) {
      expect(corpoFuncao(f), f).toMatch(/insert into public\.administracao_auditoria/);
      expect(corpoFuncao(f), f).toMatch(/administracao_exigir_admin\(\)/);
    }
  });

  it("funções internas não têm grant; reprocessamento em lote só para service_role", () => {
    for (const f of ["pontos_avaliar_pedido", "pontos_parametro_valor", "pontos_pedido_pontuar"]) {
      expect(modulo).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\(`, "i"));
    }
    expect(modulo).toMatch(
      /grant execute on function public\.pontos_reprocessar_pendentes\(integer\) to service_role;/i,
    );
  });

  it("o gatilho de crédito nunca impede o pedido (captura exceção e registra a falha)", () => {
    const g = corpoFuncao("pontos_pedido_pontuar");
    expect(g).toMatch(/exception when others/i);
    expect(g).toMatch(/insert into public\.pontos_falha/i);
    expect(modulo).toMatch(
      /create trigger pontos_pedido_pontuar after insert on public\.indicacoes_pedido_contato/i,
    );
  });

  it("pontos e intervalo vêm dos parâmetros, nunca fixos na função de crédito (IM-030)", () => {
    const f = corpoFuncao("pontos_avaliar_pedido");
    expect(f).toMatch(/pontos_parametro_valor\('pontos_por_indicacao'\)/);
    expect(f).toMatch(/pontos_parametro_valor\('intervalo_dias'\)/);
    expect(f).not.toMatch(/\b30\b|:= 10\b/);
  });

  it("o indicador vê só a categoria da reversão, nunca a observação interna (D-012)", () => {
    const todas = [
      ...modulo.matchAll(/create view public\.pontos_meus_lancamentos as([\s\S]*?);/gi),
    ];
    const corpo = todas.at(-1)![1]!.split(/\bfrom\b/i)[0]!;
    expect(corpo).toMatch(/l\.categoria/);
    expect(corpo).not.toMatch(/motivo/);
  });

  it("benefício do administrador nasce aguardando aceite e nunca aprovado nem ativo (D-012)", () => {
    const f = corpoFuncao("pontos_admin_cadastrar_beneficio");
    expect(f).toMatch(/'aguardando_aceite'/);
    expect(f).not.toMatch(/ativo = true|'aprovada'/);
    const r = corpoFuncao("pontos_responder_proposta_beneficio");
    expect(r).toMatch(/responsavel_id = v_uid/);
    expect(r).toMatch(/ativo = true/); // aceite aprova e ativa (decisão de 30/10/2026)
    expect(r).toMatch(/administracao_auditoria/);
  });

  it("não existe resgate, cupom nem sorteio (IM-037, IM-038 são futuros)", () => {
    expect(modulo).not.toMatch(/create (?:function|table|view) public\.\w*(resgat|cupom|sorteio)/i);
  });
});

describe("migrações: privacidade de colunas (IM-029, IM-086)", () => {
  it("anon e authenticated não recebem SELECT em responsavel_id, conta_id, autor_id e decidida_por", () => {
    const grants = [
      ...codigo.matchAll(/grant select\s*(\([^)]*\))?\s*on public\.(\w+)\s+to ([^;]+);/gi),
    ];
    for (const [, colunas, tabela, para] of grants) {
      if (!/\b(anon|authenticated)\b/i.test(para!)) continue;
      if (!colunas) continue; // grant de tabela inteira: conferido abaixo
      expect(colunas, `${tabela}`).not.toMatch(/responsavel_id|conta_id|autor_id|decidida_por/i);
    }
  });

  it("grant de tabela inteira a anon só nas tabelas sem coluna privada", () => {
    const inteiras = [...codigo.matchAll(/grant select\s+on public\.(\w+)\s+to ([^;]+);/gi)]
      .filter(([, , para]) => /\banon\b/i.test(para!))
      .map(([, t]) => t!);
    // Visão recriada em migração posterior repete o grant: deduplica.
    expect([...new Set(inteiras)].sort()).toEqual([
      "administracao_patrocinador_publico",
      "catalogo_categoria",
      "catalogo_item_publico",
      "catalogo_item_versao",
      "perfis_perfil_publico",
      "perfis_perfil_versao",
      "pontos_beneficio",
      "pontos_beneficio_publico",
      "pontos_beneficio_versao",
    ]);
  });

  it("WhatsApp comercial só em tabela à parte, nunca lida por anon", () => {
    expect(codigo).not.toMatch(
      /grant select[^;]*on public\.perfis_perfil_versao_contato[^;]*\banon\b/i,
    );
    expect(codigo).not.toMatch(/create view[^;]*whatsapp_comercial[^;]*;/i);
  });

  it("caminhos de imagem são opacos: sem conta_id/responsavel_id no padrão do caminho", () => {
    const padroes = [...codigo.matchAll(/'\^(perfil|item)\/' \|\| [^\n]+/gi)].map((m) => m[0]);
    expect(padroes.length).toBeGreaterThanOrEqual(2);
    for (const p of padroes) expect(p).not.toMatch(/conta|responsavel|auth\.uid/i);
  });

  it("bucket de imagens é privado", () => {
    expect(codigo).toMatch(/values \('indicamais-imagens', 'indicamais-imagens', false,/i);
    expect(codigo).toMatch(/set public = false/i);
  });
});

describe("migrações: relacionamento e notificações (IM-039 a IM-045, IM-047 a IM-053, IM-086)", () => {
  const modulo = semComentario(
    sql
      .filter((s) => /^\d+_(relacionamento|notificacoes)_/.test(s.n))
      .map((s) => s.t)
      .join("\n"),
  );
  const corpoFuncao = (nome: string) =>
    [...modulo.matchAll(new RegExp(`create function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "gi"))]
      .map((m) => m[0])
      .at(-1) ?? "";
  const visoes = [...modulo.matchAll(/create view public\.(\w+) as([\s\S]*?);/gi)].map((m) => ({
    nome: m[1]!,
    corpo: m[2]!,
  }));
  const tabelasModulo = [...modulo.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]!);

  it("tem as seis tabelas e as cinco visões", () => {
    expect([...tabelasModulo].sort()).toEqual([
      "notificacoes_leitura",
      "relacionamento_entrada_decisao",
      "relacionamento_evento",
      "relacionamento_falha",
      "relacionamento_membro",
      "relacionamento_saida",
    ]);
    expect(visoes.map((v) => v.nome).sort()).toEqual([
      "notificacoes_meus_avisos",
      "notificacoes_quem_me_indicou",
      "relacionamento_meu_resumo",
      "relacionamento_meus_membros",
      "relacionamento_minhas_participacoes",
    ]);
  });

  it("nenhuma visão devolve id de conta, contato privado nem dado do visitante (IM-041, IM-050)", () => {
    for (const v of visoes) {
      // O pgTAP confere as colunas reais; aqui, o texto: id de conta nunca é coluna de saída (sha256 é opaco).
      const semHash = v.corpo.replace(/sha256\([\s\S]*?\), 'hex'\)/gi, "");
      expect(semHash, v.nome).not.toMatch(
        /\bas\s+(indicador_id|responsavel_id|conta_id|solicitante_id|autor_id|dono_id)\b/i,
      );
      expect(v.corpo, v.nome).not.toMatch(/whatsapp|\bemail\b|mensagem|p\.nome\b/i);
      // nome_exibicao só entra como argumento da função que o reduz a "Maria S."
      expect(
        v.corpo.replace(/relacionamento_nome_publico\(\w+\.nome_exibicao\)/gi, ""),
        v.nome,
      ).not.toMatch(/nome_exibicao/i);
    }
  });

  it("o nome de uma pessoa sai só por relacionamento_nome_publico: função pura (texto), só authenticated", () => {
    const f = corpoFuncao("relacionamento_nome_publico");
    expect(f).toMatch(/upper\(left\(/);
    expect(f).not.toMatch(/security definer|\bfrom\b/i);
    expect(modulo).toMatch(
      /grant execute on function public\.relacionamento_nome_publico\(text\) to authenticated;/i,
    );
    expect(modulo).not.toMatch(
      /grant execute on function public\.relacionamento_nome_publico\([^)]*\) to[^;]*\banon\b/i,
    );
  });

  it("nenhum privilégio de tabela a anon/authenticated nas tabelas de relacionamento; leitura só da própria", () => {
    for (const t of tabelasModulo.filter((x) => x !== "notificacoes_leitura")) {
      expect(modulo, t).not.toMatch(new RegExp(`grant [a-z, ()_]*on public\.${t} to`, "i"));
    }
    expect(modulo).toMatch(/grant select on public\.notificacoes_leitura to authenticated/i);
    expect(modulo).not.toMatch(
      /grant (insert|update|delete)[^;]*on public\.(relacionamento|notificacoes)_/i,
    );
  });

  it("decisões, eventos, falhas e leitura são só de inserção (gatilho vale para service_role)", () => {
    for (const t of [
      "relacionamento_evento",
      "relacionamento_entrada_decisao",
      "relacionamento_falha",
      "notificacoes_leitura",
    ]) {
      expect(modulo, t).toMatch(
        new RegExp(
          `before update or delete on public\\.${t}\\s+for each row execute function public\\.administracao_registro_imutavel`,
          "i",
        ),
      );
    }
  });

  it("o histórico agregado não tem coluna de pessoa (anônimo, IM-045)", () => {
    const m = modulo.match(/create table public\.relacionamento_evento \(([\s\S]*?)\n\);/i)!;
    expect(m[1]).not.toMatch(/conta|pessoa|usuario/i);
  });

  it("curtir só para authenticated; avaliação e nome público sem grant; lote só para service_role", () => {
    for (const f of [
      "relacionamento_curtir",
      "relacionamento_descurtir",
      "relacionamento_sair_da_base",
    ]) {
      expect(modulo).toMatch(
        new RegExp(`grant execute on function public\\.${f}\\(uuid\\) to authenticated;`, "i"),
      );
      expect(modulo).not.toMatch(
        new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to[^;]*\\banon\\b`, "i"),
      );
    }
    for (const f of ["relacionamento_avaliar_pedido", "relacionamento_pedido_avaliar"]) {
      expect(modulo).not.toMatch(new RegExp(`grant execute on function public\\.${f}\\(`, "i"));
    }
    expect(modulo).toMatch(
      /grant execute on function public\.relacionamento_reprocessar_pendentes\(integer\) to service_role;/i,
    );
  });

  it("a base e os avisos não tocam pontos nem comissões (IM-042)", () => {
    expect(modulo).not.toMatch(/public\.(pontos|comissoes)_\w+/i);
  });

  it("o gatilho de entrada nunca impede o pedido (captura exceção e registra a falha)", () => {
    const g = corpoFuncao("relacionamento_pedido_avaliar");
    expect(g).toMatch(/exception when others/i);
    expect(g).toMatch(/insert into public\.relacionamento_falha/i);
    expect(modulo).toMatch(
      /create trigger relacionamento_pedido_avaliar after insert on public\.indicacoes_pedido_contato/i,
    );
  });

  it("a entrada por indicação exige contato com link, e nem link gerado nem compartilhamento a ativam (IM-044)", () => {
    const f = corpoFuncao("relacionamento_avaliar_pedido");
    expect(f).toMatch(/link_id is null/);
    expect(f).toMatch(/autoindicacao/);
    expect(f).toMatch(/o_disponivel/);
    expect(modulo).not.toMatch(/on public\.indicacoes_(evento|link)\b/i);
    expect(modulo).not.toMatch(/link_gerado|link_compartilhado/);
  });

  it("os avisos são derivados, sem copiar conteúdo (IM-051, IM-053)", () => {
    const v = visoes.find((x) => x.nome === "notificacoes_meus_avisos")!;
    expect(v.corpo).toMatch(/relacionamento_entrada_decisao/);
    expect(v.corpo).toMatch(/relacionamento_membro/);
    expect(v.corpo).toMatch(/administracao_meus_resultados/);
    expect(v.corpo).not.toMatch(/compartilh|link_gerado/i);
    const leitura = modulo.match(
      /create table public\.notificacoes_leitura \(([\s\S]*?)\n\);/i,
    )![1]!;
    expect(leitura).not.toMatch(/texto|mensagem|titulo|corpo/i);
  });

  it("a leitura de avisos exige login e responde igual para aviso alheio ou inexistente", () => {
    for (const f of [
      "notificacoes_contar_nao_lidas",
      "notificacoes_marcar_lida",
      "notificacoes_marcar_todas_lidas",
    ]) {
      expect(corpoFuncao(f), f).toMatch(/errcode = '42501'/);
    }
    expect(corpoFuncao("notificacoes_marcar_lida")).toMatch(
      /aviso não encontrado' using errcode = 'P0002'/,
    );
  });
});
