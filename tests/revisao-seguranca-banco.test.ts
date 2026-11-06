import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Revisão de segurança do banco (Fase 14, IM-086): varredura estática do ESTADO FINAL das migrações. Complementa
 * tests/migracoes-seguranca.test.ts (que confere texto por migração) e o pgTAP (que roda com banco real no CI).
 * Aqui as migrações são lidas EM ORDEM, simulando create/drop/alter/grant/revoke, de modo que uma migração nova
 * que esqueça RLS, política, REVOKE ou GRANT explícito falhe o teste, e que um DROP/CREATE posterior valha.
 *
 * Premissa do Supabase: o schema public concede, por privilégio padrão, EXECUTE de função nova a anon e
 * authenticated (e SELECT/INSERT/UPDATE/DELETE de tabela nova). Por isso toda função precisa de REVOKE explícito
 * e toda abertura precisa de GRANT explícito, e as listas fechadas abaixo só mudam com revisão consciente.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR)
  .filter((n) => n.endsWith(".sql"))
  .sort();
const semComentario = (t: string) => t.replace(/--.*$/gm, "");
const migracoes = arquivos.map((n) => ({
  n,
  t: semComentario(readFileSync(join(DIR, n), "utf8")),
}));

type Papeis = Record<string, boolean>;
const PAPEIS = ["public", "anon", "authenticated", "service_role"] as const;
const padrao = (): Papeis => ({
  public: true,
  anon: true,
  authenticated: true,
  service_role: true,
});
const lista = (s: string) => s.split(",").map((x) => x.trim().toLowerCase());
const semAspas = (s: string) => s.replace(/"/g, "");

interface Tabela {
  nome: string;
  rls: boolean;
  forcada: boolean;
  politicas: Map<string, string[]>; // nome -> operações
  revogouTudo: boolean;
  imutavel: boolean;
  grantsTabelaInteira: Set<string>; // papéis com SELECT na tabela inteira
  grantsEscrita: Set<string>; // papéis com INSERT/UPDATE/DELETE (qualquer coluna)
}
interface Funcao {
  nome: string;
  arquivo: string;
  definer: boolean;
  searchPathVazio: boolean;
  corpo: string;
  acl: Papeis;
  grantExplicito: Set<string>;
}
interface Visao {
  nome: string;
  invoker: boolean;
  corpo: string;
  grantsSelect: Set<string>;
}

const tabelas = new Map<string, Tabela>();
const funcoes = new Map<string, Funcao>();
const visoes = new Map<string, Visao>();
const politicasStorage = new Map<string, { op: string; papeis: string; texto: string }>();
const desabilitaRls: string[] = [];
const criaSemSchema: string[] = [];
const sqlDinamico: string[] = [];

function tabela(nome: string): Tabela {
  let t = tabelas.get(nome);
  if (!t) {
    t = {
      nome,
      rls: false,
      forcada: false,
      politicas: new Map(),
      revogouTudo: false,
      imutavel: false,
      grantsTabelaInteira: new Set(),
      grantsEscrita: new Set(),
    };
    tabelas.set(nome, t);
  }
  return t;
}
const qualificado = (n: string) =>
  semAspas(n)
    .toLowerCase()
    .replace(/^public\./, "");

for (const { n, t } of migracoes) {
  const re = new RegExp(
    [
      /create table (?:if not exists )?([\w."]+)/.source, // 1
      /alter table ([\w."]+) (enable|force|disable|no force) row level security/.source, // 2,3
      /create policy (\w+) on ([\w."]+)\s+(?:as \w+\s+)?for ([a-z, ]+?)\s+to ([^\n]+?)\s*(?:using|with check|;)/
        .source, // 4,5,6,7
      /drop policy (?:if exists )?(\w+) on ([\w."]+)/.source, // 8,9
      /revoke (?:all|select|insert|update|delete)[^;]*? on (?:table )?([\w."]+) from ([^;]+);/
        .source, // 10,11
      /grant ([a-z ,]+?)(?:\s*\([^)]*\))? on (?:table )?(public\.\w+) to ([^;]+);/.source, // 12,13,14
      /create (?:or replace )?function public\.(\w+)\(([\s\S]*?)\)\s*returns[\s\S]*?language \w+([\s\S]*?)\bas \$(?<tag>\w*)\$([\s\S]*?)\$\k<tag>\$/
        .source, // 15,16,17,18,19
      /revoke (?:all|execute) on function public\.(\w+)\([^)]*\)\s+from ([^;]+);/.source, // 20,21
      /grant execute on function public\.(\w+)\([^)]*\)\s+to ([^;]+);/.source, // 22,23
      /drop function (?:if exists )?public\.(\w+)\(/.source, // 24
      /create (?:or replace )?view public\.(\w+)(\s+with \(security_invoker = true\))?\s+as([\s\S]*?);/
        .source, // 25,26,27
      /drop view (?:if exists )?public\.(\w+)/.source, // 28
      /create trigger \w+\s+before update or delete on (public\.\w+)\s+for each row execute function public\.administracao_registro_imutavel/
        .source, // 29
      /alter view public\.(\w+) set \(security_invoker = (true|false)\)/.source, // 30,31
    ].join("|"),
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[1]) {
      const nome = qualificado(m[1]);
      if (!semAspas(m[1]).includes(".")) criaSemSchema.push(`${n}: ${m[1]}`);
      tabela(nome);
    } else if (m[2]) {
      const tb = tabela(qualificado(m[2]));
      const acao = m[3]!.toLowerCase();
      if (acao === "enable") tb.rls = true;
      else if (acao === "force") tb.forcada = true;
      else desabilitaRls.push(`${n}: ${acao} em ${m[2]}`);
    } else if (m[4]) {
      const alvo = qualificado(m[5]!);
      const ops = lista(m[6]!)
        .map((o) => (o === "all" ? "select, insert, update, delete" : o))
        .join(",");
      const opsLista = lista(ops);
      if (alvo === "storage.objects") {
        const trecho = t.slice(m.index, t.indexOf(";", m.index));
        politicasStorage.set(m[4], { op: opsLista[0]!, papeis: m[7]!, texto: trecho });
      } else {
        tabela(alvo).politicas.set(m[4], opsLista);
      }
    } else if (m[8]) {
      const alvo = qualificado(m[9]!);
      if (alvo === "storage.objects") politicasStorage.delete(m[8]);
      else tabela(alvo).politicas.delete(m[8]);
    } else if (m[10]) {
      const alvo = qualificado(m[10]);
      const papeis = lista(m[11]!);
      if (tabelas.has(alvo) && papeis.includes("anon") && papeis.includes("authenticated")) {
        tabela(alvo).revogouTudo = true;
      }
      const v = visoes.get(alvo);
      if (v && papeis.includes("anon")) v.grantsSelect.delete("anon");
      if (v && papeis.includes("authenticated")) v.grantsSelect.delete("authenticated");
    } else if (m[12]) {
      const privs = lista(m[12]);
      const alvo = qualificado(m[13]!);
      const papeis = lista(m[14]!);
      const comColunas = /\(/.test(m[0]!.slice(0, m[0]!.toLowerCase().indexOf(" on ")));
      const tb = tabelas.get(alvo);
      const v = visoes.get(alvo);
      for (const p of papeis) {
        if (privs.includes("select") || privs.includes("all")) {
          if (!comColunas && tb) tb.grantsTabelaInteira.add(p);
          if (v) v.grantsSelect.add(p);
        }
        if (tb && privs.some((x) => ["insert", "update", "delete", "all"].includes(x)))
          tb.grantsEscrita.add(p);
      }
    } else if (m[15]) {
      const nome = m[15];
      const atributos = m[17] ?? "";
      const corpo = m[19] ?? "";
      if (/\bexecute\b\s+(format|')|\bformat\(/i.test(corpo)) sqlDinamico.push(`${n}: ${nome}`);
      const anterior = funcoes.get(nome);
      funcoes.set(nome, {
        nome,
        arquivo: n,
        definer: /security definer/i.test(atributos),
        searchPathVazio: /set search_path = ''/i.test(atributos),
        corpo,
        acl: anterior?.acl ?? padrao(),
        grantExplicito: anterior?.grantExplicito ?? new Set(),
      });
    } else if (m[20]) {
      const f = funcoes.get(m[20]);
      if (f) for (const p of lista(m[21]!)) f.acl[p] = false;
    } else if (m[22]) {
      const f = funcoes.get(m[22]);
      if (f)
        for (const p of lista(m[23]!)) {
          f.acl[p] = true;
          f.grantExplicito.add(p);
        }
    } else if (m[24]) {
      funcoes.delete(m[24]);
    } else if (m[25]) {
      visoes.set(m[25], {
        nome: m[25],
        invoker: Boolean(m[26]),
        corpo: m[27] ?? "",
        // create or replace view mantém os privilégios; drop view (abaixo) os apaga.
        grantsSelect: visoes.get(m[25])?.grantsSelect ?? new Set(),
      });
    } else if (m[28]) {
      visoes.delete(m[28]);
    } else if (m[29]) {
      tabela(qualificado(m[29])).imutavel = true;
    } else if (m[30]) {
      const v = visoes.get(m[30]);
      if (v) v.invoker = m[31]!.toLowerCase() === "true";
    }
  }
  // Bloco DO com format(): único lugar de SQL dinâmico conhecido (comentado, só constantes).
  if (/execute format\(/i.test(t)) sqlDinamico.push(`${n}: bloco DO`);
}

const NOMES_TABELAS = [...tabelas.keys()].sort();
const OPERACOES = ["select", "insert", "update", "delete"];

describe("revisão de segurança · tabelas (estado final)", () => {
  it("encontra todas as tabelas do schema public (inventário)", () => {
    expect(NOMES_TABELAS.length).toBeGreaterThanOrEqual(65);
    expect(NOMES_TABELAS.every((x) => !x.includes("."))).toBe(true);
  });

  it("toda função criada ou removida usa o prefixo public. (senão a varredura não a enxerga)", () => {
    const fora: string[] = [];
    const re =
      /(?:create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?)\s+(?!public\.)("?[\w.]+"?)/gi;
    for (const { n, t } of migracoes) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) fora.push(`${n}: ${m[1]}`);
    }
    expect(fora).toEqual([]);
  });

  it("nenhuma migração cria tabela sem schema explícito nem desliga RLS", () => {
    expect(criaSemSchema).toEqual([]);
    expect(desabilitaRls).toEqual([]);
  });

  it.each(NOMES_TABELAS)("%s: RLS ativada e FORÇADA", (nome) => {
    const t = tabelas.get(nome)!;
    expect(t.rls, `${nome} sem enable row level security`).toBe(true);
    expect(t.forcada, `${nome} sem force row level security`).toBe(true);
  });

  it.each(NOMES_TABELAS)("%s: política explícita para select, insert, update e delete", (nome) => {
    const t = tabelas.get(nome)!;
    const cobertas = new Set([...t.politicas.values()].flat());
    for (const op of OPERACOES)
      expect(cobertas.has(op), `${nome} sem política de ${op}`).toBe(true);
  });

  it.each(NOMES_TABELAS)("%s: privilégios padrão revogados de anon e authenticated", (nome) => {
    expect(tabelas.get(nome)!.revogouTudo, `${nome} sem revoke all from anon, authenticated`).toBe(
      true,
    );
  });

  it("anon nunca recebe INSERT, UPDATE ou DELETE em tabela alguma", () => {
    const ruins = NOMES_TABELAS.filter((n) => tabelas.get(n)!.grantsEscrita.has("anon"));
    expect(ruins).toEqual([]);
  });

  it("tabelas só de inserção (gatilho de imutabilidade) não têm escrita direta para anon/authenticated", () => {
    const imutaveis = NOMES_TABELAS.filter((n) => tabelas.get(n)!.imutavel);
    expect(imutaveis.length).toBeGreaterThanOrEqual(30);
    for (const n of imutaveis) {
      const g = tabelas.get(n)!.grantsEscrita;
      expect(g.has("authenticated"), `${n} aceita escrita de authenticated`).toBe(false);
      expect(g.has("anon"), `${n} aceita escrita de anon`).toBe(false);
    }
  });

  it("SELECT na tabela INTEIRA para anon só nas tabelas conhecidas (coluna nova nasce pública: revisar a cada uma)", () => {
    const abertas = NOMES_TABELAS.filter((n) =>
      tabelas.get(n)!.grantsTabelaInteira.has("anon"),
    ).sort();
    expect(abertas).toEqual([
      "catalogo_categoria",
      "catalogo_item_versao",
      "perfis_estilo_pagina",
      "perfis_perfil_versao",
      "pontos_beneficio",
      "pontos_beneficio_versao",
    ]);
  });
});

describe("revisão de segurança · funções (estado final)", () => {
  const todas = [...funcoes.values()];

  it("encontra as funções (inventário)", () => {
    expect(todas.length).toBeGreaterThanOrEqual(180);
  });

  it("toda função tem search_path vazio e nenhuma ficou executável por PUBLIC", () => {
    const semPath = todas.filter((f) => !f.searchPathVazio).map((f) => f.nome);
    expect(semPath).toEqual([]);
    const publicas = todas.filter((f) => f.acl.public).map((f) => f.nome);
    expect(publicas).toEqual([]);
  });

  it("anon executa só a lista fechada de leituras públicas e do formulário público", () => {
    const anon = todas
      .filter((f) => f.acl.anon)
      .map((f) => f.nome)
      .sort();
    expect(anon).toEqual([
      "administracao_denunciar",
      "busca_home_secao_perfis",
      "busca_home_secoes",
      "busca_normalizar",
      "busca_publica",
      "catalogo_imagem_publica",
      "indicacoes_enviar_contato",
      "loja_listar_imoveis",
      "perfis_endereco_ref",
      "perfis_perfil_disponivel",
      "pontos_beneficio_no_prazo",
    ]);
  });

  it("todo EXECUTE de authenticated é um GRANT explícito (nada por privilégio padrão)", () => {
    const implicitas = todas.filter(
      (f) => f.acl.authenticated && !f.grantExplicito.has("authenticated"),
    );
    expect(implicitas.map((f) => f.nome)).toEqual([]);
  });

  it("SECURITY DEFINER executável por authenticated/anon valida quem chama (ou está na lista de ajudantes públicos)", () => {
    const GUARDA =
      /auth\.uid\(\)|administracao_exigir_(admin|permissao)|administracao_eh_admin|administracao_permitido|comissoes_exigir_responsavel|contas_acesso_permitido|contas_acesso_ativo/;
    // Ajudantes de leitura sem dado privado: devolvem boolean ou só conteúdo já público; revisados na Fase 14.
    const SEM_GUARDA_REVISADOS = [
      "busca_home_secao_perfis",
      "busca_home_secoes",
      "catalogo_imagem_em_uso",
      "catalogo_imagem_publica",
      "perfis_perfil_disponivel",
      "pontos_beneficio_no_prazo",
    ];
    const sem = todas
      .filter((f) => f.definer && (f.acl.authenticated || f.acl.anon) && !GUARDA.test(f.corpo))
      .map((f) => f.nome)
      .sort();
    expect(sem).toEqual(SEM_GUARDA_REVISADOS);
  });

  it("funções do servidor (service_role) nunca são executáveis por anon/authenticated", () => {
    const SERVIDOR = [
      "contas_executar_encerramentos",
      "indicacoes_notificacao_registrar",
      "indicacoes_notificacoes_pendentes",
      "indicacoes_notificacoes_recolocar_falhas",
      "pontos_reprocessar_pendentes",
      "relacionamento_reprocessar_pendentes",
    ];
    for (const nome of SERVIDOR) {
      const f = funcoes.get(nome)!;
      expect(f.grantExplicito.has("service_role"), nome).toBe(true);
      expect(f.acl.anon || f.acl.authenticated || f.acl.public, nome).toBe(false);
    }
  });

  it("função administrativa que ESCREVE grava auditoria (autor, motivo, valor anterior) na mesma função", () => {
    const admin = todas.filter(
      (f) =>
        f.definer &&
        /administracao_exigir_(admin|permissao)\(/.test(f.corpo) &&
        /\b(insert into|update public\.|delete from)\b/i.test(f.corpo),
    );
    expect(admin.length).toBeGreaterThanOrEqual(35);
    const semAuditoria = admin.filter(
      (f) => !/insert into public\.administracao_auditoria/.test(f.corpo),
    );
    expect(semAuditoria.map((f) => f.nome)).toEqual([]);
    // Toda auditoria grava o autor; as que alteram algo existente gravam também o valor anterior.
    for (const f of admin) {
      for (const ins of f.corpo.matchAll(
        /insert into public\.administracao_auditoria\s*\(([^)]*)\)/gi,
      )) {
        expect(ins[1], `${f.nome} sem autor_id na auditoria`).toMatch(/autor_id/);
      }
    }
  });

  it("SQL dinâmico só no bloco conhecido (constantes, sem entrada do usuário)", () => {
    expect(sqlDinamico).toEqual(["20261102100000_contas_ciclo_vida_base.sql: bloco DO"]);
  });

  it("nenhuma função usa LIKE/ILIKE com entrada do usuário (só padrões constantes e nomes de objeto validados)", () => {
    const comLike = todas
      .filter((f) => /\bi?like\b/i.test(f.corpo))
      .map((f) => f.nome)
      .sort();
    expect(comLike).toEqual(["catalogo_imagens_da_conta", "perfis_pasta_para_aprovador"]);
  });
});

describe("revisão de segurança · visões (estado final)", () => {
  const todas = [...visoes.values()];

  it("toda visão aberta a anon é security_invoker e sem coluna de conta/contato privado", () => {
    const abertas = todas.filter((v) => v.grantsSelect.has("anon"));
    expect(abertas.map((v) => v.nome).sort()).toEqual([
      "administracao_patrocinador_publico",
      "catalogo_item_publico",
      "loja_item_publico",
      "perfis_banner_publico",
      "perfis_perfil_publico",
      "pontos_beneficio_publico",
    ]);
    for (const v of abertas) {
      expect(v.invoker, `${v.nome} precisa de security_invoker`).toBe(true);
      const colunas = v.corpo.split(/\bfrom\b/i)[0]!;
      expect(colunas, v.nome).not.toMatch(
        /responsavel_id|conta_id|autor_id|solicitante_id|indicador_id|decidida_por|\bemail\b|whatsapp|telefone/i,
      );
    }
  });

  it("visão que roda com direitos do dono (sem security_invoker) nunca é aberta a anon e filtra por quem chama", () => {
    const definer = todas.filter((v) => !v.invoker);
    expect(definer.length).toBeGreaterThanOrEqual(30);
    for (const v of definer) {
      expect(v.grantsSelect.has("anon"), `${v.nome} aberta a anon`).toBe(false);
      expect(v.corpo, `${v.nome} sem filtro por auth.uid()/administrador`).toMatch(
        /auth\.uid\(\)|administracao_eh_admin\(\)|administracao_permitido(?:_algum)?\(|comissoes_situacoes_como_|contas_acesso_ativo\(\)|administracao_meus_resultados|comissoes_minha_situacao|comissoes_negocio_vinculos/,
      );
    }
  });

  it("visão security_invoker só chama função que o papel consumidor pode executar (lição D1 das comissões)", () => {
    for (const v of todas.filter((x) => x.invoker)) {
      const consumidores = v.grantsSelect.has("anon")
        ? ["anon", "authenticated"]
        : ["authenticated"];
      for (const c of v.corpo.matchAll(/public\.(\w+)\(/g)) {
        const f = funcoes.get(c[1]!);
        if (!f) continue;
        for (const papel of consumidores) {
          expect(f.acl[papel], `${v.nome} chama ${f.nome} sem EXECUTE para ${papel}`).toBe(true);
        }
      }
    }
  });

  it("nenhuma visão entrega dado privado de visitante a indicador nem a notificação (IM-029, IM-041, IM-050)", () => {
    const PRIVADO = /p\.nome\b|whatsapp|\bemail\b|mensagem|solicitante/i;
    for (const nome of [
      "indicacoes_minhas_indicacoes",
      "indicacoes_meus_links",
      "notificacoes_meus_avisos",
      "notificacoes_quem_me_indicou",
      "relacionamento_meus_membros",
      "relacionamento_minhas_participacoes",
      "pontos_meu_saldo",
      "pontos_meus_lancamentos",
    ]) {
      const v = visoes.get(nome)!;
      const colunas = v.corpo.split(/\bfrom\b/i)[0]!;
      expect(colunas, nome).not.toMatch(PRIVADO);
    }
  });
});

describe("revisão de segurança · Storage e abuso (estado final)", () => {
  const pol = [...politicasStorage.entries()];
  const tudoMigracoes = migracoes.map((m) => m.t).join("\n");

  it("toda política de storage.objects fica restrita ao bucket de imagens", () => {
    expect(pol.length).toBeGreaterThan(8);
    for (const [nome, p] of pol) {
      expect(p.texto, nome).toMatch(/bucket_id = 'indicamais-imagens'/);
    }
  });

  it("anon só lê no Storage (nunca escreve) e só imagem pública", () => {
    for (const [nome, p] of pol.filter(([, x]) => /\banon\b/.test(x.papeis))) {
      expect(p.op, nome).toBe("select");
      expect(p.texto, nome).toMatch(/catalogo_imagem_publica/);
    }
  });

  it("o bucket é privado e não há política de escrita para o papel público", () => {
    const tudo = migracoes.map((m) => m.t).join("\n");
    expect(tudo).toMatch(/'indicamais-imagens', 'indicamais-imagens', false/);
    expect(tudo).not.toMatch(/public\s*=\s*true/i);
  });

  it("S-02: o UPDATE do dono não vale para imagem em uso (sem sobrescrita de conteúdo aprovado)", () => {
    const up = politicasStorage.get("catalogo_imagens_update_propria");
    expect(up?.texto).toMatch(/not public\.catalogo_imagem_em_uso\(name\)/);
    expect(up?.texto).toMatch(/name !~ '\/adm-\[\^\/\]\*\$'/);
  });

  it("S-01: gatilho zera owner/owner_id dos objetos (a listagem pública não revela a conta)", () => {
    const tudo = migracoes.map((m) => m.t).join("\n");
    expect(tudo).toMatch(
      /create trigger catalogo_storage_sem_dono\s+before insert or update on storage\.objects/i,
    );
    expect(funcoes.get("catalogo_storage_sem_dono")?.corpo).toMatch(/'owner_id', null/);
  });

  it("nomes adm-* continuam reservados ao aprovador nas políticas de envio do dono", () => {
    for (const nome of ["catalogo_imagens_insert_propria", "catalogo_imagens_update_propria"]) {
      expect(politicasStorage.get(nome)?.texto, nome).toMatch(/name !~ '\/adm-\[\^\/\]\*\$'/);
    }
  });

  it("S-03: por link tira a atribuição (não recusa); destino e global só alarmam, com interruptor para recusar", () => {
    const tudo = migracoes.map((m) => m.t).join("\n");
    expect(tudo).toMatch(
      /create trigger indicacoes_pedido_limitar before insert on public\.indicacoes_pedido_contato/i,
    );
    const corpo = funcoes.get("indicacoes_pedido_limitar")?.corpo ?? "";
    for (const chave of [
      "contato_limite_por_link_hora",
      "contato_limite_por_destino_hora",
      "contato_limite_global_hora",
      "contato_recusar_excesso",
    ]) {
      expect(corpo).toContain(chave);
    }
    expect(corpo).toMatch(/new\.link_id := null/);
    // Serializa por link e por destino (o limite não pode ser mole só porque o visitante varia o WhatsApp).
    expect(corpo).toMatch(/pg_advisory_xact_lock\([^)]*indicacoes_link/);
    expect(corpo).toMatch(/pg_advisory_xact_lock\([^)]*indicacoes_destino/);
    // Contagem barata: sempre com limit, nunca count(*) sobre a janela inteira.
    expect(corpo).not.toMatch(/count\(\*\)\s+into\s+\w+\s+from\s+public/i);
    // A única recusa possível é a do interruptor (nunca a do link).
    const recusas = corpo.split("raise exception").length - 1;
    expect(recusas).toBe(2);
    expect(corpo.indexOf("new.link_id := null")).toBeLessThan(corpo.indexOf("v_recusar then"));
    expect(funcoes.get("indicacoes_pedido_limitar")?.acl.anon).toBe(false);
    expect(funcoes.get("indicacoes_evento_link_do_pedido")?.acl.anon).toBe(false);
    // Teto configurável do limiar global: o custo da contagem fica limitado.
    expect(tudo).toMatch(/'contato_limite_global_hora', 1000, 10, 10000,/);
    // Alarme: tabela só de inserção, lida só pelo administrador.
    expect(tabelas.get("indicacoes_alarme_excesso")?.imutavel).toBe(true);
  });

  it("S-03 (verificação independente): isenção só por auth.role(), alarme legível só pelo administrador, evento herda o link", () => {
    const corpo = funcoes.get("indicacoes_pedido_limitar")?.corpo ?? "";
    // A isenção deriva do JWT validado pelo PostgREST; nunca de papel escolhido pelo chamador nem isenção para todos.
    expect(corpo).toMatch(/if \(select auth\.role\(\)\) = 'service_role' then\s+return new;/);
    expect(corpo).not.toMatch(/\bif true\b/i);
    // Ordem de aquisição dos locks: link antes de destino (evita deadlock entre as duas travas).
    expect(corpo.indexOf("indicacoes_link:")).toBeGreaterThan(-1);
    expect(corpo.indexOf("indicacoes_link:")).toBeLessThan(corpo.indexOf("indicacoes_destino:"));
    // O alarme é gravado com ON CONFLICT DO NOTHING (um registro por tipo, alvo e hora): sem crescimento por pedido.
    const insercoes = corpo.match(/insert into public\.indicacoes_alarme_excesso/g)?.length ?? 0;
    const conflitos = corpo.match(/ do nothing/g)?.length ?? 0;
    expect(insercoes).toBe(3);
    expect(conflitos).toBe(3);
    // Alarme sem dado pessoal: só tipo, janela, alvo (id), quantidade e limite.
    const tab =
      tudoMigracoes.match(
        /create table public\.indicacoes_alarme_excesso \(([\s\S]*?)\n\);/i,
      )?.[1] ?? "";
    expect(tab).not.toMatch(/nome|whatsapp|email|mensagem|solicitante|ip\b|origem/i);
    // Política de leitura: somente administrador; as três outras negam.
    expect(tudoMigracoes).toMatch(
      /create policy indicacoes_alarme_excesso_select_admin on public\.indicacoes_alarme_excesso\s+for select to authenticated using \(\(select public\.administracao_eh_admin\(\)\)\);/i,
    );
    for (const op of ["insert", "update", "delete"]) {
      expect(tudoMigracoes).toMatch(
        new RegExp(
          `create policy indicacoes_alarme_excesso_${op}_negado on public\\.indicacoes_alarme_excesso\\s+for ${op} to authenticated (?:using|with check) \\(false\\)`,
          "i",
        ),
      );
    }
    // O evento contato_enviado herda o link já tratado do pedido (IM-030): gatilho existe e lê o pedido.
    expect(tudoMigracoes).toMatch(
      /create trigger indicacoes_evento_link_do_pedido before insert on public\.indicacoes_evento/i,
    );
    expect(funcoes.get("indicacoes_evento_link_do_pedido")?.corpo).toMatch(
      /new\.link_id := \(select p\.link_id from public\.indicacoes_pedido_contato p where p\.id = new\.pedido_id\)/,
    );
    // O gatilho de imutabilidade do alarme existe de fato (não só a política).
    expect(tudoMigracoes).toMatch(
      /create trigger indicacoes_alarme_excesso_imutavel\s+before update or delete on public\.indicacoes_alarme_excesso/i,
    );
  });

  it("a simulação enxerga TODA função, tabela e visão criada (sem formatação que a esconda da varredura)", () => {
    // Falso-verde achado na verificação: 'create function\n public.x' (quebra de linha), 'create  table' (espaço duplo)
    // e funções SQL com 'begin atomic' (sem $$) não eram reconhecidas pela simulação e escapavam das checagens de
    // RLS, REVOKE e search_path. Aqui a forma é travada: uma migração fora do padrão falha em vez de passar calada.
    const fora: string[] = [];
    for (const { n, t } of migracoes) {
      for (const m of t.matchAll(/create\s+(?:or\s+replace\s+)?function\s+[^\s(]+/gi)) {
        if (!/^create (?:or replace )?function public\.\w+$/.test(m[0])) fora.push(`${n}: ${m[0]}`);
      }
      for (const m of t.matchAll(
        /create\s+(?:or\s+replace\s+)?(?:temp\s+|temporary\s+|unlogged\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?[^\s(]+/gi,
      )) {
        if (
          !/^create (?:or replace )?(?:table|view) (?:if not exists )?(?:public\.)?[\w"]+$/.test(
            m[0],
          ) &&
          !/^create (?:or replace )?(?:table|view) storage\./.test(m[0])
        ) {
          fora.push(`${n}: ${m[0]}`);
        }
      }
      if (/begin\s+atomic/i.test(t))
        fora.push(`${n}: função com 'begin atomic' (a varredura só lê corpo entre $$)`);
    }
    expect(fora).toEqual([]);
    // Cada função criada com a forma esperada foi registrada.
    const criadas = new Set<string>();
    for (const { t } of migracoes) {
      for (const m of t.matchAll(/create (?:or replace )?function public\.(\w+)\(/g))
        criadas.add(m[1]!);
    }
    const dropadas = new Set<string>();
    for (const { t } of migracoes) {
      for (const m of t.matchAll(/drop function (?:if exists )?public\.(\w+)\(/g))
        dropadas.add(m[1]!);
    }
    const naoVistas = [...criadas].filter((f) => !funcoes.has(f) && !dropadas.has(f));
    expect(naoVistas).toEqual([]);
  });

  it("denúncia: limite por pessoa, global e por alvo, e campo-armadilha, dentro da função", () => {
    const corpo = funcoes.get("administracao_denunciar")?.corpo ?? "";
    for (const chave of [
      "denuncia_limite_por_pessoa",
      "denuncia_limite_global",
      "denuncia_limite_por_alvo_dia",
      "p_site",
    ]) {
      expect(corpo).toContain(chave);
    }
  });
});

describe("revisão de segurança · papéis conhecidos", () => {
  it("o simulador de ACL só conhece os papéis esperados", () => {
    for (const f of funcoes.values()) {
      for (const p of Object.keys(f.acl)) expect(PAPEIS as readonly string[]).toContain(p);
    }
  });
});
