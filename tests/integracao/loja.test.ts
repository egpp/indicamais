import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gerarPng } from "../e2e/png";

/**
 * Integração real contra o Supabase de DESENVOLVIMENTO: Loja (IM-097, IM-098, IM-099, D-020), privacidade (IM-029),
 * versões/aprovação (IM-021, IM-022), disponibilidade (IM-079) e Storage. Só roda com NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY e E2E_ADMIN_/E2E_DONO_/E2E_INDICADOR_ (EMAIL e SENHA) no ambiente ou em `.env.local`
 * (carregado em memória; nada é impresso). NÃO usa service_role. Sem as variáveis, ficam "skipped".
 *
 * Efeitos no dev (por desenho imutáveis ou sem exclusão): cada liberar/retirar deixa auditoria; o item de imóvel criado
 * fica despublicado (não há exclusão de item); um arquivo PNG de teste fica na pasta do item. A Loja do perfil do dono
 * volta ao estado inicial ao final.
 *
 * Executar: pnpm exec vitest run tests/integracao/loja.test.ts
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
  url &&
  anonKey &&
  e.E2E_ADMIN_EMAIL &&
  e.E2E_ADMIN_SENHA &&
  e.E2E_DONO_EMAIL &&
  e.E2E_DONO_SENHA &&
  e.E2E_INDICADOR_EMAIL &&
  e.E2E_INDICADOR_SENHA,
);
const BUCKET = "indicamais-imagens";
const PROIBIDO =
  /(conta_id|responsavel|whatsapp|telefone|e-?mail|@[a-z0-9-]+\.|\+55\d{8,}|\b\d{10,13}\b)/i;
const UUID_FALSO = "99999999-9999-4999-8999-999999999999";

function novo(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function logado(email: string, senha: string): Promise<SupabaseClient> {
  const c = novo();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}
function codigo(erro: { code?: string } | null): string | undefined {
  return erro?.code;
}

describe.skipIf(!pronto)("Loja (integração dev, sem service_role)", () => {
  let anon: SupabaseClient;
  let dono: SupabaseClient;
  let admin: SupabaseClient;
  let indicador: SupabaseClient;
  let perfilId = "";
  let lojaInicial = false;
  let categoriaId = "";
  let itemId = "";
  let versaoId = "";
  const nome = `IT Loja ${Date.now().toString(36)}`;

  async function definir(liberada: boolean, motivo = "Teste de integração da Loja (verificador)") {
    return admin.rpc("loja_definir_liberacao", {
      p_perfil_id: perfilId,
      p_liberada: liberada,
      p_motivo: motivo,
    });
  }
  async function auditorias() {
    const { data, error } = await admin
      .from("administracao_auditoria")
      .select("autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo, criado_em")
      .eq("alvo_tabela", "loja_liberacao")
      .eq("alvo_id", perfilId)
      .order("criado_em", { ascending: true });
    expect(error).toBeNull();
    return data ?? [];
  }
  async function visivelParaAnon(): Promise<boolean> {
    const { data, error } = await anon.rpc("loja_listar_imoveis", { p_perfil_id: perfilId });
    expect(error).toBeNull();
    return (data ?? []).some((l: { o_id: string }) => l.o_id === itemId);
  }

  it("prepara sessões e identifica o perfil do dono", async () => {
    anon = novo();
    dono = await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!);
    admin = await logado(e.E2E_ADMIN_EMAIL!, e.E2E_ADMIN_SENHA!);
    indicador = await logado(e.E2E_INDICADOR_EMAIL!, e.E2E_INDICADOR_SENHA!);
    const { data, error } = await dono
      .from("perfis_meus_perfis")
      .select("id")
      .order("criado_em", { ascending: true });
    expect(error).toBeNull();
    perfilId = data![0]!.id as string;
    const lib = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", perfilId);
    lojaInicial = Boolean(lib.data?.[0]?.liberada);
    const cat = await anon.from("catalogo_categoria").select("id").limit(1);
    categoriaId = cat.data![0]!.id as string;
    expect(perfilId).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe("liberar e retirar: só administrador geral, com motivo e auditoria", () => {
    it("anon, dono e indicador não executam a liberação (42501) nem escrevem direto", async () => {
      for (const c of [anon, dono, indicador]) {
        const r = await c.rpc("loja_definir_liberacao", {
          p_perfil_id: perfilId,
          p_liberada: true,
          p_motivo: "tentativa indevida",
        });
        expect(codigo(r.error)).toBe("42501");
        const ins = await c.from("loja_liberacao").insert({ perfil_id: perfilId, liberada: true });
        expect(ins.error).not.toBeNull();
        const upd = await c
          .from("loja_liberacao")
          .update({ liberada: true })
          .eq("perfil_id", perfilId)
          .select();
        expect(upd.data ?? []).toHaveLength(0);
        const del = await c.from("loja_liberacao").delete().eq("perfil_id", perfilId).select();
        expect(del.data ?? []).toHaveLength(0);
      }
      const interna = await anon.rpc("loja_ativa", { p_perfil_id: perfilId });
      expect(interna.error).not.toBeNull();
      const interna2 = await dono.rpc("loja_ativa", { p_perfil_id: perfilId });
      expect(interna2.error).not.toBeNull();
    });

    it("administrador: motivo vazio/nulo, valor nulo e perfil inexistente são recusados", async () => {
      const semMotivo = await admin.rpc("loja_definir_liberacao", {
        p_perfil_id: perfilId,
        p_liberada: true,
        p_motivo: "   ",
      });
      expect(codigo(semMotivo.error)).toBe("22023");
      const nulo = await admin.rpc("loja_definir_liberacao", {
        p_perfil_id: perfilId,
        p_liberada: null as unknown as boolean,
        p_motivo: "x",
      });
      expect(codigo(nulo.error)).toBe("22023");
      const inex = await admin.rpc("loja_definir_liberacao", {
        p_perfil_id: UUID_FALSO,
        p_liberada: true,
        p_motivo: "x",
      });
      expect(codigo(inex.error)).toBe("P0002");
    });

    it("retira (estado limpo), libera e repete: auditoria completa, uma só por mudança (idempotente)", async () => {
      expect((await definir(false)).error).toBeNull();
      const antes = (await auditorias()).length;
      expect((await definir(false)).error).toBeNull();
      expect((await auditorias()).length).toBe(antes);

      expect((await definir(true, "  Liberar para o teste  ")).error).toBeNull();
      expect((await definir(true, "Liberar para o teste")).error).toBeNull();
      const lista = await auditorias();
      expect(lista.length).toBe(antes + 1);
      const ultima = lista[lista.length - 1]!;
      expect(ultima.acao).toBe("liberar_loja");
      expect(ultima.motivo).toBe("Liberar para o teste");
      expect(ultima.valor_anterior).toEqual({ liberada: false });
      expect(ultima.valor_novo).toEqual({ liberada: true });
      expect(ultima.autor_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(ultima.criado_em).toBeTruthy();

      // o dono não lê auditoria
      const doDono = await dono.from("administracao_auditoria").select("id").limit(1);
      expect(doDono.data ?? []).toHaveLength(0);
    });
  });

  describe("privacidade da leitura pública (anon)", () => {
    it("colunas de conta/contato/endereço não existem ou não são legíveis na visão e na versão", async () => {
      for (const col of [
        "conta_id",
        "responsavel_id",
        "telefone",
        "whatsapp_comercial_e164",
        "email",
        "endereco",
        "logradouro",
        "numero",
        "cep",
        "latitude",
        "longitude",
      ]) {
        const v = await anon.from("loja_item_publico").select(col).limit(1);
        expect(v.error, `loja_item_publico.${col}`).not.toBeNull();
        const t = await anon.from("catalogo_item_versao").select(col).limit(1);
        expect(t.error, `catalogo_item_versao.${col}`).not.toBeNull();
      }
    });

    it("loja_listar_imoveis devolve só os campos públicos e nada com cara de contato", async () => {
      const { data, error } = await anon.rpc("loja_listar_imoveis", {});
      expect(error).toBeNull();
      for (const linha of data ?? []) {
        const chaves = Object.keys(linha);
        expect(chaves.every((k) => k.startsWith("o_"))).toBe(true);
        expect(chaves).not.toContain("o_conta_id");
        expect(PROIBIDO.test(JSON.stringify({ ...linha, o_id: 0, o_perfil_id: 0 }))).toBe(false);
      }
    });
  });

  describe("filtros de loja_listar_imoveis", () => {
    it("valores inválidos dão 22023", async () => {
      const casos: Record<string, unknown>[] = [
        { p_finalidade: "troca" },
        { p_imovel_tipo: "castelo" },
        { p_uf: "RSS" },
        { p_uf: "1A" },
        { p_preco_min: -1 },
        { p_preco_max: -5 },
        { p_preco_min: 100, p_preco_max: 50 },
        { p_quartos_min: 51 },
        { p_quartos_min: -1 },
      ];
      for (const c of casos) {
        const r = await anon.rpc("loja_listar_imoveis", c);
        expect(codigo(r.error), JSON.stringify(c)).toBe("22023");
      }
    });

    it("texto malicioso é tratado como dado (sem erro, sem resultado) e limites são aplicados", async () => {
      for (const t of [
        "' OR 1=1 --",
        "%",
        "_",
        "\\",
        "'; drop table catalogo_item; --",
        "x".repeat(500),
      ]) {
        const r = await anon.rpc("loja_listar_imoveis", { p_cidade: t, p_bairro: t });
        expect(r.error, t.slice(0, 20)).toBeNull();
        expect(r.data ?? []).toHaveLength(0);
      }
      const grande = await anon.rpc("loja_listar_imoveis", {
        p_limite: 100000,
        p_pagina: 99999999,
      });
      expect(grande.error).toBeNull();
      expect((grande.data ?? []).length).toBeLessThanOrEqual(50);
      const zero = await anon.rpc("loja_listar_imoveis", { p_limite: 0, p_pagina: -3 });
      expect(zero.error).toBeNull();
      expect((zero.data ?? []).length).toBeLessThanOrEqual(1);
    });
  });

  describe("sem a Loja, o banco barra imóvel, campos extras e fotos adicionais (sessão do dono, chamada direta)", () => {
    it("retira a Loja e tenta criar imóvel, campo de imóvel e foto extra", async () => {
      expect((await definir(false, "Teste: Loja desligada")).error).toBeNull();

      const imovel = await dono.rpc("catalogo_criar_item", {
        p_tipo: "imovel",
        p_perfil_id: perfilId,
        p_nome: `${nome} sem loja`,
      });
      expect(codigo(imovel.error)).toBe("42501");

      const direto = await dono
        .from("catalogo_item")
        .insert({ tipo: "imovel", perfil_id: perfilId } as never);
      expect(direto.error).not.toBeNull();

      // item simples (produto) para testar os campos extras no rascunho
      const prod = await dono.rpc("catalogo_criar_item", {
        p_tipo: "produto",
        p_perfil_id: perfilId,
        p_nome: `${nome} produto`,
        p_descricao: "Produto de teste de integração (rascunho, nunca publicado)",
        p_categoria_principal_id: categoriaId,
      });
      expect(prod.error).toBeNull();
      const idProduto = (prod.data as { o_item_id: string }[])[0]!.o_item_id;
      expect(idProduto).toMatch(/^[0-9a-f-]{36}$/);
      const vs = await dono
        .from("catalogo_item_versao")
        .select("id")
        .eq("item_id", idProduto)
        .limit(1);
      const vId = vs.data![0]!.id as string;

      const comFoto = await dono
        .from("catalogo_item_versao")
        .update({ fotos_extras_paths: [`item/${idProduto}/a.png`] })
        .eq("id", vId);
      expect(codigo(comFoto.error)).toBe("42501");

      const comCampo = await dono.from("catalogo_item_versao").update({ quartos: 3 }).eq("id", vId);
      expect(codigo(comCampo.error)).toBe("23514");
      const comFinalidade = await dono
        .from("catalogo_item_versao")
        .update({ finalidade: "venda", bairro: "Centro" })
        .eq("id", vId);
      expect(codigo(comFinalidade.error)).toBe("23514");

      // nova versão direta (insert) também é barrada
      const ins = await dono.from("catalogo_item_versao").insert({
        item_id: idProduto,
        nome: "x",
        fotos_extras_paths: [`item/${idProduto}/a.png`],
      } as never);
      expect(ins.error).not.toBeNull();

      // outra conta (indicador) não cria imóvel no perfil alheio
      const alheio = await indicador.rpc("catalogo_criar_item", {
        p_tipo: "imovel",
        p_perfil_id: perfilId,
        p_nome: "invasor",
      });
      expect(alheio.error).not.toBeNull();
    });
  });

  describe("com a Loja: imóvel, regras do banco, aprovação, publicação, retirada e re-liberação", () => {
    it("libera, cria o imóvel (rascunho) e o banco recusa campos inválidos", async () => {
      expect((await definir(true)).error).toBeNull();
      const r = await dono.rpc("catalogo_criar_item", {
        p_tipo: "imovel",
        p_perfil_id: perfilId,
        p_nome: nome,
        p_descricao: "Imóvel de teste de integração. Rascunho, nunca fica publicado.",
        p_categoria_principal_id: categoriaId,
        p_preco_modo: "fixo",
        p_preco_centavos: 150000,
      });
      expect(r.error).toBeNull();
      itemId = (r.data as { o_item_id: string; o_versao_id: string }[])[0]!.o_item_id;
      expect(itemId).toMatch(/^[0-9a-f-]{36}$/);
      const v = await dono.from("catalogo_item_versao").select("id").eq("item_id", itemId);
      versaoId = v.data![0]!.id as string;

      const invalidos: Record<string, unknown>[] = [
        { imovel_tipo: "castelo" },
        { finalidade: "troca" },
        { area_m2: 0 },
        { area_m2: -3 },
        { quartos: 51 },
        { quartos: -1 },
        { banheiros: 51 },
        { vagas: 51 },
        { bairro: "x" },
        { condominio_centavos: -1 },
        { iptu_centavos: 100000001 },
        { fotos_extras_paths: Array.from({ length: 9 }, (_, i) => `item/${itemId}/f${i}.png`) },
        { fotos_extras_paths: [`item/${UUID_FALSO}/f.png`] },
        { fotos_extras_paths: [`perfil/${perfilId}/f.png`] },
        { fotos_extras_paths: [`item/${itemId}/../x.png`] },
        { fotos_extras_paths: [`item/${itemId}/a.png`, `item/${itemId}/a.png`] },
        { cidade: "Porto Alegre", uf: "R" },
      ];
      for (const c of invalidos) {
        const u = await dono.from("catalogo_item_versao").update(c).eq("id", versaoId);
        expect(u.error, JSON.stringify(c).slice(0, 60)).not.toBeNull();
        expect(["23514", "22023", "23502"]).toContain(codigo(u.error));
      }
    });

    it("imóvel incompleto não é enviado; preço mensal no aluguel e condomínio/IPTU 0 são aceitos", async () => {
      const incompleto = await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: versaoId });
      expect(codigo(incompleto.error)).toBe("23514");

      const ok = await dono
        .from("catalogo_item_versao")
        .update({
          imovel_tipo: "apartamento",
          finalidade: "aluguel",
          area_m2: 62.5,
          quartos: 2,
          banheiros: 1,
          vagas: 0,
          bairro: "Centro Histórico",
          cidade: "Porto Alegre",
          uf: "rs",
          condominio_centavos: 0,
          iptu_centavos: 0,
          aceita_financiamento: false,
        })
        .eq("id", versaoId)
        .select("uf, condominio_centavos, iptu_centavos, vagas, preco_modo")
        .single();
      expect(ok.error).toBeNull();
      expect(ok.data).toMatchObject({
        uf: "RS",
        condominio_centavos: 0,
        iptu_centavos: 0,
        vagas: 0,
      });
    });

    it("foto adicional na pasta do item: dono envia; pasta alheia é recusada", async () => {
      const png = gerarPng(40, 30, [20, 120, 90]);
      const propria = await dono.storage
        .from(BUCKET)
        .upload(`item/${itemId}/extra-1.png`, png, { contentType: "image/png", upsert: false });
      expect(propria.error).toBeNull();
      const alheia = await dono.storage
        .from(BUCKET)
        .upload(`item/${UUID_FALSO}/extra-1.png`, png, { contentType: "image/png" });
      expect(alheia.error).not.toBeNull();
      const noPerfilAlheio = await indicador.storage
        .from(BUCKET)
        .upload(`item/${itemId}/invasor.png`, png, { contentType: "image/png" });
      expect(noPerfilAlheio.error).not.toBeNull();

      const capa = await dono.storage
        .from(BUCKET)
        .upload(`item/${itemId}/capa.png`, png, { contentType: "image/png", upsert: false });
      expect(capa.error).toBeNull();
      const g = await dono
        .from("catalogo_item_versao")
        .update({
          foto_path: `item/${itemId}/capa.png`,
          fotos_extras_paths: [`item/${itemId}/extra-1.png`],
        })
        .eq("id", versaoId);
      expect(g.error).toBeNull();
    });

    it("antes da aprovação o imóvel não é público; envio, congelamento (IM-022) e aprovação (IM-021)", async () => {
      expect(await visivelParaAnon()).toBe(false);
      const env = await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: versaoId });
      expect(env.error).toBeNull();
      expect(await visivelParaAnon()).toBe(false);

      // versão enviada é imutável, mesmo para o dono, e dono não aprova
      const edita = await dono
        .from("catalogo_item_versao")
        .update({ quartos: 5 })
        .eq("id", versaoId)
        .select();
      expect((edita.data ?? []).length === 0 || Boolean(edita.error)).toBe(true);
      const autoAprova = await dono.rpc("catalogo_decidir_item_versao", {
        p_versao_id: versaoId,
        p_aprovar: true,
      });
      expect(codigo(autoAprova.error)).toBe("42501");

      const aprova = await admin.rpc("catalogo_decidir_item_versao", {
        p_versao_id: versaoId,
        p_aprovar: true,
      });
      expect(aprova.error).toBeNull();
      // aprovado mas ainda não publicado: segue fora do ar
      const antesPublicar = await dono
        .from("catalogo_meus_itens")
        .select("publicado")
        .eq("id", itemId);
      expect(antesPublicar.data?.[0]?.publicado).toBe(false);
      expect(await visivelParaAnon()).toBe(false);
    });

    it("publica: aparece com bairro/cidade/UF, filtros funcionam e a foto extra é pública", async () => {
      const pub = await dono.from("catalogo_item").update({ publicado: true }).eq("id", itemId);
      expect(pub.error).toBeNull();
      const lista = await anon.rpc("loja_listar_imoveis", { p_perfil_id: perfilId });
      expect(lista.error).toBeNull();
      const linha = (lista.data ?? []).find((l: { o_id: string }) => l.o_id === itemId);
      expect(linha).toBeTruthy();
      expect(linha).toMatchObject({
        o_bairro: "Centro Histórico",
        o_cidade: "Porto Alegre",
        o_uf: "RS",
        o_finalidade: "aluguel",
        o_preco_modo: "fixo",
        o_preco_centavos: 150000,
        o_condominio_centavos: 0,
        o_iptu_centavos: 0,
      });
      const filtros: [Record<string, unknown>, boolean][] = [
        [{ p_finalidade: "aluguel", p_imovel_tipo: "apartamento" }, true],
        [{ p_finalidade: "venda" }, false],
        [{ p_imovel_tipo: "casa" }, false],
        [{ p_preco_min: 100000, p_preco_max: 200000 }, true],
        [{ p_preco_min: 150001 }, false],
        [{ p_preco_max: 149999 }, false],
        [{ p_quartos_min: 2 }, true],
        [{ p_quartos_min: 3 }, false],
        [{ p_uf: "rs", p_cidade: "porto ALEGRE", p_bairro: "centro historico" }, true],
        [{ p_uf: "SP" }, false],
      ];
      for (const [f, esperado] of filtros) {
        const r = await anon.rpc("loja_listar_imoveis", { ...f, p_perfil_id: perfilId });
        expect(r.error, JSON.stringify(f)).toBeNull();
        const achou = (r.data ?? []).some((l: { o_id: string }) => l.o_id === itemId);
        expect(achou, JSON.stringify(f)).toBe(esperado);
      }
      const foto = await anon.storage
        .from(BUCKET)
        .createSignedUrl(`item/${itemId}/extra-1.png`, 60);
      expect(foto.error).toBeNull();
    });

    it("retirar a Loja não despublica e some da leitura pública; a versão aprovada deixa de ser legível", async () => {
      expect((await definir(false, "Teste: retirar com item no ar")).error).toBeNull();
      const dele = await dono.from("catalogo_meus_itens").select("publicado").eq("id", itemId);
      expect(dele.data?.[0]?.publicado).toBe(true);
      expect(await visivelParaAnon()).toBe(false);
      const v = await anon.from("loja_item_publico").select("id").eq("id", itemId);
      expect(v.data ?? []).toHaveLength(0);
      const foto = await anon.storage
        .from(BUCKET)
        .createSignedUrl(`item/${itemId}/extra-1.png`, 60);
      expect(foto.error).not.toBeNull();
      // a foto em uso por versão aprovada não pode ser apagada pelo dono
      const apaga = await dono.storage.from(BUCKET).remove([`item/${itemId}/extra-1.png`]);
      expect(apaga.data ?? []).toHaveLength(0);
      // com a Loja retirada o dono não grava rascunho de imóvel novo (nova versão)
      const nova = await dono.from("catalogo_item_versao").insert({
        item_id: itemId,
        nome: `${nome} v2`,
        area_m2: 10,
      } as never);
      expect(nova.error).not.toBeNull();
    });

    it("leitura direta da tabela de versões por anon com a Loja retirada não devolve o imóvel", async () => {
      const t = await anon
        .from("catalogo_item_versao")
        .select("id, bairro, fotos_extras_paths")
        .eq("item_id", itemId);
      expect(t.error).toBeNull();
      expect(t.data ?? []).toHaveLength(0);
    });

    it("despublicar com a Loja retirada e re-liberar: não republica", async () => {
      const desp = await dono.from("catalogo_item").update({ publicado: false }).eq("id", itemId);
      expect(desp.error).toBeNull();
      expect((await definir(true, "Teste: re-liberar")).error).toBeNull();
      const dele = await dono.from("catalogo_meus_itens").select("publicado").eq("id", itemId);
      expect(dele.data?.[0]?.publicado).toBe(false);
      expect(await visivelParaAnon()).toBe(false);
    });

    it("perfil despublicado (IM-079) tiraria a Loja do ar: item despublicado segue fora; imóvel de anúncio particular é recusado", async () => {
      const part = await dono.rpc("catalogo_criar_item", {
        p_tipo: "imovel",
        p_perfil_id: null,
        p_nome: `${nome} particular`,
      });
      expect(part.error).not.toBeNull();
      expect(["23514", "42501"]).toContain(codigo(part.error));
    });
  });

  it("restaura a Loja do perfil ao estado inicial", async () => {
    expect((await definir(lojaInicial, "Teste: restaurar estado inicial")).error).toBeNull();
    const lib = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", perfilId);
    expect(Boolean(lib.data?.[0]?.liberada)).toBe(lojaInicial);
  });
});
