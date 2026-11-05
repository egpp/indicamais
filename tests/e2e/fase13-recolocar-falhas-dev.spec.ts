/**
 * Fase 13 · efeito real no DEV da RPC indicacoes_notificacoes_recolocar_falhas (IM-027, IM-028, IM-080, IM-086).
 * SOMENTE LEITURA: sem service_role, sem dados criados. A função só é executável pela chave de serviço; anon e
 * contas autenticadas (dono, indicador, admin) devem ser recusados, mesmo com argumentos hostis, e nada muda.
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { credenciais, nomesFaltando, type Papel } from "./contas";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const RPC = "indicacoes_notificacoes_recolocar_falhas";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "Sem tela: executa só no projeto desktop.");
  test.skip(
    !URL_SUPABASE || !CHAVE_ANON,
    "Faltam NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no .env.local.",
  );
});

const ARGS = [
  {},
  { p_limite: 100, p_tentativas_max: 1000, p_espera_minutos: 0 },
  { p_limite: -5, p_tentativas_max: -1, p_espera_minutos: -10 },
  { p_limite: 2147483647, p_tentativas_max: 2147483647, p_espera_minutos: 2147483647 },
  {
    p_limite: "1; drop table indicacoes_notificacao",
    p_tentativas_max: null,
    p_espera_minutos: null,
  },
];

async function token(request: APIRequestContext, papel: Papel): Promise<string | null> {
  if (nomesFaltando(papel).length > 0) return null;
  const { email, senha } = credenciais(papel);
  const r = await request.post(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    data: { email, password: senha },
  });
  if (!r.ok()) return null;
  return ((await r.json()) as { access_token?: string }).access_token ?? null;
}

function cab(t?: string) {
  return {
    apikey: CHAVE_ANON,
    Authorization: `Bearer ${t ?? CHAVE_ANON}`,
    "Content-Type": "application/json",
  };
}

/** Contagem legível pela conta (RLS), por cabeçalho Content-Range; só leitura. */
async function contar(request: APIRequestContext, recurso: string, t?: string): Promise<string> {
  const r = await request.get(`${URL_SUPABASE}/rest/v1/${recurso}?select=*&limit=1`, {
    headers: { ...cab(t), Prefer: "count=exact" },
  });
  return `${r.status()}:${r.headers()["content-range"] ?? "-"}`;
}

const RECURSOS = [
  "indicacoes_notificacao",
  "indicacoes_meus_pedidos",
  "indicacoes_notificacao_historico",
];
const recusado = (s: number) => [401, 403, 404].includes(s);

for (const papel of [null, "dono", "indicador", "admin"] as const) {
  test(`RPC ${RPC} recusa ${papel ?? "anônimo"} e nada muda`, async ({ request }) => {
    let t: string | undefined;
    if (papel) {
      const tk = await token(request, papel);
      test.skip(!tk, `Conta ${papel} indisponível (variáveis ausentes ou login recusado).`);
      t = tk ?? undefined;
    }
    const antes: string[] = [];
    for (const r of RECURSOS) antes.push(await contar(request, r, t));

    for (const args of ARGS) {
      const r = await request.post(`${URL_SUPABASE}/rest/v1/rpc/${RPC}`, {
        headers: cab(t),
        data: args,
      });
      expect(recusado(r.status()), `status ${r.status()} com ${JSON.stringify(args)}`).toBe(true);
      const corpo = await r.text();
      expect(corpo).not.toMatch(/^\d+$/); // nunca devolve a contagem de linhas recolocadas
    }

    const depois: string[] = [];
    for (const r of RECURSOS) depois.push(await contar(request, r, t));
    expect(depois).toEqual(antes);
  });
}

test("app no ar e página de entrar responde (somente leitura)", async ({ page }) => {
  const r = await page.goto("/entrar");
  expect(r?.status()).toBeLessThan(400);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
