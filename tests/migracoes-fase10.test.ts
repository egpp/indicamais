import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática das migrações da Fase 10 (módulo Loja: IM-097, IM-098, IM-099, D-020, IM-086).
 * Complementa o pgTAP (supabase/tests/database/loja_*.test.sql), que roda no CI com banco real.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const ler = (n: string) =>
  readFileSync(join(DIR, n), "utf8").replace(/--.*$/gm, "").replace(/\r\n/g, "\n");

const liberacao = ler("20261103130000_loja_liberacao.sql");
const itens = ler("20261103140000_loja_itens_imovel.sql");
const leitura = ler("20261103150000_loja_leitura_publica.sql");

describe("Loja: liberação por perfil (IM-099, D-020)", () => {
  it("tabela com RLS forçada, política por operação e sem privilégio de escrita", () => {
    expect(liberacao).toMatch(/alter table public\.loja_liberacao enable row level security/);
    expect(liberacao).toMatch(/alter table public\.loja_liberacao force row level security/);
    expect(liberacao).toMatch(/revoke all on public\.loja_liberacao from anon, authenticated/);
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(liberacao).toMatch(
        new RegExp(`create policy \\w+ on public\\.loja_liberacao\\s+for ${op}\\b`),
      );
    }
    expect(liberacao).not.toMatch(/grant (insert|update|delete)[^;]*loja_liberacao/i);
    expect(liberacao).not.toMatch(/conta_id|responsavel_id/);
  });

  it("padrão desligada", () => {
    expect(liberacao).toMatch(/liberada boolean not null default false/);
  });

  it("só o administrador geral libera, com motivo obrigatório e auditoria na mesma função", () => {
    const m = liberacao.match(/create function public\.loja_definir_liberacao[\s\S]*?\$\$;/)![0];
    expect(m).toMatch(/security definer set search_path = ''/);
    expect(m).toMatch(/public\.administracao_exigir_admin\(\)/);
    expect(m).toMatch(/motivo obrigatório/);
    expect(m).toMatch(/insert into public\.administracao_auditoria/);
    expect(m).toMatch(/valor_anterior/);
    expect(liberacao).toMatch(
      /revoke all on function public\.loja_definir_liberacao\(uuid, boolean, text\) from public, anon;/,
    );
    expect(liberacao).not.toMatch(
      /grant execute on function public\.loja_definir_liberacao[^;]*anon/,
    );
  });

  it("loja_ativa é interna: sem execute para cliente", () => {
    expect(liberacao).toMatch(
      /revoke all on function public\.loja_ativa\(uuid\) from public, anon, authenticated;/,
    );
    expect(liberacao).not.toMatch(/grant execute on function public\.loja_ativa/);
  });
});

describe("Loja: itens e imóveis (IM-098, IM-021, IM-022)", () => {
  it("o imposto pela Loja vive em gatilhos do banco (item e versão)", () => {
    expect(itens).toMatch(
      /create trigger catalogo_item_validar_loja before insert on public\.catalogo_item/,
    );
    expect(itens).toMatch(
      /create trigger catalogo_item_versao_validar_loja before insert or update on public\.catalogo_item_versao/,
    );
    expect(itens).toMatch(/public\.loja_ativa\(/);
  });

  it("não existe coluna de endereço exato nem coordenada do imóvel", () => {
    const cols = itens.match(/alter table public\.catalogo_item_versao\s+add column[\s\S]*?;/)![0];
    expect(cols).not.toMatch(/endereco|latitude|longitude|logradouro|numero|cep/i);
  });

  it("lista fechada de finalidade e de tipo de imóvel", () => {
    expect(itens).toMatch(/finalidade in \('venda', 'aluguel'\)/);
    expect(itens).toMatch(
      /imovel_tipo in \(\s*'casa', 'apartamento', 'terreno', 'comercial', 'rural', 'outro'\)/,
    );
  });

  it("não altera aprovação nem publicação (edição não republica)", () => {
    expect(itens).not.toMatch(/publicado\s*=\s*true/);
    expect(leitura).not.toMatch(/publicado\s*=\s*true/);
  });
});

describe("Loja: leitura pública (IM-029, IM-079)", () => {
  const visao = leitura.match(/create view public\.loja_item_publico[\s\S]*?;/)![0];

  it("visão pública é security_invoker, filtra Loja liberada e perfil disponível", () => {
    expect(visao).toMatch(/with \(security_invoker = true\)/);
    expect(visao).toMatch(/l\.liberada/);
    expect(visao).toMatch(/perfis_perfil_disponivel\(/);
    expect(visao).toMatch(/i\.publicado/);
    expect(visao).toMatch(/situacao = 'aprovada'/);
  });

  it("sem dado de conta, contato ou endereço exato", () => {
    expect(visao).not.toMatch(
      /conta_id|responsavel_id|whatsapp|autor_id|\bemail\b|telefone|endereco|latitude|longitude/i,
    );
  });

  it("imóvel fica fora do catálogo simples", () => {
    expect(leitura).toMatch(/i\.tipo <> 'imovel'/);
  });

  it("lista de imóveis: invoker, validação 22023 e execute para anon", () => {
    const f = leitura.match(/create function public\.loja_listar_imoveis[\s\S]*?\$\$;/)![0];
    expect(f).not.toMatch(/security definer/);
    expect(f).toMatch(/set search_path = ''/);
    expect(f).not.toMatch(/\bexecute\b/i); // sem SQL dinâmico
    expect(f.match(/22023/g)!.length).toBeGreaterThanOrEqual(5);
    expect(f).toMatch(/from public\.loja_item_publico/);
    expect(leitura).toMatch(
      /grant execute on function public\.loja_listar_imoveis\([^)]*\) to anon, authenticated;/,
    );
  });
});
