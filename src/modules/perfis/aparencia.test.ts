import { describe, expect, it, vi } from "vitest";
import { criarServicoAparencia, estiloEfetivo, type ClienteBancoAparencia } from "./aparencia";

const P = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const IMG = `perfil/${P}/a.jpg`;
const ok = { erro: null };
const err = (code: string, message = "segredo-interno") => ({ erro: { code, message } });

function banco(sobre: Partial<Record<keyof ClienteBancoAparencia, unknown>> = {}) {
  const base = {
    listarEstilos: vi.fn(async () => ({ dados: [], erro: null })),
    lerEstiloMeuPerfil: vi.fn(async () => ({
      dados: { estilo_pagina: "gastronomia" },
      erro: null,
    })),
    lerEstiloPublico: vi.fn(async () => ({ dados: { estilo_pagina: "gastronomia" }, erro: null })),
    definirEstilo: vi.fn(async () => ok),
    definirEstiloHabilitado: vi.fn(async () => ok),
    gravarBanners: vi.fn(async () => ({ dados: B, erro: null })),
    responderBanner: vi.fn(async () => ok),
    definirBannerAtivo: vi.fn(async () => ok),
    adicionarBannerAdmin: vi.fn(async () => ({ dados: B, erro: null })),
    removerBannerAdmin: vi.fn(async () => ok),
    listarBannersPublicos: vi.fn(async () => ({ dados: [], erro: null })),
    listarBannersAguardandoAceite: vi.fn(async () => ({ dados: [], erro: null })),
    listarBannersAdmin: vi.fn(async () => ({ dados: [], erro: null })),
    listarBannersDoPerfil: vi.fn(async () => ({ dados: [], erro: null })),
    ...sobre,
  };
  return base as unknown as ClienteBancoAparencia & typeof base;
}
const banner = (o = {}) => ({ imagem_path: IMG, texto_alternativo: "Fachada", ...o });

describe("estilo (IM-091, IM-094)", () => {
  it("lista estilos em ordem", async () => {
    const b = banco({
      listarEstilos: async () => ({
        dados: [
          { id: "bb", rotulo: "B", ordem: 2, habilitado: false },
          { id: "aa", rotulo: "A", ordem: 1, habilitado: true },
        ],
        erro: null,
      }),
    });
    const r = await criarServicoAparencia(b).listarEstilos();
    expect(r.ok && r.valor.map((e) => e.id)).toEqual(["aa", "bb"]);
  });
  it("define estilo válido", async () => {
    const b = banco();
    const r = await criarServicoAparencia(b).definirEstilo({ perfilId: P, estilo: "gastronomia" });
    expect(r.ok).toBe(true);
    expect(b.definirEstilo).toHaveBeenCalledWith({ perfilId: P, estilo: "gastronomia" });
  });
  it("estilo malformado nem chega ao banco", async () => {
    const b = banco();
    for (const estilo of ["", "Gastro nomia", "x'; drop", 5]) {
      const r = await criarServicoAparencia(b).definirEstilo({ perfilId: P, estilo });
      expect(r.ok).toBe(false);
    }
    expect(b.definirEstilo).not.toHaveBeenCalled();
  });
  it("estilo desabilitado (22023) vira mensagem neutra", async () => {
    const b = banco({ definirEstilo: async () => err("22023") });
    const r = await criarServicoAparencia(b).definirEstilo({ perfilId: P, estilo: "oficina" });
    expect(!r.ok && r.erro.codigo).toBe("ESTILO_INDISPONIVEL");
    expect(JSON.stringify(r)).not.toContain("segredo-interno");
  });
  it("sem login, perfil alheio ou conta suspensa (42501) respondem igual", async () => {
    const b = banco({ definirEstilo: async () => err("42501") });
    const r = await criarServicoAparencia(b).definirEstilo({ perfilId: P, estilo: "gastronomia" });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
  });
  it("habilitar estilo exige motivo", async () => {
    const b = banco();
    const s = criarServicoAparencia(b);
    const sem = await s.definirEstiloHabilitado({
      estilo: "oficina",
      habilitado: true,
      motivo: " ",
    });
    expect(sem.ok).toBe(false);
    const com = await s.definirEstiloHabilitado({
      estilo: "oficina",
      habilitado: true,
      motivo: "Liberado",
    });
    expect(com.ok).toBe(true);
    expect(b.definirEstiloHabilitado).toHaveBeenCalledTimes(1);
  });
  it("não-administrador (42501) não habilita", async () => {
    const b = banco({ definirEstiloHabilitado: async () => err("42501") });
    const r = await criarServicoAparencia(b).definirEstiloHabilitado({
      estilo: "oficina",
      habilitado: true,
      motivo: "x",
    });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
  });
  it("leitura do dono: alheio = não encontrado; público cai no padrão", async () => {
    const s = criarServicoAparencia(
      banco({ lerEstiloMeuPerfil: async () => ({ dados: null, erro: null }) }),
    );
    const r = await s.estiloDoMeuPerfil(P);
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
    const p = await criarServicoAparencia(
      banco({ lerEstiloPublico: async () => ({ dados: null, erro: null }) }),
    ).estiloPublico("x");
    expect(p.ok && p.valor.estilo).toBe("minimalista");
  });
  it("estiloEfetivo: queda segura", () => {
    expect(estiloEfetivo(null)).toBe("minimalista");
    expect(estiloEfetivo("oficina", ["minimalista"])).toBe("minimalista");
    expect(estiloEfetivo("gastronomia", ["gastronomia"])).toBe("gastronomia");
  });
});

describe("banners do responsável (IM-093)", () => {
  it("grava com ordem e ativo padrão e devolve a versão", async () => {
    const b = banco();
    const r = await criarServicoAparencia(b).gravarBanners(P, [
      banner(),
      banner({ imagem_path: `perfil/${P}/b.png`, destino_secao: "contato" }),
    ]);
    expect(r.ok && r.valor.versaoId).toBe(B);
    const enviado = (
      (b.gravarBanners as unknown as { mock: { calls: unknown[] } }).mock.calls[0] as [
        { banners: Record<string, unknown>[] },
      ]
    )[0].banners;
    expect(enviado.map((x) => x.ordem)).toEqual([1, 2]);
    expect(enviado[0]!.ativo).toBe(true);
    expect(enviado[0]!.destino_secao).toBeNull();
  });
  it("7º banner é recusado sem ir ao banco", async () => {
    const b = banco();
    const lista = Array.from({ length: 7 }, (_, i) =>
      banner({ imagem_path: `perfil/${P}/i${i}.jpg` }),
    );
    const r = await criarServicoAparencia(b).gravarBanners(P, lista);
    expect(r.ok).toBe(false);
    expect(b.gravarBanners).not.toHaveBeenCalled();
  });
  it("6 banners passam", async () => {
    const lista = Array.from({ length: 6 }, (_, i) =>
      banner({ imagem_path: `perfil/${P}/i${i}.jpg` }),
    );
    expect((await criarServicoAparencia(banco()).gravarBanners(P, lista)).ok).toBe(true);
  });
  it.each(["https://site.com", "http://x.com/a", "instagram", "", "Contato", "//x"])(
    "destino inválido/externo %s",
    async (d) => {
      const b = banco();
      const r = await criarServicoAparencia(b).gravarBanners(P, [banner({ destino_secao: d })]);
      expect(r.ok).toBe(false);
      expect(b.gravarBanners).not.toHaveBeenCalled();
    },
  );
  it("texto alternativo obrigatório e até 200", async () => {
    const s = criarServicoAparencia(banco());
    expect((await s.gravarBanners(P, [banner({ texto_alternativo: "  " })])).ok).toBe(false);
    expect((await s.gravarBanners(P, [{ imagem_path: IMG }])).ok).toBe(false);
    expect((await s.gravarBanners(P, [banner({ texto_alternativo: "a".repeat(201) })])).ok).toBe(
      false,
    );
    expect((await s.gravarBanners(P, [banner({ texto_alternativo: "a".repeat(200) })])).ok).toBe(
      true,
    );
  });
  it("imagem de outro perfil, URL, formato ou repetida é recusada", async () => {
    const s = criarServicoAparencia(banco());
    const outro = "33333333-3333-4333-8333-333333333333";
    for (const imagem_path of [
      `perfil/${outro}/a.jpg`,
      "https://x.com/a.jpg",
      `perfil/${P}/a.gif`,
      `perfil/${P}/../a.jpg`,
    ]) {
      expect((await s.gravarBanners(P, [banner({ imagem_path })])).ok).toBe(false);
    }
    expect((await s.gravarBanners(P, [banner(), banner()])).ok).toBe(false);
  });
  it("campos extras (autor, conta) são recusados", async () => {
    const r = await criarServicoAparencia(banco()).gravarBanners(P, [
      banner({ autor_admin_id: B, conta_id: B }),
    ]);
    expect(r.ok).toBe(false);
  });
  it("perfil inválido não chega ao banco", async () => {
    const b = banco();
    expect((await criarServicoAparencia(b).gravarBanners("x", [])).ok).toBe(false);
    expect(b.gravarBanners).not.toHaveBeenCalled();
  });
  it("erros do banco: versão pendente, suspensa, limite, categoria inativa", async () => {
    const cod = async (code: string, message?: string) => {
      const r = await criarServicoAparencia(
        banco({ gravarBanners: async () => err(code, message) }),
      ).gravarBanners(P, []);
      return !r.ok ? r.erro : null;
    };
    expect((await cod("P0001"))?.codigo).toBe("EM_ANALISE");
    expect((await cod("42501"))?.codigo).toBe("SEM_PERMISSAO");
    expect((await cod("23514", "limite de 6 banners"))?.codigo).toBe("LIMITE_BANNERS");
    const cat = await cod("23514", "categoria inativa segredo");
    expect(cat?.codigo).toBe("VALIDACAO");
    expect(JSON.stringify(cat)).not.toContain("segredo");
  });
  it("responder: aceitar sem motivo; recusar exige motivo", async () => {
    const b = banco();
    const s = criarServicoAparencia(b);
    expect((await s.responderBanner({ bannerId: B, aceitar: true })).ok).toBe(true);
    expect(b.responderBanner).toHaveBeenLastCalledWith({
      bannerId: B,
      aceitar: true,
      motivo: null,
    });
    expect((await s.responderBanner({ bannerId: B, aceitar: false })).ok).toBe(false);
    expect((await s.responderBanner({ bannerId: B, aceitar: false, motivo: "   " })).ok).toBe(
      false,
    );
    expect(b.responderBanner).toHaveBeenCalledTimes(1);
    expect(
      (await s.responderBanner({ bannerId: B, aceitar: false, motivo: " Não combina " })).ok,
    ).toBe(true);
    expect(b.responderBanner).toHaveBeenLastCalledWith({
      bannerId: B,
      aceitar: false,
      motivo: "Não combina",
    });
  });
  it("responder banner alheio (42501) e fora do estado (P0001)", async () => {
    let r = await criarServicoAparencia(
      banco({ responderBanner: async () => err("42501") }),
    ).responderBanner({ bannerId: B, aceitar: true });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    r = await criarServicoAparencia(
      banco({ responderBanner: async () => err("P0001") }),
    ).responderBanner({
      bannerId: B,
      aceitar: true,
    });
    expect(!r.ok && r.erro.codigo).toBe("ESTADO_INVALIDO");
  });
  it("ocultar/exibir exige booleano", async () => {
    const s = criarServicoAparencia(banco());
    expect((await s.definirBannerAtivo({ bannerId: B, ativo: false })).ok).toBe(true);
    expect((await s.definirBannerAtivo({ bannerId: B, ativo: "sim" })).ok).toBe(false);
  });
});

describe("banners do administrador (IM-093)", () => {
  const entrada = {
    perfilId: P,
    imagemPath: IMG,
    textoAlternativo: "Promoção",
    motivo: "Campanha",
  };
  it("adiciona com motivo e padrões", async () => {
    const b = banco();
    const r = await criarServicoAparencia(b).adicionarBannerAdmin(entrada);
    expect(r.ok && r.valor.bannerId).toBe(B);
    expect(b.adicionarBannerAdmin).toHaveBeenCalledWith({
      ...entrada,
      ordem: 1,
      destinoSecao: null,
    });
  });
  it("sem motivo, sem alt ou com destino externo: recusa", async () => {
    const b = banco();
    const s = criarServicoAparencia(b);
    expect((await s.adicionarBannerAdmin({ ...entrada, motivo: "" })).ok).toBe(false);
    expect((await s.adicionarBannerAdmin({ ...entrada, textoAlternativo: "" })).ok).toBe(false);
    expect((await s.adicionarBannerAdmin({ ...entrada, destinoSecao: "https://x.com" })).ok).toBe(
      false,
    );
    expect(b.adicionarBannerAdmin).not.toHaveBeenCalled();
  });
  it("sem permissão 'aprovar' (42501) e perfil indisponível (P0002)", async () => {
    let r = await criarServicoAparencia(
      banco({ adicionarBannerAdmin: async () => err("42501") }),
    ).adicionarBannerAdmin(entrada);
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    r = await criarServicoAparencia(
      banco({ adicionarBannerAdmin: async () => err("P0002") }),
    ).adicionarBannerAdmin(entrada);
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
  });
  it("remover exige motivo", async () => {
    const b = banco();
    const s = criarServicoAparencia(b);
    expect((await s.removerBannerAdmin({ bannerId: B, motivo: "" })).ok).toBe(false);
    expect((await s.removerBannerAdmin({ bannerId: B, motivo: "Fora do ar" })).ok).toBe(true);
    expect(b.removerBannerAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("leituras de banner", () => {
  const linha = {
    id: B,
    perfil_id: P,
    imagem_path: IMG,
    texto_alternativo: "x",
    destino_secao: "sobre",
    ordem: 2,
  };
  it("público: ordena, copia campo a campo e não vaza campos privados", async () => {
    const sujo = {
      ...linha,
      autor_admin_id: "seg",
      conta_id: "seg",
      email: "a@b.com",
      telefone: "+5511",
    };
    const b = banco({
      listarBannersPublicos: async () => ({
        dados: [sujo, { ...linha, id: P, ordem: 1 }],
        erro: null,
      }),
    });
    const r = await criarServicoAparencia(b).bannersPublicos(P);
    expect(r.ok && r.valor.map((x) => x.ordem)).toEqual([1, 2]);
    const txt = JSON.stringify(r);
    for (const proibido of ["autor_admin_id", "conta_id", "a@b.com", "+5511", "seg"]) {
      expect(txt).not.toContain(proibido);
    }
  });
  it("destino fora das seções vira nulo; linha incompleta é descartada", async () => {
    const b = banco({
      listarBannersPublicos: async () => ({
        dados: [
          { ...linha, destino_secao: "https://x.com" },
          { ...linha, imagem_path: null },
        ],
        erro: null,
      }),
    });
    const r = await criarServicoAparencia(b).bannersPublicos(P);
    expect(r.ok && r.valor).toHaveLength(1);
    expect(r.ok && r.valor[0]!.destinoSecao).toBeNull();
  });
  it("aguardando aceite e visão do admin", async () => {
    const s = criarServicoAparencia(
      banco({
        listarBannersAguardandoAceite: async () => ({
          dados: [{ ...linha, ativo: true, criado_em: "2026-11-02T10:00:00Z" }],
          erro: null,
        }),
        listarBannersAdmin: async () => ({
          dados: [
            {
              ...linha,
              versao_id: null,
              origem: "administrador",
              situacao: "aguardando_aceite",
              ativo: true,
              motivo_resposta: null,
              respondido_em: null,
              criado_em: null,
            },
          ],
          erro: null,
        }),
      }),
    );
    const a = await s.bannersAguardandoAceite();
    expect(a.ok && a.valor[0]!.criadoEm).toBe("2026-11-02T10:00:00Z");
    const m = await s.bannersDaEmpresa(P);
    expect(m.ok && m.valor[0]!.situacao).toBe("aguardando_aceite");
  });
  it("falha inesperada do banco não vaza texto", async () => {
    const s = criarServicoAparencia(
      banco({
        listarBannersAguardandoAceite: async () => {
          throw new Error("segredo-interno");
        },
      }),
    );
    const r = await s.bannersAguardandoAceite();
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});

describe("bannersDoMeuPerfil (IM-093)", () => {
  it("id inválido nem chega ao banco", async () => {
    const b = banco();
    const r = await criarServicoAparencia(b).bannersDoMeuPerfil("x");
    expect(r.ok).toBe(false);
    expect(b.listarBannersDoPerfil).not.toHaveBeenCalled();
  });
  it("devolve só campos nomeados, sem conta nem autor", async () => {
    const linha = {
      id: B,
      perfil_id: P,
      versao_id: null,
      origem: "responsavel",
      situacao: "aceito",
      imagem_path: IMG,
      texto_alternativo: "Fachada",
      destino_secao: null,
      ordem: 1,
      ativo: true,
      motivo_resposta: null,
      respondido_em: null,
      criado_em: "2026-11-02T10:00:00Z",
      conta_id: "conta-secreta",
      autor_admin_id: "admin-secreto",
    };
    const b = banco({ listarBannersDoPerfil: async () => ({ dados: [linha], erro: null }) });
    const r = await criarServicoAparencia(b).bannersDoMeuPerfil(P);
    expect(r.ok).toBe(true);
    const txt = JSON.stringify(r);
    for (const x of ["conta-secreta", "admin-secreto", "conta_id", "autor_admin"])
      expect(txt).not.toContain(x);
  });
  it("erro do banco vira mensagem neutra", async () => {
    const b = banco({ listarBannersDoPerfil: async () => ({ dados: null, ...err("42501") }) });
    const r = await criarServicoAparencia(b).bannersDoMeuPerfil(P);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("segredo-interno");
  });
});
