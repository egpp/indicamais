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
    expect(concedidas).toEqual(["catalogo_imagem_publica", "perfis_perfil_disponivel"]);
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
        "administracao_fila_pendencias",
        "administracao_meus_resultados",
        "catalogo_item_publico",
        "catalogo_meus_itens",
        "perfis_meus_perfis",
        "perfis_perfil_publico",
      ]),
    );
  });

  it("visões públicas são security_invoker e não trazem colunas privadas", () => {
    for (const nome of ["perfis_perfil_publico", "catalogo_item_publico"]) {
      const v = visoes.find((x) => x.nome === nome)!;
      expect(v.invoker, `${nome} deve ser security_invoker`).toBe(true);
      expect(v.corpo).not.toMatch(/responsavel_id|conta_id|whatsapp|autor_id|\bemail\b/i);
    }
  });

  it("visões sem security_invoker são só as conhecidas, sem acesso a anon e travadas por quem chama", () => {
    const definer = visoes
      .filter((v) => !v.invoker)
      .map((v) => v.nome)
      .sort();
    expect(definer).toEqual([
      "administracao_fila_pendencias",
      "administracao_meus_resultados",
      "catalogo_meus_itens",
      "perfis_meus_perfis",
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

  it("o resultado da revisão ao responsável não expõe o id do administrador nem e-mail", () => {
    const v = visoes.find((x) => x.nome === "administracao_meus_resultados")!;
    // autor_id só entra dentro do sha256; nunca como coluna da visão.
    const semHash = v.corpo.replace(/encode\(sha256\([\s\S]*?\), 'hex'\)/gi, "");
    expect(semHash).not.toMatch(/autor_id|decidida_por|email/i);
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
      .map(([, t]) => t!)
      .sort();
    expect(inteiras).toEqual([
      "catalogo_categoria",
      "catalogo_item_publico",
      "catalogo_item_versao",
      "perfis_perfil_publico",
      "perfis_perfil_versao",
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
