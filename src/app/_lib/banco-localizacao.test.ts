import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarBancoLocalizacao } from "./banco-localizacao";

function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const rpcs: [string, Record<string, unknown>][] = [];
  const tabelas: string[] = [];
  const pronto = () => {
    if (lancar) throw new Error("rede: segredo");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const consulta = {
    eq: () => consulta,
    maybeSingle: () => Promise.resolve(pronto()),
  };
  const cliente = {
    rpc: (n: string, a: Record<string, unknown>) => {
      rpcs.push([n, a]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (t: string) => {
      tabelas.push(t);
      return { select: () => consulta };
    },
  };
  return { cliente: cliente as unknown as SupabaseClient<never>, rpcs, tabelas };
}

describe("criarBancoLocalizacao", () => {
  it("chama as RPCs com os nomes e argumentos do banco", async () => {
    const f = falso();
    const b = criarBancoLocalizacao(f.cliente as never);
    await b.gravarCoordenadas("v", 1, 2, "informado");
    await b.limparCoordenadas("v");
    await b.definirMostrarMapa("p", true);
    expect(f.rpcs).toEqual([
      [
        "perfis_gravar_coordenadas",
        { p_versao_id: "v", p_latitude: 1, p_longitude: 2, p_origem: "informado" },
      ],
      ["perfis_limpar_coordenadas", { p_versao_id: "v" }],
      ["perfis_definir_mostrar_mapa", { p_perfil_id: "p", p_mostrar: true }],
    ]);
  });

  it("lê das visões certas e traduz erro", async () => {
    const f = falso({ error: { code: "42501", message: "x" } });
    const b = criarBancoLocalizacao(f.cliente as never);
    const r = await b.lerMeuMapa("p");
    await b.lerMapaPublico("p");
    await b.lerEnderecoVersao("v");
    expect(r.erro?.code).toBe("42501");
    expect(f.tabelas).toEqual([
      "perfis_meus_perfis",
      "perfis_perfil_publico",
      "perfis_perfil_versao",
    ]);
  });

  it("exceção vira erro neutro sem texto interno", async () => {
    const b = criarBancoLocalizacao(falso({}, true).cliente as never);
    const r = await b.limparCoordenadas("v");
    expect(r.erro).toEqual({ code: "XX000" });
  });
});
