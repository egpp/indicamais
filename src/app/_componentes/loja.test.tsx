// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { imovelParaExibicao, type ConteudoItem, type ItemExibicao } from "@/modules/catalogo";

const acaoLoja = vi.fn(async () => ({}));
vi.mock("../acoes-loja", () => ({
  acaoDefinirLiberacaoLoja: (...a: unknown[]) => acaoLoja(...(a as [])),
}));
vi.mock("../acoes-conteudo", () => ({
  acaoCriarItem: vi.fn(async () => ({})),
  acaoEditarItem: vi.fn(async () => ({})),
  acaoSalvarFotoItem: vi.fn(async () => ({})),
  acaoSalvarFotosExtrasItem: vi.fn(async () => ({})),
}));

import { FormFotosExtrasItem, FormNovoItem } from "./form-item";
import { FormLiberacaoLoja } from "./form-loja-admin";
import { DetalhesImovel, FiltrosImoveis, GaleriaFotos } from "./loja";
import { chipsDoImovel, dadosDeItem } from "./publico";
import { lerCamposItem, lerDeRegistro, lerReaisExtra } from "../_lib/entrada-conteudo";
import { validarNovoItem } from "../_lib/validacao-conteudo";
import { valoresIniciaisItem } from "../_lib/valores-iniciais";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const VAZIO: ConteudoItem = {
  nome: null,
  descricao: null,
  fotoPath: null,
  categoriaPrincipalId: null,
  categoriasSecundariasIds: [],
  preco: null,
};

const imovel = imovelParaExibicao(
  {
    imovelTipo: "apartamento",
    finalidade: "aluguel",
    areaM2: 85.5,
    quartos: 3,
    banheiros: 1,
    vagas: 2,
    bairro: "Centro",
    condominioCentavos: 45000,
    iptuCentavos: 0,
    aceitaFinanciamento: false,
  },
  "Marília",
  "SP",
);

describe("chips e cartão do imóvel (IM-098)", () => {
  it("resume quartos, banheiros, vagas e área em português, com singular e plural", () => {
    expect(chipsDoImovel(imovel)).toEqual(["3 quartos", "1 banheiro", "2 vagas", "85,5 m²"]);
    expect(chipsDoImovel(null)).toEqual([]);
  });

  it("dadosDeItem do imóvel mostra só bairro e cidade e o preço de aluguel por mês", () => {
    const dados = dadosDeItem(
      {
        id: "i1",
        perfilId: "p1",
        anuncioParticular: false,
        tipo: "imovel",
        nome: "Apto centro",
        descricao: null,
        fotoPath: null,
        categoriaPrincipalId: null,
        categoriasSecundariasIds: [],
        preco: { modo: "fixo", centavos: 250000 },
        cidade: "Marília",
        uf: "SP",
        precoTexto: "R$ 2.500,00 por mês",
        imovel,
        fotosExtrasPaths: [],
      } as ItemExibicao,
      [],
      "Outra cidade - RJ",
    );
    expect(dados.rotuloTipo).toBe("Apartamento · Aluguel");
    expect(dados.local).toBe("Centro, Marília/SP");
    expect(dados.precoTexto).toContain("por mês");
    expect(dados.chips).toHaveLength(4);
  });
});

describe("detalhes e galeria", () => {
  it("lista os dados do imóvel e trata 0 como valor (IPTU R$ 0,00), sem endereço", () => {
    render(<DetalhesImovel imovel={imovel} />);
    const lista = screen.getByLabelText("Dados do imóvel");
    expect(within(lista).getByText("Centro, Marília/SP")).toBeTruthy();
    expect(within(lista).getByText(/^R\$\s0,00$/)).toBeTruthy();
    expect(within(lista).getByText("Não aceita financiamento")).toBeTruthy();
    expect(within(lista).queryByText(/endereço|rua /i)).toBeNull();
  });

  it("galeria mostra só fotos com URL assinada e alt descritivo", () => {
    render(
      <GaleriaFotos nome="Apto" caminhos={["a", "b"]} urls={{ a: "https://exemplo/a.webp" }} />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByAltText("Foto 2 de Apto")).toBeTruthy();
  });
});

describe("filtros dos imóveis do site", () => {
  it("tem rótulos, preserva ?ind e mostra o erro do preço", () => {
    render(
      <FiltrosImoveis
        slug="minha-imobiliaria"
        valores={{ finalidade: "venda", imovelTipo: "", quartos: "2", precoMax: "abc" }}
        preservar={{ ind: "ABC123" }}
        erro="Informe o preço máximo em reais."
      />,
    );
    for (const r of ["Finalidade", "Tipo de imóvel", "Quartos (mínimo)", "Preço máximo (R$)"])
      expect(screen.getByLabelText(r)).toBeTruthy();
    expect((screen.getByLabelText("Finalidade") as HTMLSelectElement).value).toBe("venda");
    expect(screen.getByLabelText("Preço máximo (R$)").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Informe o preço máximo em reais.")).toBeTruthy();
    const form = screen.getByRole("search", { name: "Filtrar imóveis" });
    expect(form.getAttribute("method")).toBe("get");
    expect(form.querySelector('input[name="ind"]')?.getAttribute("value")).toBe("ABC123");
  });
});

describe("leitura do formulário de imóvel", () => {
  it("lerReaisExtra: vazio é null, 0 vale 0 centavos, valor vira centavos, lixo vira NaN", () => {
    expect(lerReaisExtra("")).toBeNull();
    expect(lerReaisExtra("0")).toBe(0);
    expect(lerReaisExtra("0,00")).toBe(0);
    expect(lerReaisExtra("R$ 450,00")).toBe(45000);
    expect(lerReaisExtra("1.250,5")).toBe(125050);
    expect(Number.isNaN(lerReaisExtra("abc"))).toBe(true);
  });

  it("só envia campos de imóvel (e cidade/UF) quando o tipo é imóvel", () => {
    const dados = {
      tipo: "imovel",
      origem: "perfil",
      nome: "Casa",
      imovelTipo: "casa",
      quartos: "3",
      condominio: "0",
      cidade: "Marília",
      uf: "SP",
    };
    const imv = lerCamposItem(lerDeRegistro(dados)) as Record<string, unknown>;
    expect(imv.imovelTipo).toBe("casa");
    expect(imv.condominioCentavos).toBe(0);
    expect(imv.cidade).toBe("Marília");
    const prod = lerCamposItem(lerDeRegistro({ ...dados, tipo: "produto" })) as Record<
      string,
      unknown
    >;
    expect("imovelTipo" in prod).toBe(false);
    expect("cidade" in prod).toBe(false);
  });

  it("valida no navegador com o schema do módulo e traduz os erros", () => {
    const erros = validarNovoItem({
      tipo: "imovel",
      origem: "perfil",
      perfilId: "11111111-1111-4111-8111-111111111111",
      nome: "Casa",
      quartos: "muitos",
      areaM2: "0",
      condominio: "abc",
    });
    expect(erros?.quartos).toMatch(/número de 0 a/);
    expect(erros?.areaM2).toMatch(/área em m²/);
    expect(erros?.condominioCentavos).toMatch(/R\$ 0,00/);
  });

  it("valores iniciais do imóvel viram texto de formulário", () => {
    const v = valoresIniciaisItem({
      ...VAZIO,
      areaM2: 85.5,
      quartos: 0,
      condominioCentavos: 0,
      iptuCentavos: 12000,
      aceitaFinanciamento: true,
    });
    expect(v.areaM2).toBe("85,5");
    expect(v.quartos).toBe("0");
    expect(v.condominio).toBe("0,00");
    expect(v.iptu).toBe("120,00");
    expect(v.aceitaFinanciamento).toBe("true");
  });
});

describe("cadastro de item com e sem a Loja (IM-097, IM-099)", () => {
  const perfis = [
    { id: "p-com", nome: "Com Loja" },
    { id: "p-sem", nome: "Sem Loja" },
  ];

  it("sem a Loja: não oferece Imóvel nem campos de imóvel e mostra texto neutro", async () => {
    const u = userEvent.setup();
    render(
      <FormNovoItem origem="perfil" categorias={[]} perfis={perfis} perfisComLoja={["p-com"]} />,
    );
    await u.selectOptions(screen.getByLabelText("Site"), "p-sem");
    expect(screen.queryByRole("option", { name: "Imóvel" })).toBeNull();
    expect(screen.queryByLabelText("Tipo do imóvel")).toBeNull();
    expect(screen.getByText("Loja não liberada para este site.")).toBeTruthy();
    expect(screen.queryByText(/plano|R\$ \d+.*mês/i)).toBeNull();
  });

  it("com a Loja: Imóvel mostra os campos, em português, e trocar para site sem Loja os esconde", async () => {
    const u = userEvent.setup();
    render(
      <FormNovoItem origem="perfil" categorias={[]} perfis={perfis} perfisComLoja={["p-com"]} />,
    );
    await u.selectOptions(screen.getByLabelText("Site"), "p-com");
    await u.selectOptions(screen.getByLabelText("Tipo"), "imovel");
    for (const r of [
      "Tipo do imóvel",
      "Finalidade",
      "Área (m²)",
      "Quartos",
      "Banheiros",
      "Vagas",
      "Bairro",
      "Cidade",
      "UF",
    ])
      expect(screen.getByLabelText(r)).toBeTruthy();
    expect(screen.getByLabelText(/Condomínio/)).toBeTruthy();
    expect(screen.getByLabelText(/IPTU/)).toBeTruthy();
    expect(screen.getByLabelText(/Aceita financiamento/)).toBeTruthy();
    expect(screen.queryByLabelText(/endereço/i)).toBeNull();
    await u.selectOptions(screen.getByLabelText("Site"), "p-sem");
    expect(screen.queryByLabelText("Tipo do imóvel")).toBeNull();
  });

  it("fotos adicionais: até 8, rótulo claro", () => {
    render(<FormFotosExtrasItem itemId="11111111-1111-4111-8111-111111111111" fotos={[]} />);
    expect(screen.getByText("Fotos adicionais")).toBeTruthy();
    expect(screen.getByText(/Até 8 fotos/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar fotos adicionais" })).toBeTruthy();
  });
});

describe("liberação da Loja pelo administrador", () => {
  it("exige o motivo e não chama o servidor sem ele", async () => {
    const u = userEvent.setup();
    render(
      <FormLiberacaoLoja
        perfilId="11111111-1111-4111-8111-111111111111"
        nome="Imobiliária X"
        liberada={false}
      />,
    );
    await u.click(screen.getByRole("button", { name: "Liberar a Loja" }));
    expect(await screen.findByText("Informe o motivo.")).toBeTruthy();
    expect(acaoLoja).not.toHaveBeenCalled();
  });

  it("site com a Loja liberada oferece retirar; com motivo, envia uma vez", async () => {
    const u = userEvent.setup();
    render(
      <FormLiberacaoLoja
        perfilId="11111111-1111-4111-8111-111111111111"
        nome="Imobiliária X"
        liberada
      />,
    );
    await u.type(screen.getByLabelText(/Motivo para retirar a Loja/), "Fim do teste");
    await u.click(screen.getByRole("button", { name: "Retirar a Loja" }));
    await vi.waitFor(() => expect(acaoLoja).toHaveBeenCalledTimes(1));
  });
});
