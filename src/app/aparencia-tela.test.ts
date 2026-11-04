import { describe, expect, it, vi } from "vitest";
import {
  criarServicoAparencia,
  type BannerAdmin,
  type ClienteBancoAparencia,
} from "@/modules/perfis";
import { separarBanners, bannersDaPrevia } from "./_lib/banners-do-perfil";
import { caminhoDeBanner } from "./_lib/envio-banner";
import { estilosSelecionaveis } from "./_lib/estilo-da-pagina";
import { imagensDoBanner } from "./_componentes/site/site-negocio";
import {
  adicionarBannerAdmin,
  responderBanner,
  salvarBanners,
  salvarEstilo,
} from "./_lib/tratadores-aparencia";

const P = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ok = { erro: null };

function servico(sobre: Record<string, unknown> = {}) {
  const banco = {
    definirEstilo: vi.fn(async () => ok),
    gravarBanners: vi.fn(async () => ({ dados: B, erro: null })),
    responderBanner: vi.fn(async () => ok),
    adicionarBannerAdmin: vi.fn(async () => ({ dados: B, erro: null })),
    ...sobre,
  };
  return { s: criarServicoAparencia(banco as unknown as ClienteBancoAparencia), banco };
}
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const img = (n: number) => ({
  imagem_path: `perfil/${P}/img${n}.jpg`,
  texto_alternativo: `Imagem ${n}`,
  destino_secao: null,
  ativo: true,
});

describe("estilo salvo (IM-091, IM-094)", () => {
  it("salva e confirma; estilo inválido não chega ao banco", async () => {
    const { s, banco } = servico();
    const r = await salvarEstilo(s, form({ perfilId: P, estilo: "gastronomia" }));
    expect(r.sucesso).toMatch(/Estilo salvo/);
    expect(banco.definirEstilo).toHaveBeenCalledWith({ perfilId: P, estilo: "gastronomia" });
    const ruim = await salvarEstilo(s, form({ perfilId: P, estilo: "x;drop" }));
    expect(ruim.erro ?? ruim.erros).toBeTruthy();
    expect(banco.definirEstilo).toHaveBeenCalledTimes(1);
  });
  it("só estilos com desenho pronto E habilitados são selecionáveis (id desconhecido do código fica de fora)", () => {
    const r = estilosSelecionaveis([
      { id: "minimalista", rotulo: "M", ordem: 1, habilitado: true },
      { id: "gastronomia", rotulo: "G", ordem: 2, habilitado: false },
      { id: "estilo_futuro", rotulo: "F", ordem: 3, habilitado: true },
      { id: "beleza_estetica", rotulo: "B", ordem: 4, habilitado: true },
    ]);
    expect(r.map((t) => t.id)).toEqual(["minimalista", "beleza_estetica"]);
  });
});

describe("banners (IM-093)", () => {
  it("grava até 6; o sétimo é recusado antes do banco", async () => {
    const { s, banco } = servico();
    const seis = [1, 2, 3, 4, 5, 6].map(img);
    expect(
      (await salvarBanners(s, form({ perfilId: P, banners: JSON.stringify(seis) }))).sucesso,
    ).toMatch(/rascunho/);
    const sete = [...seis, img(7)];
    const r = await salvarBanners(s, form({ perfilId: P, banners: JSON.stringify(sete) }));
    expect(r.erro ?? JSON.stringify(r.erros)).toMatch(/6/);
    expect(banco.gravarBanners).toHaveBeenCalledTimes(1);
  });
  it("texto alternativo obrigatório e destino só interno", async () => {
    const { s, banco } = servico();
    const semAlt = await salvarBanners(
      s,
      form({ perfilId: P, banners: JSON.stringify([{ ...img(1), texto_alternativo: " " }]) }),
    );
    expect(semAlt.sucesso).toBeUndefined();
    const url = await salvarBanners(
      s,
      form({
        perfilId: P,
        banners: JSON.stringify([{ ...img(1), destino_secao: "https://x.com" }]),
      }),
    );
    expect(url.sucesso).toBeUndefined();
    const json = await salvarBanners(s, form({ perfilId: P, banners: "{nao-json" }));
    expect(json.erro).toBeTruthy();
    expect(banco.gravarBanners).not.toHaveBeenCalled();
  });
  it("versão em análise vira mensagem de análise", async () => {
    const { s } = servico({
      gravarBanners: async () => ({ dados: null, erro: { code: "P0001" } }),
    });
    const r = await salvarBanners(s, form({ perfilId: P, banners: JSON.stringify([img(1)]) }));
    expect(r.erro).toMatch(/análise/i);
  });
  it("recusa exige motivo; aceite não", async () => {
    const { s, banco } = servico();
    const sem = await responderBanner(s, form({ bannerId: B, decisao: "recusar", motivo: " " }));
    expect(sem.sucesso).toBeUndefined();
    expect(banco.responderBanner).not.toHaveBeenCalled();
    expect(
      (await responderBanner(s, form({ bannerId: B, decisao: "recusar", motivo: "Não combina" })))
        .sucesso,
    ).toBeTruthy();
    expect(
      (await responderBanner(s, form({ bannerId: B, decisao: "aceitar" }))).sucesso,
    ).toBeTruthy();
  });
  it("administrador: motivo e descrição obrigatórios", async () => {
    const { s, banco } = servico();
    const base = {
      perfilId: P,
      imagemPath: `perfil/${P}/adm-x.jpg`,
      textoAlternativo: "Fachada",
      motivo: "Campanha",
    };
    expect((await adicionarBannerAdmin(s, form({ ...base, motivo: "" }))).sucesso).toBeUndefined();
    expect(
      (await adicionarBannerAdmin(s, form({ ...base, textoAlternativo: "" }))).sucesso,
    ).toBeUndefined();
    expect((await adicionarBannerAdmin(s, form(base))).sucesso).toMatch(/aceite/);
    expect(banco.adicionarBannerAdmin).toHaveBeenCalledTimes(1);
  });
  it("caminho do admin usa adm-, o do responsável não", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(caminhoDeBanner(P, "image/webp", true, id)).toBe(`perfil/${P}/adm-${id}.webp`);
    expect(caminhoDeBanner(P, "image/jpeg", false, id)).toBe(`perfil/${P}/${id}.jpg`);
  });
});

const lin = (o: Partial<BannerAdmin>): BannerAdmin => ({
  id: B,
  perfilId: P,
  imagemPath: `perfil/${P}/a.jpg`,
  textoAlternativo: "a",
  destinoSecao: null,
  ordem: 1,
  versaoId: null,
  origem: "responsavel",
  situacao: "na_versao",
  ativo: true,
  motivoResposta: null,
  respondidoEm: null,
  criadoEm: null,
  ...o,
});

describe("separação dos banners do dono", () => {
  it("proposta do administrador só entra em 'aguardando'; versão antiga fica de fora; limite desconta os do admin", () => {
    const sep = separarBanners(
      [
        lin({ id: "a", versaoId: "v2" }),
        lin({ id: "velho", versaoId: "v1" }),
        lin({ id: "adm", origem: "administrador", situacao: "aguardando_aceite" }),
        lin({ id: "ac", origem: "administrador", situacao: "aceito", ativo: false, ordem: 2 }),
        lin({ id: "rec", origem: "administrador", situacao: "recusado" }),
      ],
      "v2",
      "v1",
    );
    expect(sep.proprios.map((b) => b.id)).toEqual(["a"]);
    expect(sep.aguardando.map((b) => b.id)).toEqual(["adm"]);
    expect(sep.limiteProprio).toBe(4);
    // A prévia nunca inclui proposta pendente nem banner oculto.
    expect(bannersDaPrevia(sep).map((b) => b.id)).toEqual(["a"]);
  });
});

describe("imagens do banner na página", () => {
  const perfil = { nome: "X", imagemPath: `perfil/${P}/p.jpg` } as never;
  const urls = { [`perfil/${P}/a.jpg`]: "/a", [`perfil/${P}/p.jpg`]: "/p" };
  it("usa os banners; destino só vale se a seção existe; sem banner cai na imagem principal", () => {
    const b = {
      id: B,
      perfilId: P,
      imagemPath: `perfil/${P}/a.jpg`,
      textoAlternativo: "Alt",
      destinoSecao: "beneficios" as const,
      ordem: 1,
    };
    expect(imagensDoBanner([b], perfil, urls, new Set(["beneficios"]))).toEqual([
      { src: "/a", alt: "Alt", href: "#beneficios" },
    ]);
    expect(imagensDoBanner([b], perfil, urls, new Set(["sobre"]))[0].href).toBeUndefined();
    expect(imagensDoBanner([], perfil, urls)).toEqual([{ src: "/p", alt: "Imagem de X" }]);
  });
});
