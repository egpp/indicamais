import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da Fase 8 (IM-091, IM-093, IM-012, IM-079, IM-080, IM-086, D-016): estilo da página e banner rotativo.
 * Complementa o pgTAP (banco real, no CI): aqui só se confere o TEXTO das migrações.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const semComentario = (t: string) => t.replace(/--.*$/gm, "");
const ler = (nome: RegExp) =>
  semComentario(
    readdirSync(DIR)
      .filter((n) => nome.test(n))
      .map((n) => readFileSync(join(DIR, n), "utf8"))
      .join("\n"),
  );

const estilo = ler(/perfis_estilo_pagina/);
const banner = ler(/perfis_banner/);
const avisoBanner = ler(/notificacoes_banner_aceite/);

const corpo = (texto: string, nome: string) =>
  [
    ...texto.matchAll(
      new RegExp(`create (?:or replace )?function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "gi"),
    ),
  ]
    .map((m) => m[0])
    .at(-1) ?? "";

const IDS = [
  "minimalista",
  "saude_bem_estar",
  "beleza_estetica",
  "gastronomia",
  "cafe_padaria",
  "construcao_reformas",
  "automotivo",
  "juridico_contabil",
  "educacao_cursos",
  "pet",
  "moda_lojas",
  "fitness_esportes",
  "imobiliario",
  "tecnologia_assistencia",
  "casa_decoracao",
  "eventos_fotografia",
  "servicos_rapidos",
  "agro_campo",
  "turismo_hospedagem",
  "premium",
];
const HABILITADOS = [
  "minimalista",
  "gastronomia",
  "saude_bem_estar",
  "beleza_estetica",
  "construcao_reformas",
];

describe("Fase 8: estilo da página (IM-091, IM-094)", () => {
  const carga = estilo.match(/insert into public\.perfis_estilo_pagina[\s\S]*?;/i)![0];

  it("os 20 ids fixos estão na restrição e na carga inicial", () => {
    for (const id of IDS) expect(estilo).toContain(`'${id}'`);
    expect([...carga.matchAll(/\('(\w+)', '[^']+', \d+, (?:true|false)\)/g)]).toHaveLength(20);
  });

  it("só os 5 estilos da primeira entrega nascem habilitados", () => {
    const ligados = [...carga.matchAll(/\('(\w+)', '[^']+', \d+, true\)/g)].map((m) => m[1]!);
    expect([...ligados].sort()).toEqual([...HABILITADOS].sort());
  });

  it("o padrão é minimalista e o estilo NÃO é versionado (fora do fluxo de revisão)", () => {
    expect(estilo).toMatch(/add column estilo_pagina text not null default 'minimalista'/i);
    expect(estilo).not.toMatch(/alter table public\.perfis_perfil_versao[^;]*estilo/i);
    expect(estilo).not.toMatch(/grant update \([^)]*estilo_pagina/i);
  });

  it("a escolha é só por RPC auditada, restrita ao próprio perfil e a conta com acesso", () => {
    const c = corpo(estilo, "perfis_definir_estilo");
    expect(c).toMatch(/security definer set search_path = ''/);
    expect(c).toMatch(/responsavel_id = v_uid/);
    expect(c).toMatch(/contas_acesso_permitido/);
    expect(c).toMatch(/e\.habilitado/);
    expect(c).toMatch(/insert into public\.administracao_auditoria/);
    expect(c).toMatch(/valor_anterior/);
  });

  it("liberar estilo é do administrador geral, com motivo e auditoria", () => {
    const c = corpo(estilo, "perfis_admin_definir_estilo_habilitado");
    expect(c).toMatch(/administracao_exigir_admin\(\)/);
    expect(c).toMatch(/motivo obrigatório/);
    expect(c).toMatch(/insert into public\.administracao_auditoria/);
  });

  it("a visão pública expõe o estilo e continua sem dado privado", () => {
    const v = estilo.match(/create or replace view public\.perfis_perfil_publico[\s\S]*?;/i)![0];
    expect(v).toMatch(/security_invoker = true/);
    expect(v).toMatch(/estilo_pagina/);
    expect(v).not.toMatch(/responsavel_id|conta_id|whatsapp|autor_id|\bemail\b/i);
  });

  it("nenhuma RPC de estilo é executável por anon", () => {
    expect(estilo).not.toMatch(
      /grant execute on function public\.perfis_\w+\([^)]*\) to[^;]*\banon\b/i,
    );
  });
});

describe("Fase 8: banner rotativo (IM-093, IM-012)", () => {
  it("nenhum privilégio de escrita ao cliente na tabela de banners", () => {
    expect(banner).toMatch(/revoke all on public\.perfis_banner from anon, authenticated/i);
    expect(banner).not.toMatch(/grant (insert|update|delete|all)[^;]*on public\.perfis_banner to/i);
  });

  it("o autor administrador nunca entra em nenhuma concessão de leitura", () => {
    const grants = [...banner.matchAll(/grant select \(([^)]*)\)\s+on public\.perfis_banner/gi)];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g[1]).not.toMatch(/autor_admin_id/);
  });

  it("não há link externo: destino só por seção e sem coluna de URL", () => {
    expect(banner).toMatch(
      /destino_secao in \(\s*'inicio', 'sobre', 'produtos_servicos', 'beneficios', 'localizacao', 'contato'\)/,
    );
    const tabela = banner.match(/create table public\.perfis_banner \([\s\S]*?\n\);/i)![0];
    expect(tabela).not.toMatch(/\b(url|link|href|site)\b/i);
  });

  it("texto alternativo obrigatório, caminho opaco na pasta do perfil e tipo de arquivo", () => {
    expect(banner).toMatch(/texto_alternativo text not null/);
    expect(banner).toMatch(/char_length\(btrim\(texto_alternativo\)\) between 1 and 200/);
    expect(banner).toMatch(/'\^perfil\/' \|\| perfil_id::text/);
    expect(banner).toMatch(/jpe\?g\|png\|webp/);
  });

  it("limite de 6 banners no gatilho e na RPC", () => {
    expect(corpo(banner, "perfis_banner_proteger")).toMatch(/>= 6/);
    expect(corpo(banner, "perfis_gravar_banners")).toMatch(/> 6/);
  });

  it("banner de administrador nasce aguardando aceite e só o responsável aceita", () => {
    expect(corpo(banner, "perfis_banner_proteger")).toMatch(/nasce aguardando aceite/);
    const add = corpo(banner, "perfis_admin_adicionar_banner");
    expect(add).toMatch(/administracao_exigir_permissao\('aprovar'\)/);
    expect(add).toMatch(/'aguardando_aceite'/);
    expect(add).not.toMatch(/'aceito'/);
    const resp = corpo(banner, "perfis_responder_banner");
    expect(resp).toMatch(/responsavel_id = v_uid/);
    expect(resp).toMatch(/motivo obrigatório na recusa/);
  });

  it("toda RPC administrativa ou de decisão grava auditoria na mesma transação", () => {
    for (const nome of [
      "perfis_admin_adicionar_banner",
      "perfis_admin_remover_banner",
      "perfis_responder_banner",
      "perfis_definir_banner_ativo",
    ]) {
      const c = corpo(banner, nome);
      expect(c, nome).toMatch(/insert into public\.administracao_auditoria/);
      expect(c, nome).toMatch(/security definer set search_path = ''/);
    }
    expect(corpo(banner, "perfis_admin_adicionar_banner")).toMatch(/motivo obrigatório/);
    expect(corpo(banner, "perfis_admin_remover_banner")).toMatch(/motivo obrigatório/);
  });

  it("RPCs do responsável recusam conta sem acesso (suspensa)", () => {
    for (const nome of [
      "perfis_gravar_banners",
      "perfis_responder_banner",
      "perfis_definir_banner_ativo",
    ]) {
      expect(corpo(banner, nome), nome).toMatch(/contas_acesso_permitido/);
    }
  });

  it("leitura pública: só ativo, de perfil disponível, aprovado ou aceito (despublicar e suspender ocultam)", () => {
    const v = banner.match(/create view public\.perfis_banner_publico[\s\S]*?;/i)![0];
    expect(v).toMatch(/security_invoker = true/);
    expect(v).toMatch(/b\.ativo/);
    expect(v).toMatch(/perfis_perfil_disponivel\(b\.perfil_id\)/);
    expect(v).toMatch(/versao_aprovada_id = b\.versao_id/);
    expect(v).toMatch(/b\.situacao = 'aceito'/);
    expect(v).toMatch(/order by b\.ordem/);
    expect(v).not.toMatch(/responsavel_id|conta_id|whatsapp|autor_id|autor_admin_id|\bemail\b/i);
    const pol = banner.match(/create policy perfis_banner_select_publico[\s\S]*?;/i)![0];
    expect(pol).toMatch(/perfis_perfil_disponivel\(perfil_id\)/);
  });

  it("as visões novas são security_invoker (nenhuma visão definer nova)", () => {
    const visoes = [
      ...banner.matchAll(/create view public\.(\w+)(\s+with \(security_invoker = true\))? as/gi),
    ];
    expect(visoes.length).toBe(3);
    for (const v of visoes) expect(v[2], v[1]).toBeTruthy();
  });

  it("imagens: envio do aprovador e funções de storage atualizadas com os banners", () => {
    expect(banner).toMatch(
      /create policy catalogo_imagens_insert_aprovador_banner on storage\.objects/,
    );
    expect(corpo(banner, "perfis_pasta_para_aprovador")).toMatch(
      /administracao_permitido\('aprovar'\)/,
    );
    expect(corpo(banner, "catalogo_imagem_publica")).toMatch(/perfis_banner_publico/);
    expect(corpo(banner, "catalogo_imagem_em_uso")).toMatch(/aguardando_aceite/);
  });

  it("nenhuma função da fase concede execute a anon e as rotinas internas não vão ao cliente", () => {
    expect(banner).not.toMatch(
      /grant execute on function public\.perfis_\w+\([^)]*\) to[^;]*\banon\b/i,
    );
    for (const n of [
      "perfis_banner_total",
      "perfis_banner_copiar",
      "perfis_banner_garantir_rascunho",
      "perfis_banner_herdar",
    ]) {
      expect(banner).toMatch(
        new RegExp(
          `revoke all on function public\\.${n}\\([^)]*\\) from public, anon, authenticated`,
          "i",
        ),
      );
    }
  });
});

describe("migração: aviso de banner aguardando aceite no sino (IM-047, IM-052, IM-053, IM-093, D-016)", () => {
  it("é migração nova, sem tabela de aviso (IM-053) e com a origem no check de leitura", () => {
    expect(avisoBanner).not.toMatch(/create table/i);
    expect(avisoBanner).toMatch(
      /check \(origem in \('contato_valido', 'indicacao_valida', 'curtida', 'revisao', 'banner_aceite'\)\)/,
    );
    expect(corpo(avisoBanner, "notificacoes_marcar_lida")).toMatch(/'revisao', 'banner_aceite'\)/);
    expect(corpo(avisoBanner, "notificacoes_marcar_lida")).toMatch(/security definer/);
  });

  it("a visão lê só banner de administrador aguardando aceite do dono, sem autor e sem conta", () => {
    const v = avisoBanner.slice(avisoBanner.indexOf("create or replace view"));
    const ramo = v.slice(v.indexOf("'banner_aceite'::text"), v.indexOf(") x"));
    expect(ramo).toMatch(/b\.situacao = 'aguardando_aceite'/);
    expect(ramo).toMatch(/pf\.responsavel_id = \(select auth\.uid\(\)\)/);
    expect(ramo).toMatch(/null::text,\s+b\.criado_em/);
    expect(ramo).not.toMatch(/autor_admin_id|nome_exibicao|email|conta_id/i);
    expect(v).not.toMatch(/security_invoker/);
    expect(v).toMatch(/revoke all on public\.notificacoes_meus_avisos from anon, authenticated;/);
    expect(v).toMatch(/grant select on public\.notificacoes_meus_avisos to authenticated;/);
  });

  it("nenhuma função concede execute a anon", () => {
    expect(avisoBanner).not.toMatch(/grant execute[^;]*\banon\b/i);
    expect(avisoBanner).toMatch(
      /revoke all on function public\.notificacoes_marcar_lida\(text, uuid\) from public, anon;/,
    );
  });
});
