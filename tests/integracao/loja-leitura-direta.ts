import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gerarPng } from "../e2e/png";
import { exigirCotaDisponivel, obterItemFixo } from "../suporte/item-fixo";
import { limparImagensDoItem } from "../suporte/limpar-imagens-item";

/**
 * Integração real no DESENVOLVIMENTO (sem service_role): leitura DIRETA da tabela catalogo_item_versao com a Loja
 * retirada e liberada, por anon, authenticated que não é dono, dono e administrador (IM-097, IM-098, IM-099, IM-029,
 * IM-086, migração 20261103160000). Também cobre: retirar a Loja não despublica; produto comum segue visível sem a Loja;
 * ressalva aceita (fotos_extras_paths de produto legíveis como caminho opaco, mas imagem inacessível sem a Loja).
 * Ao final apaga as próprias imagens (nova versão sem fotos aprovada, depois remove os arquivos) e restaura a Loja.
 * Só roda com as variáveis E2E_* e NEXT_PUBLIC_SUPABASE_* (em `.env.local`, carregado em memória; nada é impresso).
 */
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* sem arquivo legível: ficam skipped */
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

function novo(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function logado(email: string, senha: string): Promise<SupabaseClient> {
  const c = novo();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}

export function registrarLeituraDireta() {
  describe.skipIf(!pronto)("Loja: leitura direta de versões por papel (integração dev)", () => {
    let anon: SupabaseClient;
    let dono: SupabaseClient;
    let admin: SupabaseClient;
    let indicador: SupabaseClient;
    let perfilId = "";
    let lojaInicial = false;
    let categoriaId = "";
    let imovelId = "";
    let imovelVersaoId = "";
    let produtoId = "";
    let produtoVersaoId = "";
    let produtoExtra = "";
    const sufixo = Date.now().toString(36);

    beforeAll(async () => {
      await exigirCotaDisponivel(await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!));
    });

    // Sempre devolve a Loja ao estado inicial e despublica os itens, mesmo se um teste falhar no meio.
    afterAll(async () => {
      if (!perfilId || !admin) return;
      try {
        for (const id of [imovelId, produtoId]) {
          if (id) await dono.from("catalogo_item").update({ publicado: false }).eq("id", id);
        }
      } finally {
        await definir(lojaInicial);
      }
    });

    const definir = (liberada: boolean) =>
      admin.rpc("loja_definir_liberacao", {
        p_perfil_id: perfilId,
        p_liberada: liberada,
        p_motivo: "Teste de leitura direta (verificador)",
      });
    async function linhas(c: SupabaseClient, versaoId: string) {
      const r = await c
        .from("catalogo_item_versao")
        .select("id, bairro, cidade, uf, fotos_extras_paths")
        .eq("id", versaoId);
      expect(r.error).toBeNull();
      return r.data ?? [];
    }

    it("prepara sessões, imóvel e produto publicados com a Loja liberada", async () => {
      anon = novo();
      dono = await logado(e.E2E_DONO_EMAIL!, e.E2E_DONO_SENHA!);
      admin = await logado(e.E2E_ADMIN_EMAIL!, e.E2E_ADMIN_SENHA!);
      indicador = await logado(e.E2E_INDICADOR_EMAIL!, e.E2E_INDICADOR_SENHA!);
      const { data } = await dono
        .from("perfis_meus_perfis")
        .select("id")
        .order("criado_em", { ascending: true });
      perfilId = data![0]!.id as string;
      const lib = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", perfilId);
      lojaInicial = Boolean(lib.data?.[0]?.liberada);
      categoriaId = (await anon.from("catalogo_categoria").select("id").limit(1)).data![0]!
        .id as string;
      expect((await definir(true)).error).toBeNull();

      // itens FIXOS (reaproveitados entre rodadas: nova versão, mesma capa) para a cota de imagens não crescer
      const im = await obterItemFixo(dono, admin, {
        p_tipo: "imovel",
        p_perfil_id: perfilId,
        p_nome: "LD imovel fixo",
        p_descricao: "Imóvel de teste de leitura direta. Despublicado ao final.",
        p_categoria_principal_id: categoriaId,
        p_preco_modo: "fixo",
        p_preco_centavos: 210000,
      });
      imovelId = im.itemId;
      imovelVersaoId = im.versaoId;
      const up = await dono
        .from("catalogo_item_versao")
        .update({
          imovel_tipo: "casa",
          finalidade: "aluguel",
          area_m2: 80,
          quartos: 2,
          banheiros: 1,
          vagas: 1,
          bairro: "Bairro Leitura",
          cidade: "Marília",
          uf: "SP",
          condominio_centavos: 0,
          iptu_centavos: 0,
          aceita_financiamento: false,
        })
        .eq("id", imovelVersaoId);
      expect(up.error).toBeNull();
      const capaImovel = im.fotoPath ?? `item/${imovelId}/capa-fixa.png`;
      if (!im.fotoPath) {
        expect(
          (
            await dono.storage
              .from(BUCKET)
              .upload(capaImovel, gerarPng(40, 30, [10, 90, 60]), { contentType: "image/png" })
          ).error,
        ).toBeNull();
      }
      expect(
        (
          await dono
            .from("catalogo_item_versao")
            .update({ foto_path: capaImovel })
            .eq("id", imovelVersaoId)
        ).error,
      ).toBeNull();

      const pr = await obterItemFixo(dono, admin, {
        p_tipo: "produto",
        p_perfil_id: perfilId,
        p_nome: "LD produto fixo",
        p_descricao: "Produto comum de teste de leitura direta. Despublicado ao final.",
        p_categoria_principal_id: categoriaId,
      });
      produtoId = pr.itemId;
      produtoVersaoId = pr.versaoId;
      // foto adicional no produto (exige a Loja liberada para gravar): base da ressalva aceita.
      // A extra é apagada na limpeza final (saldo zero); só a capa fica e é reaproveitada.
      produtoExtra = `item/${produtoId}/extra-${sufixo}.png`;
      const produtoCapa = pr.fotoPath ?? `item/${produtoId}/capa-fixa.png`;
      if (!pr.fotoPath) {
        expect(
          (
            await dono.storage
              .from(BUCKET)
              .upload(produtoCapa, gerarPng(40, 30, [140, 60, 90]), { contentType: "image/png" })
          ).error,
        ).toBeNull();
      }
      const upImg = await dono.storage
        .from(BUCKET)
        .upload(produtoExtra, gerarPng(40, 30, [90, 60, 140]), { contentType: "image/png" });
      expect(upImg.error).toBeNull();
      const gp = await dono
        .from("catalogo_item_versao")
        .update({ foto_path: produtoCapa, fotos_extras_paths: [produtoExtra] })
        .eq("id", produtoVersaoId);
      expect(gp.error).toBeNull();

      for (const [vId, iId] of [
        [imovelVersaoId, imovelId],
        [produtoVersaoId, produtoId],
      ] as const) {
        expect(
          (await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: vId })).error,
        ).toBeNull();
        expect(
          (await admin.rpc("catalogo_decidir_item_versao", { p_versao_id: vId, p_aprovar: true }))
            .error,
        ).toBeNull();
        expect(
          (await dono.from("catalogo_item").update({ publicado: true }).eq("id", iId)).error,
        ).toBeNull();
      }
    });

    it("Loja LIBERADA: o imóvel é legível por todos os papéis", async () => {
      for (const c of [anon, indicador, dono, admin]) {
        const l = await linhas(c, imovelVersaoId);
        expect(l).toHaveLength(1);
        expect(l[0]).toMatchObject({ bairro: "Bairro Leitura", cidade: "Marília", uf: "SP" });
      }
    });

    it("Loja RETIRADA: anon e authenticated não dono não leem o imóvel; dono e admin leem; nada é despublicado", async () => {
      expect((await definir(false)).error).toBeNull();
      expect(await linhas(anon, imovelVersaoId)).toHaveLength(0);
      expect(await linhas(indicador, imovelVersaoId)).toHaveLength(0);
      // também por filtro amplo (varredura) e por item_id
      const varredura = await anon
        .from("catalogo_item_versao")
        .select("id, bairro")
        .eq("item_id", imovelId);
      expect(varredura.error).toBeNull();
      expect(varredura.data ?? []).toHaveLength(0);
      const porBairro = await indicador
        .from("catalogo_item_versao")
        .select("id")
        .eq("bairro", "Bairro Leitura");
      expect(porBairro.data ?? []).toHaveLength(0);
      expect(await linhas(dono, imovelVersaoId)).toHaveLength(1);
      expect(await linhas(admin, imovelVersaoId)).toHaveLength(1);
      // retirar não despublica
      const pub = await dono
        .from("catalogo_meus_itens")
        .select("id, publicado")
        .in("id", [imovelId, produtoId]);
      expect(pub.error).toBeNull();
      expect((pub.data ?? []).map((x) => x.publicado)).toEqual([true, true]);
    });

    it("Loja RETIRADA: produto comum segue visível; privacidade (sem colunas de contato) preservada", async () => {
      const l = await linhas(anon, produtoVersaoId);
      expect(l).toHaveLength(1);
      const v = await anon.from("catalogo_item_publico").select("id").eq("id", produtoId);
      expect(v.error).toBeNull();
      expect(v.data ?? []).toHaveLength(1);
      for (const col of [
        "conta_id",
        "telefone",
        "whatsapp",
        "email",
        "logradouro",
        "cep",
        "latitude",
      ]) {
        const r = await anon.from("catalogo_item_versao").select(col).limit(1);
        expect(r.error, col).not.toBeNull();
      }
      // o imóvel sai da visão da Loja e do catálogo comum
      expect(
        ((await anon.from("loja_item_publico").select("id").eq("id", imovelId)).data ?? []).length,
      ).toBe(0);
      expect(
        ((await anon.from("catalogo_item_publico").select("id").eq("id", imovelId)).data ?? [])
          .length,
      ).toBe(0);
    });

    it("ressalva aceita: com a Loja retirada o caminho da foto extra do produto é legível, mas a imagem não é baixável", async () => {
      const l = await linhas(anon, produtoVersaoId);
      expect(l[0]?.fotos_extras_paths).toEqual([produtoExtra]); // caminho opaco, sem dado pessoal
      const assinada = await anon.storage.from(BUCKET).createSignedUrl(produtoExtra, 60);
      expect(assinada.error).not.toBeNull();
      const assinadaOutro = await indicador.storage.from(BUCKET).createSignedUrl(produtoExtra, 60);
      expect(assinadaOutro.error).not.toBeNull();
      const publica = anon.storage.from(BUCKET).getPublicUrl(produtoExtra).data.publicUrl;
      const resp = await fetch(publica);
      expect(resp.ok).toBe(false);
      expect(String(resp.headers.get("content-type") ?? "")).not.toMatch(/^image\//);
      const baixa = await anon.storage.from(BUCKET).download(produtoExtra);
      expect(baixa.error).not.toBeNull();
      // o dono continua acessando a própria imagem
      const dele = await dono.storage.from(BUCKET).createSignedUrl(produtoExtra, 60);
      expect(dele.error).toBeNull();
    });

    it("Loja LIBERADA de novo: o imóvel volta a ser legível (sem republicar nada)", async () => {
      expect((await definir(true)).error).toBeNull();
      expect(await linhas(anon, imovelVersaoId)).toHaveLength(1);
      expect(await linhas(indicador, imovelVersaoId)).toHaveLength(1);
    });

    it("limpeza: despublica os itens, apaga as próprias imagens e restaura a Loja", async () => {
      for (const id of [imovelId, produtoId]) {
        const d = await dono.from("catalogo_item").update({ publicado: false }).eq("id", id);
        expect(d.error).toBeNull();
      }
      expect(await limparImagensDoItem(dono, admin, produtoId)).toBeNull();
      expect(await limparImagensDoItem(dono, admin, imovelId)).toBeNull();
      const ainda = await dono.storage.from(BUCKET).createSignedUrl(produtoExtra, 60);
      expect(ainda.error).not.toBeNull();
      expect((await definir(lojaInicial)).error).toBeNull();
    });
  });
}
