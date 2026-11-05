/**
 * Fase 12 · e2e a 360px dos 21 estilos com plano e variações reais (IM-097, IM-101, D-022, D-023) no DEV.
 * Itens FIXOS (obterItemFixo: reaproveita a capa, não envia imagem nova; a cota do dev não cresce). A Loja do perfil de
 * teste é ligada pelo admin E2E (motivo registrado) e DESLIGADA no fim (finally), conferindo liberada=false.
 * Para cada estilo (prévia ?estilo= do responsável): sem rolagem horizontal, cards de mesma largura e altura, foco por
 * teclado visível, lista de interesse (adicionar, enviar ao contato preenche a Mensagem, esvaziar), "Produtos e
 * serviços" sem Loja, "Loja" + "Planos" com Loja. O envio real do contato é feito em UM estilo (grava 1 pedido de teste).
 * Só contas E2E_*, sem service_role.
 * Executar: pnpm exec playwright test tests/e2e/fase12-360-estilos.spec.ts --project=celular --workers=1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { credenciais, entrar, exigirConta } from "./contas";
import { obterItemFixo } from "../suporte/item-fixo";

const SLUG = "perfil-1";
const IDS = [
  ...readFileSync(join(process.cwd(), "src/app/_componentes/site/estilos.ts"), "utf8")
    .match(/IDS_ESTILOS = \[([\s\S]*?)\]/)![1]!
    .matchAll(/"([a-z_]+)"/g),
]
  .map((m) => m[1]!)
  .filter((id) => !(process.env.E2E_ESTILOS_EXCLUIR ?? "").split(",").includes(id))
  .filter(
    (id) =>
      !process.env.E2E_ESTILOS_INCLUIR || process.env.E2E_ESTILOS_INCLUIR.split(",").includes(id),
  );

const PROD_A = "E2E360 Camiseta";
const PROD_B = "E2E360 Caneca";
const PLANO_A = "E2E360 Plano Mensal";
const PLANO_B = "E2E360 Plano Trimestral";
const FIXOS: { nome: string; tipo: "produto" | "servico"; descricao: string }[] = [
  {
    nome: PROD_A,
    tipo: "produto",
    descricao: "Camiseta de teste.\nTamanhos: P, M, G\nCores: azul, preto",
  },
  { nome: PROD_B, tipo: "produto", descricao: "Caneca de teste sem variações." },
  {
    nome: PLANO_A,
    tipo: "servico",
    descricao: "Periodicidade: por mês\nAcesso livre\nSuporte por mensagem",
  },
  {
    nome: PLANO_B,
    tipo: "servico",
    descricao: "Periodicidade: por trimestre\nAcesso livre\nSuporte por mensagem",
  },
];

let dono: SupabaseClient;
let admin: SupabaseClient;
let perfilId = "";
const publicados: string[] = [];

async function logar(papel: "dono" | "admin"): Promise<SupabaseClient> {
  const { email, senha } = credenciais(papel);
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}
async function definirLoja(liberada: boolean) {
  const { error } = await admin.rpc("loja_definir_liberacao", {
    p_perfil_id: perfilId,
    p_liberada: liberada,
    p_motivo: `E2E 360px (Fase 12): ${liberada ? "ligar" : "desligar"} a Loja para teste`,
  });
  if (error) throw new Error(`loja_definir_liberacao: ${error.code}`);
}
async function lojaLiberada(): Promise<boolean> {
  const { data } = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", perfilId);
  return Boolean(data?.[0]?.liberada);
}

async function prepararItem(f: (typeof FIXOS)[number], categoriaId: string) {
  const it = await obterItemFixo(dono, admin, {
    p_tipo: f.tipo,
    p_perfil_id: perfilId,
    p_nome: f.nome,
    p_descricao: f.descricao,
    p_categoria_principal_id: categoriaId,
  });
  const u = await dono
    .from("catalogo_item_versao")
    .update({
      nome: f.nome,
      descricao: f.descricao,
      // Sem enviar imagem nova (cota do dev): o banco exige só o formato do caminho; sem objeto no Storage o site
      // mostra o ícone de "sem imagem" no card.
      foto_path: it.fotoPath ?? `item/${it.itemId}/e2e360-sem-arquivo.png`,
    })
    .eq("id", it.versaoId);
  if (u.error) throw new Error(`versão: ${u.error.code}`);
  const env = await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: it.versaoId });
  if (env.error) throw new Error(`enviar: ${env.error.code}`);
  const ap = await admin.rpc("catalogo_decidir_item_versao", {
    p_versao_id: it.versaoId,
    p_aprovar: true,
  });
  if (ap.error) throw new Error(`aprovar: ${ap.error.code}`);
  const pub = await dono.from("catalogo_item").update({ publicado: true }).eq("id", it.itemId);
  if (pub.error) throw new Error(`publicar: ${pub.error.code}`);
  publicados.push(it.itemId);
}

async function semRolagem(page: Page, rotulo: string) {
  const l = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect
    .soft(l.sw, `${rotulo}: rolagem horizontal (${l.sw} > ${l.iw})`)
    .toBeLessThanOrEqual(l.iw + 1);
}

/** Todos os cards do seletor com a mesma largura; na mesma linha (mesmo topo) com a mesma altura. */
async function cardsIguais(page: Page, seletor: string, rotulo: string) {
  const caixas = await page.locator(seletor).evaluateAll((els) =>
    els
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({
        w: Math.round(r.width),
        h: Math.round(r.height),
        t: Math.round(r.top + window.scrollY),
      })),
  );
  expect.soft(caixas.length, `${rotulo}: cards ${seletor}`).toBeGreaterThanOrEqual(2);
  expect
    .soft(new Set(caixas.map((c) => c.w)).size, `${rotulo}: larguras ${JSON.stringify(caixas)}`)
    .toBe(1);
  const porLinha = new Map<number, Set<number>>();
  for (const c of caixas) {
    const chave = [...porLinha.keys()].find((k) => Math.abs(k - c.t) <= 2) ?? c.t;
    porLinha.set(chave, (porLinha.get(chave) ?? new Set<number>()).add(c.h));
  }
  for (const [, alturas] of porLinha)
    expect
      .soft(alturas.size, `${rotulo}: alturas na mesma linha ${JSON.stringify(caixas)}`)
      .toBe(1);
}

/** Abre a prévia do estilo; se o servidor cair no estilo salvo (prévia falhou), recarrega até 3 vezes e anota. */
async function abrirEstilo(page: Page, id: string) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    await page.goto(`/perfil/${SLUG}?estilo=${id}`);
    await page.locator("[data-estilo]").first().waitFor({ timeout: 90_000 });
    if ((await page.locator(`[data-estilo="${id}"]`).count()) > 0) return;
    console.log(`AVISO prévia de ${id} caiu no estilo salvo (tentativa ${tentativa})`);
  }
  await expect(page.locator(`[data-estilo="${id}"]`)).toBeVisible({ timeout: 1000 });
}

const FOCO_VISIVEL = () => {
  const e = document.activeElement as HTMLElement | null;
  if (!e) return null;
  const cs = getComputedStyle(e);
  return {
    tag: e.tagName,
    outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
    sombra: cs.boxShadow !== "none",
    secao: e.closest("section")?.id ?? "",
  };
};

async function focoPorTeclado(page: Page, rotulo: string) {
  // Tab a partir do campo anterior: a navegação por teclado liga :focus-visible.
  const card = page.locator("#produtos .st-card", { hasText: PROD_A }).first();
  await card.getByRole("combobox").last().focus();
  await page.keyboard.press("Tab");
  const r = await page.evaluate(FOCO_VISIVEL);
  expect
    .soft(r?.tag, `${rotulo}: o Tab deveria cair no botão (${JSON.stringify(r)})`)
    .toBe("BUTTON");
  expect
    .soft(Boolean(r && (r.outline || r.sombra)), `${rotulo}: foco invisível ${JSON.stringify(r)}`)
    .toBe(true);
}

test.describe.configure({ mode: "serial", timeout: 900_000 });
test.describe("Fase 12 · 21 estilos a 360px (DEV)", () => {
  test.use({ viewport: { width: 360, height: 800 } });
  test.skip(({ isMobile }) => !isMobile, "projeto celular");
  exigirConta("dono");
  exigirConta("admin");

  test.beforeAll(async () => {
    dono = await logar("dono");
    admin = await logar("admin");
    const { data } = await dono.from("perfis_meus_perfis").select("id, slug").order("criado_em");
    perfilId = ((data ?? []).find((p) => p.slug === SLUG) ?? data![0]!).id as string;
    const cat = await dono.from("catalogo_categoria").select("id").limit(1);
    for (const f of FIXOS) await prepararItem(f, cat.data![0]!.id as string);
    if (await lojaLiberada()) await definirLoja(false);
  });

  test.afterAll(async () => {
    try {
      for (const id of publicados)
        await dono.from("catalogo_item").update({ publicado: false }).eq("id", id);
    } finally {
      await definirLoja(false);
      expect(await lojaLiberada(), "Loja deve terminar desligada").toBe(false);
    }
  });

  test("Loja desligada: 21 estilos com 'Produtos e serviços', sem Loja nem Planos; layout e lista de interesse", async ({
    page,
  }) => {
    await entrar(page, "dono");
    let n = 0;
    for (const id of IDS) {
      await test.step(id, async () => {
        await abrirEstilo(page, id);
        await expect(page.locator("#produtos h2")).toHaveText("Produtos e serviços");
        await expect(page.locator("#planos")).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Loja", exact: true })).toHaveCount(0);
        await semRolagem(page, `${id} (sem Loja)`);
        await cardsIguais(page, "#produtos .st-card", `${id} (sem Loja)`);
        const card = page.locator("#produtos .st-card", { hasText: PROD_A }).first();
        await expect(card.getByText("Tamanhos:")).toBeVisible();
        await expect(card.getByText("Cores:")).toBeVisible();
        await focoPorTeclado(page, id);
        await card.getByLabel("Tamanho").selectOption("M");
        await card.getByLabel("Cor").selectOption("azul");
        await card.getByRole("button", { name: /Adicionar à lista/ }).click();
        await expect(
          page.getByRole("heading", { name: /Sua lista de interesse \(1 item\)/ }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Enviar a lista ao contato" }).click();
        const msg = page.getByLabel("Mensagem");
        await expect(msg).toHaveValue(new RegExp(PROD_A));
        await expect(msg).toHaveValue(/Tamanho: M/);
        await page.getByRole("button", { name: "Esvaziar a lista" }).click();
        await expect(page.getByRole("heading", { name: /Sua lista de interesse/ })).toHaveCount(0);
        n += 1;
      });
    }
    expect(n).toBe(IDS.length);
  });

  test("Envio real do contato esvazia a lista (um estilo)", async ({ page }) => {
    await page.goto(`/perfil/${SLUG}`);
    const card = page.locator("#produtos .st-card", { hasText: PROD_A }).first();
    await card.getByRole("button", { name: /Adicionar à lista/ }).click();
    await page.getByRole("button", { name: "Enviar a lista ao contato" }).click();
    await expect(page.getByLabel("Mensagem")).toHaveValue(new RegExp(PROD_A));
    await page.getByLabel("Seu nome").fill("Teste E2E 360");
    await page.getByLabel("Seu WhatsApp").fill("11987654321");
    await page.getByRole("button", { name: "Enviar pedido de contato" }).click();
    await expect(page.getByRole("heading", { name: /Sua lista de interesse/ })).toHaveCount(0, {
      timeout: 60_000,
    });
  });

  test("Loja ligada: 21 estilos com 'Loja' e 'Planos', cards iguais, sem rolagem horizontal", async ({
    page,
  }) => {
    await definirLoja(true);
    expect(await lojaLiberada()).toBe(true);
    await entrar(page, "dono");
    let n = 0;
    for (const id of IDS) {
      await test.step(id, async () => {
        await abrirEstilo(page, id);
        await expect(page.locator("#produtos h2")).toHaveText("Loja");
        await expect(page.locator("#planos")).toBeVisible();
        await expect(page.locator("#planos")).toContainText(PLANO_A);
        await expect(page.locator("#planos")).toContainText("por mês");
        await expect(page.locator("#produtos")).not.toContainText(PLANO_A);
        await semRolagem(page, `${id} (com Loja)`);
        await cardsIguais(page, "#produtos .st-card", `${id} produtos`);
        await cardsIguais(page, "#planos .st-plano", `${id} planos`);
        await focoPorTeclado(page, `${id} (com Loja)`);
        const link = page
          .locator("#planos")
          .getByRole("link", { name: /Conhecer este plano/ })
          .first();
        await link.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const r = await page.evaluate(FOCO_VISIVEL);
        expect
          .soft(Boolean(r && (r.outline || r.sombra)), `${id}: foco do plano ${JSON.stringify(r)}`)
          .toBe(true);
        n += 1;
      });
    }
    expect(n).toBe(IDS.length);
  });
});
