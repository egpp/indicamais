/**
 * Fase 8 · verificação independente (IM-091, IM-092, IM-093, IM-094, IM-018 "Como chegar", IM-086) contra o
 * ambiente de DESENVOLVIMENTO. Só leitura e negativos: toda escrita tentada é recusada ou desfeita (a RPC falha na
 * mesma transação). Sem service_role; credenciais só de variáveis de ambiente (D-011).
 *
 * O fluxo completo (imagem real, aceite do administrador, aprovação) está em fase9-banners.spec.ts e fase9-mapa-banner-proprio.spec.ts.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, entrar, exigirConta, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const UUID_ZERO = "00000000-0000-4000-8000-000000000000";
const CINCO = [
  "minimalista",
  "gastronomia",
  "saude_bem_estar",
  "beleza_estetica",
  "construcao_reformas",
];

function cab(token?: string) {
  return {
    apikey: CHAVE_ANON,
    Authorization: `Bearer ${token ?? CHAVE_ANON}`,
    "Content-Type": "application/json",
  };
}

async function tokenDe(request: APIRequestContext, papel: Papel): Promise<string | null> {
  if (nomesFaltando(papel).length > 0) return null;
  const { email, senha } = credenciais(papel);
  const r = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    data: { email, password: senha },
  });
  return r.ok() ? ((await r.json()) as { access_token: string }).access_token : null;
}

async function rpc(request: APIRequestContext, nome: string, corpo: object, token?: string) {
  const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${nome}`, {
    headers: cab(token),
    data: corpo,
  });
  const texto = await r.text();
  let json: { code?: string } = {};
  try {
    json = JSON.parse(texto);
  } catch {
    /* corpo vazio */
  }
  return { status: r.status(), code: json.code };
}

test.describe("Fase 8 · API (PostgREST)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Sem tela: só no projeto desktop.");
    test.skip(!URL_SUPABASE || !CHAVE_ANON, "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.");
  });

  test("anon: não lê autor_admin_id, conta_id, motivo nem usa select=*; escrita negada", async ({
    request,
  }) => {
    for (const col of ["autor_admin_id", "conta_id", "motivo_resposta", "respondido_em", "*"]) {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/perfis_banner?select=${col}&limit=1`, {
        headers: cab(),
      });
      expect(r.status(), `anon select=${col}`).toBeGreaterThanOrEqual(400);
    }
    const w = await request.post(`${URL_SUPABASE}/rest/v1/perfis_banner`, {
      headers: cab(),
      data: { perfil_id: UUID_ZERO },
    });
    expect(w.status()).toBeGreaterThanOrEqual(400);
    const u = await request.patch(`${URL_SUPABASE}/rest/v1/perfis_estilo_pagina?id=eq.premium`, {
      headers: { ...cab(), Prefer: "return=representation" },
      data: { habilitado: true },
    });
    expect(u.status() >= 400 || (await u.json()).length === 0).toBe(true);
    for (const v of ["perfis_banner_aguardando_aceite", "administracao_banners_empresa"]) {
      const r = await request.get(`${URL_SUPABASE}/rest/v1/${v}?select=id&limit=1`, {
        headers: cab(),
      });
      expect(r.status(), v).toBeGreaterThanOrEqual(400);
    }
  });

  test("anon: só vê banner público (sem aguardando/recusado/removido/inativo) e estilo habilitado", async ({
    request,
  }) => {
    const r = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_banner?select=situacao,ativo,origem,imagem_path,perfil_id`,
      { headers: cab() },
    );
    expect(r.status()).toBe(200);
    const linhas = (await r.json()) as {
      situacao: string;
      ativo: boolean;
      origem: string;
      imagem_path: string;
      perfil_id: string;
    }[];
    for (const b of linhas) {
      expect(b.ativo).toBe(true);
      expect(["aceito", "na_versao"]).toContain(b.situacao);
      expect(b.imagem_path.startsWith(`perfil/${b.perfil_id}/`)).toBe(true);
    }
    const est = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_estilo_pagina?select=id,habilitado`,
      { headers: cab() },
    );
    const lista = (await est.json()) as { id: string; habilitado: boolean }[];
    expect(lista).toHaveLength(20);
    const hab = lista.filter((e) => e.habilitado).map((e) => e.id);
    for (const id of CINCO) expect(hab).toContain(id);
    const pub = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_perfil_publico?select=estilo_pagina`,
      {
        headers: cab(),
      },
    );
    for (const p of (await pub.json()) as { estilo_pagina: string }[])
      expect(hab, "leitura pública só devolve estilo habilitado").toContain(p.estilo_pagina);
  });

  test("anon: RPCs de estilo e banner negadas", async ({ request }) => {
    const casos: [string, object][] = [
      ["perfis_definir_estilo", { p_perfil_id: UUID_ZERO, p_estilo: "gastronomia" }],
      [
        "perfis_admin_definir_estilo_habilitado",
        { p_estilo: "pet", p_habilitado: true, p_motivo: "x" },
      ],
      ["perfis_gravar_banners", { p_perfil_id: UUID_ZERO, p_banners: [] }],
      ["perfis_responder_banner", { p_banner_id: UUID_ZERO, p_aceitar: true }],
      ["perfis_definir_banner_ativo", { p_banner_id: UUID_ZERO, p_ativo: false }],
      [
        "perfis_admin_adicionar_banner",
        { p_perfil_id: UUID_ZERO, p_imagem_path: "x.png", p_texto_alternativo: "x", p_motivo: "x" },
      ],
      ["perfis_admin_remover_banner", { p_banner_id: UUID_ZERO, p_motivo: "x" }],
    ];
    for (const [nome, corpo] of casos) {
      const r = await rpc(request, nome, corpo);
      expect(r.status, nome).toBeGreaterThanOrEqual(400);
    }
  });

  test("responsável: estilo desabilitado recusado; banners fora da regra desfeitos; ações de admin negadas", async ({
    request,
  }) => {
    const token = await tokenDe(request, "dono");
    test.skip(!token, "Sem conta E2E_DONO.");
    const meus = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_meus_perfis?select=id,estilo_pagina&limit=1`,
      {
        headers: cab(token as string),
      },
    );
    const perfis = (await meus.json()) as { id: string; estilo_pagina: string }[];
    test.skip(perfis.length === 0, "Conta E2E_DONO sem perfil.");
    const { id, estilo_pagina: antes } = perfis[0];

    // Só estilo habilitado: 'premium' existe mas está desabilitado -> 22023.
    const e = await rpc(
      request,
      "perfis_definir_estilo",
      { p_perfil_id: id, p_estilo: "premium" },
      token as string,
    );
    expect(e.code).toBe("22023");
    const outro = await rpc(
      request,
      "perfis_definir_estilo",
      { p_perfil_id: UUID_ZERO, p_estilo: "gastronomia" },
      token as string,
    );
    expect(outro.code).toBe("42501");
    const dep = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_meus_perfis?select=estilo_pagina&id=eq.${id}`,
      {
        headers: cab(token as string),
      },
    );
    expect(((await dep.json()) as { estilo_pagina: string }[])[0].estilo_pagina).toBe(antes);

    // Só administrador geral habilita estilo (no-op se, por engano, fosse admin: minimalista já habilitado).
    const hab = await rpc(
      request,
      "perfis_admin_definir_estilo_habilitado",
      { p_estilo: "minimalista", p_habilitado: true, p_motivo: "teste" },
      token as string,
    );
    expect(hab.code).toBe("42501");

    // Limite de 6 (antes de qualquer escrita).
    const sete = Array.from({ length: 7 }, (_, i) => ({
      imagem_path: `perfil/${id}/b${i}.png`,
      texto_alternativo: "x",
    }));
    expect(
      (
        await rpc(
          request,
          "perfis_gravar_banners",
          { p_perfil_id: id, p_banners: sete },
          token as string,
        )
      ).code,
    ).toBe("23514");
    // Violações desfeitas na mesma transação: sem texto alternativo, destino externo, imagem de outro perfil.
    const ruins: object[] = [
      { imagem_path: `perfil/${id}/a.png`, texto_alternativo: "" },
      {
        imagem_path: `perfil/${id}/a.png`,
        texto_alternativo: "x",
        destino_secao: "https://exemplo.com",
      },
      { imagem_path: `perfil/${UUID_ZERO}/a.png`, texto_alternativo: "x" },
      { imagem_path: `perfil/${id}/a.gif`, texto_alternativo: "x" },
    ];
    for (const b of ruins) {
      const r = await rpc(
        request,
        "perfis_gravar_banners",
        { p_perfil_id: id, p_banners: [b] },
        token as string,
      );
      expect(r.status, JSON.stringify(b)).toBeGreaterThanOrEqual(400);
      expect(["23514", "23502", "22023", "42501", "P0001"]).toContain(r.code);
    }
    // Ações do administrador negadas ao responsável comum.
    const add = await rpc(
      request,
      "perfis_admin_adicionar_banner",
      {
        p_perfil_id: id,
        p_imagem_path: `perfil/${id}/a.png`,
        p_texto_alternativo: "x",
        p_motivo: "x",
      },
      token as string,
    );
    expect(add.status).toBeGreaterThanOrEqual(400);
    const rem = await rpc(
      request,
      "perfis_admin_remover_banner",
      { p_banner_id: UUID_ZERO, p_motivo: "x" },
      token as string,
    );
    expect(rem.status).toBeGreaterThanOrEqual(400);
    // Responder banner inexistente/alheio.
    expect(
      (
        await rpc(
          request,
          "perfis_responder_banner",
          { p_banner_id: UUID_ZERO, p_aceitar: true },
          token as string,
        )
      ).code,
    ).toBe("42501");
    // Colunas privadas continuam fora, também autenticado.
    const col = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_banner?select=autor_admin_id&limit=1`,
      {
        headers: cab(token as string),
      },
    );
    expect(col.status()).toBeGreaterThanOrEqual(400);
    const adm = await request.get(
      `${URL_SUPABASE}/rest/v1/administracao_banners_empresa?select=id`,
      {
        headers: cab(token as string),
      },
    );
    expect(adm.status() >= 400 || ((await adm.json()) as unknown[]).length === 0).toBe(true);
  });

  test("outra pessoa (indicador) não vê banner aguardando aceite nem avisos de banner alheios", async ({
    request,
  }) => {
    const token = await tokenDe(request, "indicador");
    test.skip(!token, "Sem conta E2E_INDICADOR.");
    const r = await request.get(`${URL_SUPABASE}/rest/v1/perfis_banner?select=situacao`, {
      headers: cab(token as string),
    });
    expect(r.status()).toBe(200);
    for (const b of (await r.json()) as { situacao: string }[])
      expect(["aceito", "na_versao"]).toContain(b.situacao);
    const ag = await request.get(
      `${URL_SUPABASE}/rest/v1/perfis_banner_aguardando_aceite?select=id`,
      {
        headers: cab(token as string),
      },
    );
    expect(await ag.json()).toEqual([]);
    const av = await request.get(
      `${URL_SUPABASE}/rest/v1/notificacoes_meus_avisos?select=*&tipo=eq.banner_aguardando_aceite`,
      { headers: cab(token as string) },
    );
    expect(await av.json()).toEqual([]);
  });
});

test.describe("Fase 8 · telas e HTML", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop", "Conteúdo de HTML igual nos dois projetos.");
  });

  test("página pública: sem contato direto, sem conta_id e só 'Como chegar' como link externo", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const href = await page.locator('a.card-link[href^="/perfil/"]').first().getAttribute("href");
    test.skip(!href, "Sem perfil publicado no dev.");
    const r = await request.get(href as string);
    const html = await r.text();
    expect(html).not.toMatch(
      /mailto:|tel:|wa\.me|api\.whatsapp|whatsapp\.com|conta_id|responsavel_id|autor_admin_id/i,
    );
    const externos = [...html.matchAll(/<a\s[^>]*?href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    for (const url of externos) expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    // Visitante não força estilo por URL.
    await page.goto(`${href}?estilo=gastronomia`);
    await expect(page.getByTestId("site-negocio")).not.toHaveAttribute("data-estilo", "");
    const salvo = await page.getByTestId("site-negocio").getAttribute("data-estilo");
    await page.goto(href as string);
    await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", salvo as string);
  });

  test("responsável: telas novas com noindex; perfil alheio e áreas de admin dão 404", async ({
    page,
  }) => {
    exigirConta("dono");
    await entrar(page, "dono");
    await page.goto("/aparencia");
    if (!/\/meus-perfis\//.test(page.url()))
      await page.locator('main a[href$="/aparencia"]').first().click();
    await expect(page).toHaveURL(/\/meus-perfis\/[0-9a-f-]{36}\/aparencia$/);
    const id = page.url().match(/meus-perfis\/([0-9a-f-]{36})/)?.[1];
    for (const rota of [`aparencia`, `banners`, `previa?estilo=gastronomia`]) {
      const r = await page.goto(`/meus-perfis/${id}/${rota}`);
      expect(r?.status(), rota).toBe(200);
      await expect(page.locator('meta[name="robots"]'), rota).toHaveAttribute("content", /noindex/);
    }
    for (const rota of [
      "/administracao/estilos",
      `/administracao/negocios/${id}/banners`,
      `/meus-perfis/${UUID_ZERO}/aparencia`,
      `/meus-perfis/${UUID_ZERO}/banners`,
      `/meus-perfis/${UUID_ZERO}/previa?estilo=gastronomia`,
    ]) {
      const r = await page.goto(rota);
      expect(r?.status(), rota).toBe(404);
    }
  });

  test("administrador: estilos e banners da empresa com noindex", async ({ page }) => {
    exigirConta("admin");
    await entrar(page, "admin");
    const r = await page.goto("/administracao/estilos");
    expect(r?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/administracao/negocios");
    const alvo = page.locator('main a[href$="/banners"]').first();
    test.skip((await alvo.count()) === 0, "Nenhum negócio com atalho de banners.");
    await alvo.click();
    await expect(page).toHaveURL(/\/administracao\/negocios\/[0-9a-f-]{36}\/banners$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const r404 = await page.goto(`/administracao/negocios/${UUID_ZERO}/banners`);
    expect(r404?.status()).toBe(404);
  });

  // O antigo test.fixme do fluxo ponta a ponta virou testes reais: tests/e2e/fase9-banners.spec.ts (administrador envia,
  // sino avisa, recusa exige motivo, aceite; B6.3b registra o defeito da imagem do banner do administrador) e
  // tests/e2e/fase9-mapa-banner-proprio.spec.ts (banner próprio, limite de 6, aprovação e página pública).
});
