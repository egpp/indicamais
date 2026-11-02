import { describe, expect, it, vi } from "vitest";
import {
  criarServicoLocalizacao,
  montarMapaUrls,
  paraMapaPublico,
  type ClienteBancoLocalizacao,
} from "./localizacao";

const V = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const ENDERECO = { endereco: "Rua Segredo 123", cidade: "Campinas", uf: "SP" };

function bancoFalso(sobre: Partial<ClienteBancoLocalizacao> = {}) {
  const banco: ClienteBancoLocalizacao = {
    lerEnderecoVersao: vi.fn(async () => ({ dados: ENDERECO, erro: null })),
    gravarCoordenadas: vi.fn(async () => ({ erro: null })),
    limparCoordenadas: vi.fn(async () => ({ erro: null })),
    definirMostrarMapa: vi.fn(async () => ({ erro: null })),
    lerMeuMapa: vi.fn(async () => ({
      dados: { latitude: -22.9, longitude: -47.06, mostrar_mapa: true },
      erro: null,
    })),
    lerMapaPublico: vi.fn(async () => ({
      dados: { latitude: -22.9, longitude: -47.06, mostrar_mapa: true },
      erro: null,
    })),
    ...sobre,
  };
  return banco;
}
const ok = { ok: true as const, latitude: -22.9056, longitude: -47.0608 };

describe("montarMapaUrls", () => {
  it("monta embed, mapa maior e como chegar", () => {
    const u = montarMapaUrls({ latitude: -22.9056, longitude: -47.0608 })!;
    expect(u.embed).toBe(
      "https://www.openstreetmap.org/export/embed.html?bbox=-47.0658,-22.9106,-47.0558,-22.9006&layer=mapnik&marker=-22.9056,-47.0608",
    );
    expect(u.verMaior).toBe(
      "https://www.openstreetmap.org/?mlat=-22.9056&mlon=-47.0608#map=17/-22.9056/-47.0608",
    );
    expect(u.comoChegar).toBe("https://www.openstreetmap.org/directions?to=-22.9056%2C-47.0608");
  });

  it("sem injeção: texto, NaN, Infinity, fora da faixa e notação científica não geram URL", () => {
    for (const e of [
      { latitude: "1&x=2", longitude: 1 },
      { latitude: "-22.9", longitude: "-47" },
      { latitude: NaN, longitude: 1 },
      { latitude: 1, longitude: Infinity },
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: -181 },
      { latitude: null, longitude: undefined },
    ]) {
      expect(montarMapaUrls(e)).toBeNull();
    }
    const u = montarMapaUrls({ latitude: 1e-9, longitude: 0.0000001 })!;
    expect(`${u.embed}${u.verMaior}${u.comoChegar}`).not.toMatch(/e[-+]?\d/i);
  });

  it("só aparece o domínio do OpenStreetMap e caracteres numéricos", () => {
    const u = montarMapaUrls({ latitude: 10, longitude: 20 })!;
    for (const url of Object.values(u)) {
      expect(new URL(url).origin).toBe("https://www.openstreetmap.org");
    }
  });
});

describe("paraMapaPublico", () => {
  it("só mostra com mostrar_mapa ligado e coordenada", () => {
    expect(paraMapaPublico({ latitude: 1, longitude: 2, mostrar_mapa: true })).not.toBeNull();
    expect(paraMapaPublico({ latitude: 1, longitude: 2, mostrar_mapa: false })).toBeNull();
    expect(paraMapaPublico({ latitude: null, longitude: 2, mostrar_mapa: true })).toBeNull();
    expect(paraMapaPublico({ latitude: 1, longitude: 2, mostrar_mapa: null })).toBeNull();
    expect(paraMapaPublico(null)).toBeNull();
    expect(paraMapaPublico({ latitude: 99, longitude: 2, mostrar_mapa: true })).toBeNull();
  });
});

describe("localizarVersao", () => {
  it("geocodifica e grava com origem geocodificado", async () => {
    const banco = bancoFalso();
    const s = criarServicoLocalizacao(banco, { geocodificar: async () => ok });
    expect(await s.localizarVersao(V)).toEqual({ ok: true, valor: { localizado: true } });
    expect(banco.gravarCoordenadas).toHaveBeenCalledWith(V, -22.9056, -47.0608, "geocodificado");
  });

  it("sem resultado, indisponível ou coordenada inválida: neutro e não grava", async () => {
    for (const geo of [
      { ok: false as const, motivo: "sem_resultado" as const },
      { ok: false as const, motivo: "indisponivel" as const },
      { ok: true as const, latitude: 95, longitude: 0 },
    ]) {
      const banco = bancoFalso();
      const s = criarServicoLocalizacao(banco, { geocodificar: async () => geo });
      expect(await s.localizarVersao(V)).toEqual({ ok: true, valor: { localizado: false } });
      expect(banco.gravarCoordenadas).not.toHaveBeenCalled();
    }
  });

  it("geocodificador que lança não quebra", async () => {
    const s = criarServicoLocalizacao(bancoFalso(), {
      geocodificar: async () => {
        throw new Error("Rua Segredo 123");
      },
    });
    const r = await s.localizarVersao(V);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("Segredo");
  });

  it("endereço incompleto não chama o geocodificador", async () => {
    const geocodificar = vi.fn(async () => ok);
    const banco = bancoFalso({
      lerEnderecoVersao: async () => ({ dados: { ...ENDERECO, endereco: " " }, erro: null }),
    });
    const s = criarServicoLocalizacao(banco, { geocodificar });
    expect(await s.localizarVersao(V)).toEqual({ ok: true, valor: { localizado: false } });
    expect(geocodificar).not.toHaveBeenCalled();
  });

  it("versão alheia (não lida) ou suspensa (42501): erro neutro, sem geocodificar", async () => {
    const geocodificar = vi.fn(async () => ok);
    const alheia = criarServicoLocalizacao(
      bancoFalso({ lerEnderecoVersao: async () => ({ dados: null, erro: null }) }),
      { geocodificar },
    );
    expect(await alheia.localizarVersao(V)).toMatchObject({
      ok: false,
      erro: { codigo: "NAO_ENCONTRADO" },
    });
    const suspenso = criarServicoLocalizacao(
      bancoFalso({
        gravarCoordenadas: async () => ({ erro: { code: "42501", message: "interno" } }),
      }),
      { geocodificar },
    );
    const r = await suspenso.localizarVersao(V);
    expect(r).toMatchObject({ ok: false, erro: { codigo: "SEM_PERMISSAO" } });
    expect(JSON.stringify(r)).not.toContain("interno");
  });

  it("id inválido não consulta", async () => {
    const banco = bancoFalso();
    const s = criarServicoLocalizacao(banco, { geocodificar: async () => ok });
    expect((await s.localizarVersao("x")).ok).toBe(false);
    expect(banco.lerEnderecoVersao).not.toHaveBeenCalled();
  });
});

describe("informarCoordenadas / limpar / mostrar", () => {
  it("informa com origem informado; fora do Brasil só avisa", async () => {
    const banco = bancoFalso();
    const s = criarServicoLocalizacao(banco, { geocodificar: async () => ok });
    expect(await s.informarCoordenadas(V, -22.9, -47.06)).toEqual({
      ok: true,
      valor: { ok: true, avisoForaDoBrasil: false },
    });
    expect(banco.gravarCoordenadas).toHaveBeenCalledWith(V, -22.9, -47.06, "informado");
    expect(await s.informarCoordenadas(V, 48.85, 2.35)).toEqual({
      ok: true,
      valor: { ok: true, avisoForaDoBrasil: true },
    });
  });

  it("faixa inválida ou não numérico: validação, sem gravar", async () => {
    const banco = bancoFalso();
    const s = criarServicoLocalizacao(banco, { geocodificar: async () => ok });
    for (const [a, b] of [
      [91, 0],
      [0, 181],
      [NaN, 0],
      ["1", "2"],
      [null, null],
    ] as const) {
      expect(await s.informarCoordenadas(V, a, b)).toMatchObject({
        ok: false,
        erro: { codigo: "VALIDACAO" },
      });
    }
    expect(banco.gravarCoordenadas).not.toHaveBeenCalled();
  });

  it("mapeia 42501, 22023, P0002 e P0001 sem vazar texto do banco", async () => {
    const casos = [
      ["42501", "SEM_PERMISSAO"],
      ["22023", "VALIDACAO"],
      ["P0002", "NAO_ENCONTRADO"],
      ["P0001", "ESTADO_INVALIDO"],
    ] as const;
    for (const [code, codigo] of casos) {
      const erro = { code, message: "detalhe-interno" };
      const s = criarServicoLocalizacao(
        bancoFalso({
          gravarCoordenadas: async () => ({ erro }),
          limparCoordenadas: async () => ({ erro }),
          definirMostrarMapa: async () => ({ erro }),
        }),
        { geocodificar: async () => ok },
      );
      for (const r of [
        await s.informarCoordenadas(V, 1, 1),
        await s.limparCoordenadas(V),
        await s.definirMostrarMapa(P, true),
      ]) {
        expect(r).toMatchObject({ ok: false, erro: { codigo } });
        expect(JSON.stringify(r)).not.toContain("detalhe-interno");
      }
    }
  });

  it("limpar e mostrar: sucesso e validação de entrada", async () => {
    const banco = bancoFalso();
    const s = criarServicoLocalizacao(banco, { geocodificar: async () => ok });
    expect((await s.limparCoordenadas(V)).ok).toBe(true);
    expect((await s.definirMostrarMapa(P, false)).ok).toBe(true);
    expect(banco.definirMostrarMapa).toHaveBeenCalledWith(P, false);
    expect((await s.definirMostrarMapa(P, "sim" as unknown as boolean)).ok).toBe(false);
    expect((await s.definirMostrarMapa("x", true)).ok).toBe(false);
  });

  it("banco que lança vira erro interno neutro", async () => {
    const s = criarServicoLocalizacao(
      bancoFalso({
        limparCoordenadas: async () => {
          throw new Error("segredo");
        },
      }),
      { geocodificar: async () => ok },
    );
    const r = await s.limparCoordenadas(V);
    expect(r).toMatchObject({ ok: false, erro: { codigo: "ERRO_INTERNO" } });
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});

describe("leitura", () => {
  it("meu perfil traz coordenadas, mostrarMapa e URLs", async () => {
    const s = criarServicoLocalizacao(bancoFalso(), { geocodificar: async () => ok });
    const r = await s.lerMinhaLocalizacao(P);
    expect(r).toMatchObject({
      ok: true,
      valor: { latitude: -22.9, longitude: -47.06, mostrarMapa: true },
    });
    expect(r.ok && r.valor.urls?.embed).toContain("marker=-22.9,-47.06");
  });

  it("meu perfil alheio: não encontrado", async () => {
    const s = criarServicoLocalizacao(
      bancoFalso({ lerMeuMapa: async () => ({ dados: null, erro: null }) }),
      { geocodificar: async () => ok },
    );
    expect(await s.lerMinhaLocalizacao(P)).toMatchObject({ ok: false });
  });

  it("público: mapa desligado ou sem coordenada devolve null", async () => {
    const desligado = criarServicoLocalizacao(
      bancoFalso({
        lerMapaPublico: async () => ({
          dados: { latitude: 1, longitude: 2, mostrar_mapa: false },
          erro: null,
        }),
      }),
      { geocodificar: async () => ok },
    );
    expect(await desligado.lerMapaPublico(P)).toEqual({ ok: true, valor: null });
    const ligado = criarServicoLocalizacao(bancoFalso(), { geocodificar: async () => ok });
    const r = await ligado.lerMapaPublico(P);
    expect(r.ok && r.valor?.urls.comoChegar).toContain("directions?to=");
  });
});

describe("log", () => {
  it("nenhum console recebe endereço", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const s = criarServicoLocalizacao(bancoFalso(), {
      geocodificar: async () => ({ ok: false, motivo: "indisponivel" }),
    });
    await s.localizarVersao(V);
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
    espioes.forEach((e) => e.mockRestore());
  });
});
