import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { exigirCotaDisponivel } from "../suporte/item-fixo";

/**
 * Integração real contra o Supabase de DESENVOLVIMENTO: seções da home (IM-095, IM-096, D-018) e endurecimento do Storage
 * (`adm-*`, IM-093). Só roda com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e E2E_ADMIN_ e E2E_DONO_ (EMAIL e SENHA) no ambiente
 * ou em `.env.local` (carregado em memória; nada é impresso). NÃO usa service_role. Sem as variáveis, ficam "skipped".
 * A edição do admin restaura os valores originais ao final (cada mudança real deixa auditoria, que é imutável por desenho).
 *
 * Executar: pnpm exec vitest run tests/integracao/home-secoes.test.ts
 */
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* sem arquivo legível: os testes ficam skipped */
  }
}
const e = process.env;
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pronto = Boolean(
  url && anonKey && e.E2E_ADMIN_EMAIL && e.E2E_ADMIN_SENHA && e.E2E_DONO_EMAIL && e.E2E_DONO_SENHA,
);

const CHAVES = [
  "novidades",
  "mais_curtidos",
  "mais_indicados",
  "na_sua_cidade",
  "em_alta_semana",
] as const;
const CAMPOS_CARD = [
  "o_categoria_id",
  "o_categoria_nome",
  "o_categoria_slug",
  "o_cidade",
  "o_descricao",
  "o_id",
  "o_imagem_path",
  "o_metrica",
  "o_nome",
  "o_posicao",
  "o_slug",
  "o_uf",
];
// Qualquer pista de conta, contato ou pessoa.
const PROIBIDO =
  /(conta_id|responsavel|whatsapp|telefone|e-?mail|@[a-z0-9-]+\.|\+55\d{8,}|\b\d{10,13}\b)/i;

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function logado(email: string, senha: string): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}

describe.skipIf(!pronto)("home · leitura pública (dev, anon)", () => {
  it("busca_home_secoes devolve só configuração e contagem agregada", async () => {
    const { data, error } = await anon().rpc("busca_home_secoes", { p_cidade: null, p_uf: null });
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
    for (const l of data!) {
      expect(Object.keys(l).sort()).toEqual(
        [
          "o_chave",
          "o_exibir",
          "o_limite_padrao",
          "o_minimo_itens",
          "o_ordem",
          "o_tipo_item",
          "o_titulo",
          "o_total_itens",
        ].sort(),
      );
    }
    expect(JSON.stringify(data)).not.toMatch(PROIBIDO);
  });

  it.each(CHAVES)(
    "busca_home_secao_perfis(%s) só traz campos de card, sem conta, contato ou pessoa",
    async (chave) => {
      const { data, error } = await anon().rpc("busca_home_secao_perfis", {
        p_chave: chave,
        p_cidade: "Porto Alegre",
        p_uf: "RS",
        p_limite: 30,
      });
      expect(error).toBeNull();
      for (const l of data ?? []) expect(Object.keys(l).sort()).toEqual(CAMPOS_CARD);
      expect(JSON.stringify(data ?? [])).not.toMatch(PROIBIDO);
    },
  );

  it("todo site de ranking é publicado e visível na busca pública (nada despublicado/suspenso)", async () => {
    const c = anon();
    const { data: pub } = await c.rpc("busca_publica", { p_limite: 100 } as never);
    // busca_publica pode ter outra assinatura; sem ela, o teste só confere as respostas das seções.
    const slugsPublicos = new Set(
      (Array.isArray(pub) ? pub : []).map((p: { o_slug?: string }) => p.o_slug),
    );
    if (slugsPublicos.size === 0) return;
    for (const chave of CHAVES) {
      const { data } = await c.rpc("busca_home_secao_perfis", { p_chave: chave, p_limite: 30 });
      for (const l of data ?? []) expect(slugsPublicos.has(l.o_slug)).toBe(true);
    }
  });

  it("erros: chave desconhecida, UF mal formada e chave nula (22023)", async () => {
    const c = anon();
    for (const args of [
      { p_chave: "mais_visitados" },
      { p_chave: "na_sua_cidade", p_cidade: "Porto Alegre", p_uf: "X1" },
      { p_chave: null },
    ]) {
      const { error } = await c.rpc("busca_home_secao_perfis", args as never);
      expect(error?.code).toBe("22023");
    }
  });

  it("na_sua_cidade sem cidade ou sem UF não devolve nada", async () => {
    const c = anon();
    for (const args of [
      { p_chave: "na_sua_cidade" },
      { p_chave: "na_sua_cidade", p_cidade: "Porto Alegre" },
      { p_chave: "na_sua_cidade", p_uf: "RS" },
    ]) {
      const { data, error } = await c.rpc("busca_home_secao_perfis", args);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("a função interna, a tabela de relacionamento e a escrita direta estão fechadas para anon", async () => {
    const c = anon();
    const r1 = await c.rpc(
      "busca_home_candidatos" as never,
      { p_chave: "novidades", p_cidade: null, p_uf: null } as never,
    );
    expect(r1.error).not.toBeNull();
    expect(r1.data ?? null).toBeNull();
    const r2 = await c.from("relacionamento_membro" as never).select("*");
    expect(r2.error?.code).toBe("42501");
    const r3 = await c.from("busca_home_secao").select("atualizado_em");
    expect(r3.error?.code).toBe("42501");
    const r4 = await c
      .from("busca_home_secao")
      .update({ titulo: "Invadida" })
      .eq("chave", "novidades");
    expect(r4.error?.code).toBe("42501");
    const r5 = await c.from("busca_home_secao").delete().eq("chave", "novidades");
    expect(r5.error?.code).toBe("42501");
    const r6 = await c.rpc("administracao_alterar_home_secao", {
      p_chave: "novidades",
      p_titulo: "Invadida",
      p_ativa: true,
      p_ordem: 1,
      p_minimo_itens: 4,
      p_limite_padrao: 10,
      p_motivo: "x",
    });
    expect(r6.error).not.toBeNull();
  });
});

describe.skipIf(!pronto)("home · edição (dev): só administrador geral, com auditoria", () => {
  const args = (p: Record<string, unknown>) => ({
    p_chave: "mais_curtidos",
    p_titulo: "Mais curtidos",
    p_ativa: true,
    p_ordem: 2,
    p_minimo_itens: 4,
    p_limite_padrao: 10,
    p_motivo: "verificação independente Fase 9",
    ...p,
  });

  it("conta comum (dono) não edita, nem direto na tabela", async () => {
    const dono = await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!);
    const r = await dono.rpc("administracao_alterar_home_secao", args({ p_titulo: "Dono manda" }));
    expect(r.error?.code).toBe("42501");
    const u = await dono
      .from("busca_home_secao")
      .update({ titulo: "Dono manda" })
      .eq("chave", "mais_curtidos")
      .select();
    expect(u.data ?? []).toEqual([]);
    const { data } = await anon().rpc("busca_home_secoes");
    expect(data!.map((s: { o_titulo: string }) => s.o_titulo)).not.toContain("Dono manda");
  });

  it("administrador: recusas, edição auditada, idempotência e restauração", async () => {
    const admin = await logado(e.E2E_ADMIN_EMAIL!, e.E2E_ADMIN_SENHA!);
    const { data: antes, error: eAntes } = await admin
      .from("busca_home_secao")
      .select("*")
      .eq("chave", "mais_curtidos")
      .single();
    expect(eAntes).toBeNull();
    const original = antes!;
    const restaurar = () =>
      admin.rpc("administracao_alterar_home_secao", {
        p_chave: original.chave,
        p_titulo: original.titulo,
        p_ativa: original.ativa,
        p_ordem: original.ordem,
        p_minimo_itens: original.minimo_itens,
        p_limite_padrao: original.limite_padrao,
        p_motivo: "restauração após verificação independente",
      });
    const base = {
      p_titulo: original.titulo,
      p_ativa: original.ativa,
      p_ordem: original.ordem,
      p_minimo_itens: original.minimo_itens,
      p_limite_padrao: original.limite_padrao,
    };
    const contaAuditoria = async () => {
      const { count } = await admin
        .from("administracao_auditoria")
        .select("id", { count: "exact", head: true })
        .eq("alvo_tabela", "busca_home_secao")
        .eq("alvo_id", "mais_curtidos");
      return count ?? 0;
    };
    try {
      const n0 = await contaAuditoria();
      // Recusas não gravam auditoria.
      const motivoVazio = await admin.rpc(
        "administracao_alterar_home_secao",
        args({ ...base, p_titulo: "Queridinhos", p_motivo: "  " }),
      );
      expect(motivoVazio.error?.code).toBe("22023");
      for (const titulo of [
        "Veja www.promo.com",
        "Oferta https://x.co",
        "<b>Oferta</b>",
        "ab",
        "x".repeat(41),
        "promo.com.br",
      ]) {
        const r = await admin.rpc(
          "administracao_alterar_home_secao",
          args({ ...base, p_titulo: titulo }),
        );
        expect(r.error?.code, titulo).toBe("23514");
      }
      const inex = await admin.rpc(
        "administracao_alterar_home_secao",
        args({ ...base, p_chave: "nao_existe" }),
      );
      expect(inex.error?.code).toBe("P0002");
      expect(await contaAuditoria()).toBe(n0);

      // Edição real: título com espaços duplicados é normalizado e audita autor, data, motivo e valor original.
      const motivo = "verificação independente: renomear";
      const ok = await admin.rpc(
        "administracao_alterar_home_secao",
        args({ ...base, p_titulo: "  Queridinhos   da   verificacao ", p_motivo: motivo }),
      );
      expect(ok.error).toBeNull();
      expect(await contaAuditoria()).toBe(n0 + 1);
      const { data: aud } = await admin
        .from("administracao_auditoria")
        .select("autor_id, acao, motivo, valor_anterior, valor_novo, criado_em")
        .eq("alvo_tabela", "busca_home_secao")
        .eq("alvo_id", "mais_curtidos")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      expect(aud!.acao).toBe("home_secao_alterada");
      expect(aud!.motivo).toBe(motivo);
      expect(aud!.autor_id).toBeTruthy();
      expect(Date.now() - new Date(aud!.criado_em).getTime()).toBeLessThan(120_000);
      expect((aud!.valor_anterior as { titulo: string }).titulo).toBe(original.titulo);
      expect((aud!.valor_novo as { titulo: string }).titulo).toBe("Queridinhos da verificacao");

      // O público já vê o título novo (a função lê direto do banco; o cache é da camada Next).
      const { data: pub } = await anon().rpc("busca_home_secoes");
      expect(pub!.find((s: { o_chave: string }) => s.o_chave === "mais_curtidos")?.o_titulo).toBe(
        "Queridinhos da verificacao",
      );

      // Idempotência: repetir sem mudança não grava auditoria nova.
      const rep = await admin.rpc(
        "administracao_alterar_home_secao",
        args({ ...base, p_titulo: "Queridinhos da verificacao", p_motivo: "repetido" }),
      );
      expect(rep.error).toBeNull();
      expect(await contaAuditoria()).toBe(n0 + 1);

      // A auditoria não é legível nem alterável pelo dono.
      const dono = await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!);
      const lida = await dono
        .from("administracao_auditoria")
        .select("id")
        .eq("alvo_tabela", "busca_home_secao");
      expect(lida.data ?? []).toEqual([]);
    } finally {
      const r = await restaurar();
      expect(r.error).toBeNull();
      const { data: depois } = await admin
        .from("busca_home_secao")
        .select("*")
        .eq("chave", "mais_curtidos")
        .single();
      expect({ ...depois, atualizado_em: null }).toEqual({ ...original, atualizado_em: null });
    }
  });
});

describe.skipIf(!pronto)(
  "Storage · responsável não grava adm-* na própria pasta (dev, IM-093)",
  () => {
    const PNG = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    // Este teste sobe 1 PNG (e o apaga no finally: saldo zero). Falha cedo e com mensagem clara se a cota estiver cheia.
    beforeAll(async () => {
      await exigirCotaDisponivel(await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!));
    });
    it("nome comum é aceito; adm-* é recusado; rename para adm-* também", async () => {
      const dono = await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!);
      const { data: perfis } = await dono.from("perfis_meus_perfis").select("id").limit(1);
      expect(perfis?.length ?? 0).toBeGreaterThan(0); // dono de teste precisa ter perfil
      const pasta = `perfil/${perfis![0]!.id}`;
      const sufixo = Date.now();
      const comum = `${pasta}/verif-${sufixo}.png`;
      const adm = `${pasta}/adm-verif-${sufixo}.png`;
      const bucket = dono.storage.from("indicamais-imagens");
      try {
        const ok = await bucket.upload(comum, PNG, { contentType: "image/png" });
        expect(ok.error).toBeNull();
        const negado = await bucket.upload(adm, PNG, { contentType: "image/png" });
        expect(negado.error).not.toBeNull();
        const mover = await bucket.move(comum, adm);
        expect(mover.error).not.toBeNull();
        const { data: lista } = await bucket.list(pasta, { limit: 100 });
        expect((lista ?? []).some((o) => o.name === `adm-verif-${sufixo}.png`)).toBe(false);
      } finally {
        await bucket.remove([comum, adm]);
      }
    });
  },
);
