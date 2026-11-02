import { describe, expect, it, vi } from "vitest";
import { criarServicoLocalizacao, type ClienteBancoLocalizacao } from "@/modules/perfis";
import type { Contexto } from "./contexto";
import {
  MENSAGENS_TELA_MAPA,
  informarCoordenadasMapa,
  localizarNoMapa,
  localizarSeguro,
  removerCoordenadasMapa,
} from "./tratadores-localizacao";
import { lerCoordenadas, validarCoordenadas } from "./validacao-localizacao";

const PERFIL = "11111111-1111-4111-8111-111111111111";
const VERSAO = "22222222-2222-4222-8222-222222222222";

function form(c: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(c)) f.set(k, v);
  return f;
}
function ctx(endereco = "Rua A, 1") {
  return {
    perfis: {
      obter: async () => ({
        ok: true,
        valor: {
          versaoAbertaId: VERSAO,
          versaoAprovadaId: null,
          conteudoEdicao: { endereco, cidade: "Maceió", uf: "AL" },
        },
      }),
    },
  } as unknown as Contexto;
}
function servico(geoOk: boolean, extra: Partial<ClienteBancoLocalizacao> = {}) {
  const banco = {
    lerEnderecoVersao: async () => ({
      dados: { endereco: "Rua A, 1", cidade: "Maceió", uf: "AL" },
      erro: null,
    }),
    gravarCoordenadas: vi.fn(async () => ({ erro: null })),
    limparCoordenadas: vi.fn(async () => ({ erro: null })),
    ...extra,
  } as unknown as ClienteBancoLocalizacao;
  const s = criarServicoLocalizacao(banco, {
    geocodificar: async () =>
      geoOk ? { ok: true, latitude: -9.66, longitude: -35.73 } : ({ ok: false } as never),
  });
  return { s, banco };
}

describe("coordenadas digitadas (IM-018)", () => {
  it("aceita vírgula decimal e avisa fora do Brasil", () => {
    expect(lerCoordenadas({ latitude: "-9,665", longitude: "-35,735" })).toMatchObject({
      ok: true,
      foraDoBrasil: false,
    });
    expect(lerCoordenadas({ latitude: "48.85", longitude: "2.35" })).toMatchObject({
      ok: true,
      foraDoBrasil: true,
    });
  });
  it("recusa vazio, texto e faixa inválida com mensagem por campo", () => {
    expect(validarCoordenadas({ latitude: "", longitude: "abc" })).toMatchObject({
      latitude: expect.any(String),
      longitude: expect.any(String),
    });
    expect(validarCoordenadas({ latitude: "91", longitude: "0" })?.latitude).toMatch(/-90 e 90/);
    expect(validarCoordenadas({ latitude: "0", longitude: "181" })?.longitude).toMatch(
      /-180 e 180/,
    );
    expect(validarCoordenadas({ latitude: "-9.6", longitude: "-35.7" })).toBeNull();
  });
});

describe("tratadores do mapa", () => {
  it("localizar: sucesso lembra da aprovação; não encontrado é aviso neutro", async () => {
    const ok = await localizarNoMapa(ctx(), servico(true).s, form({ id: PERFIL }));
    expect(ok.sucesso).toBe(MENSAGENS_TELA_MAPA.localizado);
    const nao = await localizarNoMapa(ctx(), servico(false).s, form({ id: PERFIL }));
    expect(nao.erro).toBe(MENSAGENS_TELA_MAPA.naoLocalizado);
  });
  it("localizar sem endereço pede o preenchimento", async () => {
    const r = await localizarNoMapa(ctx(""), servico(true).s, form({ id: PERFIL }));
    expect(r.erro).toBe(MENSAGENS_TELA_MAPA.semEndereco);
  });
  it("informar: valida antes de chamar o módulo e avisa fora do Brasil", async () => {
    const { s, banco } = servico(true);
    const ruim = await informarCoordenadasMapa(
      ctx(),
      s,
      form({ id: PERFIL, latitude: "x", longitude: "1" }),
    );
    expect(ruim.erros?.latitude).toBeTruthy();
    expect(banco.gravarCoordenadas).not.toHaveBeenCalled();
    const fora = await informarCoordenadasMapa(
      ctx(),
      s,
      form({ id: PERFIL, latitude: "48,85", longitude: "2,35" }),
    );
    expect(fora.sucesso).toContain("fora do Brasil");
    expect(banco.gravarCoordenadas).toHaveBeenCalledWith(VERSAO, 48.85, 2.35, "informado");
  });
  it("remover chama limpar na versão alvo", async () => {
    const { s, banco } = servico(true);
    const r = await removerCoordenadasMapa(ctx(), s, form({ id: PERFIL }));
    expect(r.sucesso).toBe(MENSAGENS_TELA_MAPA.removido);
    expect(banco.limparCoordenadas).toHaveBeenCalledWith(VERSAO);
  });
  it("localização automática nunca lança, mesmo se o módulo falhar", async () => {
    const { s } = servico(true, {
      gravarCoordenadas: async () => {
        throw new Error("banco fora");
      },
    });
    await expect(localizarSeguro(ctx(), s, PERFIL)).resolves.toBeUndefined();
  });
});
