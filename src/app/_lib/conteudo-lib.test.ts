import { describe, expect, it, vi } from "vitest";
import { formatarDataHora, motivoParaExibir, nomeDaCategoria } from "./apresentacao";
import { lerCamposItem, lerDeRegistro, lerPreco, listaDeAreas } from "./entrada-conteudo";
import { criarAssinadorImagens } from "./imagens-servidor";
import { deErro, normalizarErros } from "./resposta";
import {
  validarAlteracaoCategoria,
  validarDecisaoRevisao,
  validarDecisaoSolicitacao,
  validarEdicaoItem,
  validarEdicaoPerfil,
  validarNovoItem,
  validarNovoPerfil,
  validarSolicitacaoCategoria,
} from "./validacao-conteudo";
import { valoresIniciaisItem, valoresIniciaisPerfil } from "./valores-iniciais";

const UUID = "3f8a7c1e-5b2d-4e9a-8c6f-1a2b3c4d5e6f";
const perfilValido = {
  nome: "Padaria",
  descricaoBreve: "Pães.",
  cidade: "Canoas",
  uf: "RS",
  whatsappComercial: "(51) 98123-7661",
  categoriaPrincipalId: UUID,
};

describe("entrada dos formulários", () => {
  it("preço em R$ pt-BR vira centavos; vazio é sem preço; sob consulta não leva valor", () => {
    expect(lerPreco(lerDeRegistro({ precoModo: "fixo", precoValor: "R$ 1.234,50" }))).toEqual({
      modo: "fixo",
      centavos: 123450,
    });
    expect(lerPreco(lerDeRegistro({ precoModo: "" }))).toBeNull();
    expect(lerPreco(lerDeRegistro({ precoModo: "sob_consulta", precoValor: "5" }))).toEqual({
      modo: "sob_consulta",
      centavos: null,
    });
    expect(
      lerCamposItem(lerDeRegistro({ nome: "x", precoModo: "fixo", precoValor: "1,234" })),
    ).toMatchObject({
      preco: { modo: "fixo", centavos: Number.NaN },
    });
  });

  it("áreas atendidas separadas por vírgula, ponto e vírgula ou linha", () => {
    expect(listaDeAreas("Centro, Zona Sul;Canoas\n  Esteio ,")).toEqual([
      "Centro",
      "Zona Sul",
      "Canoas",
      "Esteio",
    ]);
  });
});

describe("validação no navegador com os schemas dos módulos", () => {
  it("novo perfil: campos obrigatórios e mensagens em português", () => {
    expect(validarNovoPerfil(perfilValido)).toBeNull();
    const e = validarNovoPerfil({ ...perfilValido, whatsappComercial: "", uf: "ZZ", nome: "" });
    expect(e?.whatsappComercial).toBe("Informe o WhatsApp comercial.");
    expect(e?.uf).toBe("Escolha uma UF válida.");
    expect(validarNovoPerfil({ ...perfilValido, nome: "" })?.nome).toBe(
      "Informe o nome do perfil.",
    );
  });

  it("perfil: informações sociais só texto e erros de lista caem no campo certo", () => {
    expect(
      validarEdicaoPerfil({ ...perfilValido, informacoesSociais: "https://x.com/a" })
        ?.informacoesSociais,
    ).toMatch(/apenas texto/);
    expect(
      validarEdicaoPerfil({ ...perfilValido, categoriaSecundaria1: UUID })
        ?.categoriasSecundariasIds,
    ).toBe("Não repita a mesma categoria.");
    expect(validarEdicaoPerfil({ ...perfilValido, whatsappComercial: "" })?.whatsappComercial).toBe(
      "Informe o WhatsApp comercial.",
    );
  });

  it("item: preço inválido aparece no campo de valor; item de perfil exige perfil", () => {
    const base = {
      tipo: "produto",
      nome: "Bike",
      descricao: "Boa",
      categoriaPrincipalId: UUID,
      cidade: "Porto Alegre",
      uf: "RS",
    };
    expect(validarNovoItem({ ...base, origem: "anuncio" })).toBeNull();
    // Anúncio particular exige cidade e UF (D-008); item de perfil não pede (herda do perfil).
    expect(validarNovoItem({ ...base, origem: "anuncio", cidade: "" })?.cidade).toMatch(
      /^Informe a cidade/,
    );
    expect(validarNovoItem({ ...base, origem: "anuncio", uf: "" })?.uf).toBe("Escolha a UF.");
    expect(validarNovoItem({ ...base, origem: "anuncio", uf: "XX" })?.uf).toBeTruthy();
    expect(
      validarNovoItem({ ...base, origem: "perfil", perfilId: UUID, cidade: "", uf: "" }),
    ).toBeNull();
    expect(validarNovoItem({ ...base, origem: "perfil", perfilId: "", cidade: "" })).toEqual({
      perfilId: "Escolha o perfil do item.",
    });
    expect(
      validarNovoItem({ ...base, origem: "anuncio", precoModo: "fixo", precoValor: "x" })
        ?.precoValor,
    ).toMatch(/^Informe um valor entre R\$ 0,01 e R\$/);
    expect(validarNovoItem({ ...base, origem: "perfil", perfilId: "" })?.perfilId).toBe(
      "Escolha o perfil do item.",
    );
    expect(validarNovoItem({ ...base, tipo: "", origem: "anuncio" })?.tipo).toBeTruthy();
    expect(
      validarEdicaoItem({ ...base, categoriaSecundaria1: UUID })?.categoriasSecundariasIds,
    ).toBe("Não repita a mesma categoria.");
  });

  it("categorias e revisão: motivo obrigatório onde o módulo exige", () => {
    expect(validarSolicitacaoCategoria({ nome: "a" })?.nome).toMatch(/de 2 a 60/);
    expect(
      validarDecisaoRevisao({ decisao: "aprovar", alvo: "perfil", versaoId: UUID }),
    ).toBeNull();
    expect(
      validarDecisaoRevisao({ decisao: "rejeitar", alvo: "perfil", versaoId: UUID, motivo: " " })
        ?.motivo,
    ).toBe("Informe o motivo da rejeição.");
    expect(validarDecisaoSolicitacao({ decisao: "atender", id: UUID })?.categoriaId).toBeTruthy();
    expect(
      validarDecisaoSolicitacao({ decisao: "atender", id: UUID, categoriaId: UUID }),
    ).toBeNull();
    expect(validarDecisaoSolicitacao({ decisao: "recusar", id: UUID })?.motivo).toBe(
      "Informe o motivo.",
    );
    expect(
      validarAlteracaoCategoria({ id: UUID, nome: "Pets", ativa: "nao", ordem: "1", motivo: "" })
        ?.motivo,
    ).toBe("Informe o motivo.");
  });
});

describe("resposta e apresentação", () => {
  it("normaliza chaves de erro e nunca mistura texto de banco", () => {
    expect(
      normalizarErros({ "preco.centavos": "a", "categoriasSecundariasIds.1": "b", nome: "c" }),
    ).toEqual({
      precoValor: "a",
      categoriasSecundariasIds: "b",
      nome: "c",
    });
    expect(deErro({ mensagem: "Incompleto.", pendencias: ["Falta A.", "Falta B."] })).toEqual({
      erro: "Incompleto. Falta A. Falta B.",
      valores: undefined,
    });
  });

  it("data no fuso de Brasília e categoria que sumiu da lista", () => {
    expect(formatarDataHora("2026-10-23T15:30:00Z")).toBe("23/10/2026 12:30");
    expect(formatarDataHora(null)).toBe("");
    expect(nomeDaCategoria(UUID, [{ id: UUID, nome: "Alimentação" }])).toBe("Alimentação");
    expect(nomeDaCategoria(UUID, [])).toBe("Categoria indisponível");
  });

  it("valores iniciais: WhatsApp com máscara e preço sem o símbolo R$", () => {
    const v = valoresIniciaisPerfil({
      nome: "P",
      descricaoBreve: null,
      imagemPath: null,
      categoriaPrincipalId: UUID,
      categoriasSecundariasIds: [],
      cidade: "Canoas",
      uf: "RS",
      endereco: null,
      areasAtendidas: ["Centro", "Sul"],
      bannersPaths: [],
      fotosPaths: [],
      site: null,
      informacoesSociais: null,
      whatsappComercialE164: "+5551981237661",
    });
    expect(v.whatsappComercial).toBe("(51) 98123-7661");
    expect(v.areasAtendidas).toBe("Centro, Sul");
    const i = valoresIniciaisItem({
      nome: "B",
      descricao: null,
      fotoPath: null,
      categoriaPrincipalId: null,
      categoriasSecundariasIds: [],
      preco: { modo: "a_partir_de", centavos: 125050 },
    });
    expect(i).toMatchObject({ precoModo: "a_partir_de", precoValor: "1.250,50" });
  });
});

describe("URL assinada das imagens (IM-029, IM-086)", () => {
  const caminho = `perfil/${UUID}/${UUID}.webp`;

  it("devolve só caminho -> URL, ignora caminho fora do formato e não repassa metadados", async () => {
    const createSignedUrls = vi.fn(async (c: string[]) => ({
      data: c.map((path) => ({
        path,
        signedUrl: `https://s.exemplo/${path}?token=t`,
        error: null,
        owner: "conta-secreta",
        owner_id: "conta-secreta",
      })),
      error: null,
    }));
    const supabase = { storage: { from: vi.fn(() => ({ createSignedUrls })) } };
    const assinar = criarAssinadorImagens(supabase as never);
    const r = await assinar([caminho, caminho, "../outra-coisa.png", "perfil/x/y.exe"]);
    expect(supabase.storage.from).toHaveBeenCalledWith("indicamais-imagens");
    expect(createSignedUrls).toHaveBeenCalledWith([caminho], 3600);
    expect(r).toEqual({ [caminho]: `https://s.exemplo/${caminho}?token=t` });
    expect(JSON.stringify(r)).not.toMatch(/owner|conta-secreta/);
  });

  it("falha do Storage vira lista vazia, sem texto de erro", async () => {
    const supabase = {
      storage: {
        from: () => ({ createSignedUrls: async () => ({ data: null, error: { message: "x" } }) }),
      },
    };
    expect(await criarAssinadorImagens(supabase as never)([caminho])).toEqual({});
  });
});

describe("motivoParaExibir", () => {
  it("acrescenta ponto final quando o motivo não termina em pontuação", () => {
    expect(motivoParaExibir("foto desfocada")).toBe("foto desfocada.");
  });
  it("não duplica pontuação existente", () => {
    expect(motivoParaExibir("foto desfocada.")).toBe("foto desfocada.");
    expect(motivoParaExibir("Foto desfocada!")).toBe("Foto desfocada!");
  });
  it("normaliza espaços e quebras de linha", () => {
    expect(motivoParaExibir("  foto \n desfocada  ")).toBe("foto desfocada.");
  });
  it("devolve null para motivo vazio", () => {
    expect(motivoParaExibir("   ")).toBeNull();
    expect(motivoParaExibir(null)).toBeNull();
  });
  it("mantém motivo longo inteiro e como texto puro", () => {
    const longo = "<b>x</b> ".repeat(100).trim();
    expect(motivoParaExibir(longo)).toBe(`${longo}.`);
  });
});
