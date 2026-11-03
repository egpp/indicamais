import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarBancoHome, criarBancoHomeAdmin } from "./banco-home";
import { criarCacheTemporal } from "./cache-temporal";
import { alterarSecaoHome } from "./tratadores-home";
import type { ContextoHomeAdmin } from "./contexto-home";

describe("cache temporal", () => {
  it("reaproveita até expirar e recarrega depois", async () => {
    let t = 0;
    const c = criarCacheTemporal<number>({ ttlMs: 1000, agora: () => t });
    const carregar = vi.fn(async () => 1);
    await c.obter("a", carregar);
    t = 999;
    await c.obter("a", carregar);
    expect(carregar).toHaveBeenCalledTimes(1);
    t = 1000;
    await c.obter("a", carregar);
    expect(carregar).toHaveBeenCalledTimes(2);
  });
  it("chaves diferentes (cidades) não se misturam", async () => {
    const c = criarCacheTemporal<string>({ ttlMs: 1000 });
    expect(await c.obter("SP|campinas", async () => "A")).toBe("A");
    expect(await c.obter("sem-cidade", async () => "B")).toBe("B");
    expect(await c.obter("SP|campinas", async () => "X")).toBe("A");
  });
  it("chamadas simultâneas dividem uma carga", async () => {
    const c = criarCacheTemporal<number>({ ttlMs: 1000 });
    const carregar = vi.fn(async () => 5);
    await Promise.all([c.obter("a", carregar), c.obter("a", carregar)]);
    expect(carregar).toHaveBeenCalledTimes(1);
  });
  it("falha não é guardada", async () => {
    const c = criarCacheTemporal<number>({ ttlMs: 1000 });
    await expect(c.obter("a", async () => Promise.reject(new Error("x")))).rejects.toThrow();
    expect(await c.obter("a", async () => 2)).toBe(2);
  });
  it("invalidar descarta guardado e carga em andamento", async () => {
    const c = criarCacheTemporal<number>({ ttlMs: 1000 });
    await c.obter("a", async () => 1);
    c.invalidar();
    expect(await c.obter("a", async () => 2)).toBe(2);
    let solta!: (n: number) => void;
    const lenta = c.obter("b", () => new Promise<number>((r) => (solta = r)));
    c.invalidar();
    solta(9);
    expect(await lenta).toBe(9);
    expect(await c.obter("b", async () => 10)).toBe(10);
  });
  it("respeita o limite de entradas", async () => {
    const c = criarCacheTemporal<number>({ ttlMs: 1000, maxEntradas: 2 });
    for (const k of ["a", "b", "c"]) await c.obter(k, async () => 1);
    expect(c.tamanho()).toBe(2);
  });
});

function clienteFalso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const rpc = vi.fn((...args: [string, Record<string, unknown>]) => {
    void args;
    if (lancar) throw new Error("rede: segredo");
    return Promise.resolve({ data: resposta.data ?? null, error: resposta.error ?? null });
  });
  const colunas: string[] = [];
  const from = () => ({
    select: (c: string) => {
      colunas.push(c);
      const q = {
        order: () => q,
        then: (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: resposta.data ?? null, error: resposta.error ?? null }).then(res),
      };
      return q;
    },
  });
  return { cliente: { rpc, from } as unknown as SupabaseClient<never>, rpc, colunas };
}

describe("adaptadores do banco da home", () => {
  it("omite cidade e UF ausentes e repassa os presentes", async () => {
    const f = clienteFalso({ data: [] });
    const b = criarBancoHome(f.cliente as never);
    await b.listarSecoes({});
    await b.listarSecoes({ p_cidade: "Campinas", p_uf: "SP" });
    await b.listarPerfisDaSecao({ p_chave: "novidades" });
    expect(f.rpc.mock.calls).toEqual([
      ["busca_home_secoes", {}],
      ["busca_home_secoes", { p_cidade: "Campinas", p_uf: "SP" }],
      ["busca_home_secao_perfis", { p_chave: "novidades" }],
    ]);
  });
  it("erro e exceção viram só código, sem texto", async () => {
    const e = await criarBancoHome(
      clienteFalso({ error: { code: "22023", message: "UF inválida" } }).cliente as never,
    ).listarSecoes({});
    expect(e.erro).toEqual({ code: "22023" });
    const x = await criarBancoHome(clienteFalso({}, true).cliente as never).listarSecoes({});
    expect(JSON.stringify(x)).not.toContain("segredo");
    expect(x.erro).not.toBeNull();
  });
  it("administração: colunas nomeadas e rpc com os 7 parâmetros", async () => {
    const f = clienteFalso({ data: [] });
    const b = criarBancoHomeAdmin(f.cliente as never);
    await b.listarSecoes();
    expect(f.colunas[0]).not.toContain("*");
    const p = {
      p_chave: "novidades",
      p_titulo: "Novidades",
      p_ativa: true,
      p_ordem: 1,
      p_minimo_itens: 4,
      p_limite_padrao: 10,
      p_motivo: "m",
    };
    await b.alterarSecao(p);
    expect(f.rpc).toHaveBeenCalledWith("administracao_alterar_home_secao", p);
  });
});

describe("tratador da edição das seções", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("sucesso limpa o motivo; erro de validação aparece por campo", async () => {
    const alterarSecaoHome_ = vi.fn(async (e: unknown) => {
      const o = e as { motivo: string };
      return o.motivo
        ? { ok: true as const, valor: { chave: "novidades" as const } }
        : {
            ok: false as const,
            erro: {
              codigo: "MOTIVO_OBRIGATORIO" as const,
              mensagem: "Informe o motivo.",
              campos: { motivo: "Informe o motivo." },
            },
          };
    });
    const ctx = { home: { alterarSecaoHome: alterarSecaoHome_ } } as unknown as ContextoHomeAdmin;
    const ok = await alterarSecaoHome(
      ctx,
      form({ chave: "novidades", titulo: "Novidades", motivo: "x" }),
    );
    expect(ok.sucesso).toBeTruthy();
    expect(ok.valores?.motivo).toBe("");
    const ruim = await alterarSecaoHome(
      ctx,
      form({ chave: "novidades", titulo: "Novidades", motivo: "" }),
    );
    expect(ruim.erros?.motivo).toBe("Informe o motivo.");
  });
});
