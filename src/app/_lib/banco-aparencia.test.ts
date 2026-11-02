import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_APARENCIA, criarBancoAparencia } from "./banco-aparencia";

function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const chamadas: { rpc: [string, Record<string, unknown>][]; selects: [string, string][] } = {
    rpc: [],
    selects: [],
  };
  const pronto = () => {
    if (lancar) throw new Error("rede caiu: segredo-interno");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const consulta = {
    eq: () => consulta,
    order: () => consulta,
    maybeSingle: () => Promise.resolve(pronto()),
    then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res),
  };
  const cliente = {
    rpc: (nome: string, args: Record<string, unknown>) => {
      chamadas.rpc.push([nome, args]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (t: string) => ({
      select: (c: string) => {
        chamadas.selects.push([t, c]);
        return consulta;
      },
    }),
  };
  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

describe("adaptador do banco de aparência", () => {
  it("colunas nomeadas, sem '*', sem coluna de conta nem banners_paths", () => {
    for (const c of Object.values(COLUNAS_APARENCIA)) {
      expect(c).not.toContain("*");
      expect(c).not.toMatch(/autor_admin_id|conta_id|responsavel_id|banners_paths/);
    }
  });
  it("chama as RPCs certas com os parâmetros", async () => {
    const { cliente, chamadas } = falso({ data: "x" });
    const b = criarBancoAparencia(cliente);
    await b.definirEstilo({ perfilId: "p", estilo: "gastronomia" });
    await b.gravarBanners({ perfilId: "p", banners: [] });
    await b.responderBanner({ bannerId: "b", aceitar: false, motivo: "m" });
    await b.adicionarBannerAdmin({
      perfilId: "p",
      imagemPath: "i",
      textoAlternativo: "t",
      motivo: "m",
      ordem: 1,
      destinoSecao: null,
    });
    expect(chamadas.rpc.map((c) => c[0])).toEqual([
      "perfis_definir_estilo",
      "perfis_gravar_banners",
      "perfis_responder_banner",
      "perfis_admin_adicionar_banner",
    ]);
    expect(chamadas.rpc[0]![1]).toEqual({ p_perfil_id: "p", p_estilo: "gastronomia" });
  });
  it("leituras usam as visões previstas", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const b = criarBancoAparencia(cliente);
    await b.listarBannersPublicos("p");
    await b.listarBannersAguardandoAceite();
    await b.listarBannersAdmin("p");
    await b.listarBannersDoPerfil("p");
    await b.lerEstiloPublico("s");
    expect(chamadas.selects.map((s) => s[0])).toEqual([
      "perfis_banner_publico",
      "perfis_banner_aguardando_aceite",
      "administracao_banners_empresa",
      "perfis_banner",
      "perfis_perfil_publico",
    ]);
  });
  it("erro do postgrest vira ErroBanco e exceção vira XX000 sem texto", async () => {
    const e = falso({ error: { code: "42501", message: "m" } });
    const r1 = await criarBancoAparencia(e.cliente).definirEstilo({ perfilId: "p", estilo: "x" });
    expect(r1.erro?.code).toBe("42501");
    const l = falso({}, true);
    const r2 = await criarBancoAparencia(l.cliente).listarEstilos();
    expect(r2.erro).toEqual({ code: "XX000" });
  });
});
