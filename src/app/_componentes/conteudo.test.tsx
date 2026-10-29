// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const acaoLenta = vi.fn(
  () => new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 200)),
);
const vazia = vi.fn(async () => ({}));

vi.mock("../acoes-conteudo", () => ({
  acaoCriarPerfil: (...a: unknown[]) => acaoLenta(...(a as [])),
  acaoEditarPerfil: (...a: unknown[]) => vazia(...(a as [])),
  acaoSalvarImagensPerfil: (...a: unknown[]) => acaoLenta(...(a as [])),
  acaoAlterarEnderecoPerfil: (...a: unknown[]) => vazia(...(a as [])),
  acaoCriarItem: (...a: unknown[]) => acaoLenta(...(a as [])),
  acaoEditarItem: (...a: unknown[]) => vazia(...(a as [])),
  acaoSalvarFotoItem: (...a: unknown[]) => vazia(...(a as [])),
  acaoSolicitarCategoria: (...a: unknown[]) => vazia(...(a as [])),
  acaoDecidirRevisao: (...a: unknown[]) => vazia(...(a as [])),
  acaoCriarCategoria: (...a: unknown[]) => vazia(...(a as [])),
  acaoAlterarCategoria: (...a: unknown[]) => vazia(...(a as [])),
  acaoDecidirSolicitacao: (...a: unknown[]) => vazia(...(a as [])),
}));

import { FormDecidirRevisao } from "./form-administracao";
import { FormNovoItem } from "./form-item";
import { FormImagensPerfil, FormNovoPerfil } from "./form-perfil";
import { GerenciadorImagens } from "./gerenciador-imagens";

const PERFIL = "3f8a7c1e-5b2d-4e9a-8c6f-1a2b3c4d5e6f";
const CATEGORIAS = [
  { id: "11111111-1111-4111-8111-111111111111", nome: "Alimentação" },
  { id: "22222222-2222-4222-8222-222222222222", nome: "Tecnologia" },
];
const arquivo = (nome: string, tipo: string, bytes = 1000) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });
const usuario = () => userEvent.setup({ applyAccept: false });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GerenciadorImagens (D-006: 2 MB, jpeg/png/webp, envio direto ao Storage)", () => {
  const props = {
    nome: "fotosPaths",
    rotulo: "Fotos",
    pasta: "perfil" as const,
    donoId: PERFIL,
    limite: 6,
    inicial: [],
  };
  const semCompressao = async (b: Blob) => b;

  it("envia ao Storage na pasta do perfil e guarda só o caminho no formulário", async () => {
    const enviar = vi.fn(async () => true);
    const { container } = render(
      <form>
        <GerenciadorImagens {...props} enviar={enviar} comprimir={semCompressao} />
      </form>,
    );
    await usuario().upload(
      screen.getByLabelText("Adicionar imagens"),
      arquivo("a.webp", "image/webp"),
    );
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    const [caminho, , tipo] = enviar.mock.calls[0] as unknown as [string, Blob, string];
    expect(caminho).toMatch(new RegExp(`^perfil/${PERFIL}/[0-9a-f-]{36}\\.webp$`));
    expect(tipo).toBe("image/webp");
    const escondido = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="fotosPaths"]',
    );
    await waitFor(() =>
      expect(escondido ?? container.querySelector('input[type="hidden"]')).toBeTruthy(),
    );
    const valores = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map(
      (i) => i.value,
    );
    expect(valores).toEqual([caminho]);
    expect(valores.join()).not.toMatch(/https?:/);
  });

  it("recusa tipo fora de jpeg/png/webp e arquivo maior que 2 MB, sem enviar", async () => {
    const enviar = vi.fn(async () => true);
    render(<GerenciadorImagens {...props} enviar={enviar} comprimir={semCompressao} />);
    const campo = screen.getByLabelText("Adicionar imagens");
    const u = usuario();
    await u.upload(campo, arquivo("a.gif", "image/gif"));
    expect(await screen.findByText(/Use uma imagem JPEG, PNG ou WebP/)).toBeTruthy();
    await u.upload(campo, arquivo("grande.png", "image/png", 2 * 1024 * 1024 + 1));
    expect(await screen.findByText(/no máximo 2 MB/)).toBeTruthy();
    expect(enviar).not.toHaveBeenCalled();
  });

  it("falha no Storage mostra mensagem genérica e não guarda caminho", async () => {
    const enviar = vi.fn(async () => false);
    const { container } = render(
      <GerenciadorImagens {...props} enviar={enviar} comprimir={semCompressao} />,
    );
    await usuario().upload(
      screen.getByLabelText("Adicionar imagens"),
      arquivo("a.jpg", "image/jpeg"),
    );
    expect(await screen.findByText(/Não foi possível enviar a imagem/)).toBeTruthy();
    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
  });

  it("respeita o limite e permite remover", async () => {
    const um = `perfil/${PERFIL}/${PERFIL}.webp`;
    const { container } = render(
      <GerenciadorImagens
        {...props}
        limite={1}
        inicial={[{ caminho: um, url: "https://s.exemplo/a" }]}
        enviar={async () => true}
        comprimir={semCompressao}
      />,
    );
    expect(screen.getByText(/Limite de 1 atingido/)).toBeTruthy();
    expect(screen.queryByLabelText("Escolher imagem")).toBeNull();
    await usuario().click(screen.getByRole("button", { name: /Remover fotos, imagem 1/ }));
    // Imagem única removida: o campo escondido vai vazio para limpar no servidor.
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')?.value).toBe("");
    expect(screen.getByLabelText("Escolher imagem")).toBeTruthy();
  });

  it("avisa que está ocupado durante o envio", async () => {
    let liberar: (v: boolean) => void = () => {};
    const enviar = vi.fn(() => new Promise<boolean>((r) => (liberar = r)));
    const ocupado = vi.fn();
    render(
      <GerenciadorImagens
        {...props}
        enviar={enviar}
        comprimir={semCompressao}
        onOcupado={ocupado}
      />,
    );
    await usuario().upload(
      screen.getByLabelText("Adicionar imagens"),
      arquivo("a.jpg", "image/jpeg"),
    );
    await waitFor(() => expect(ocupado).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole("status").textContent).toMatch(/Enviando imagem/);
    liberar(true);
    await waitFor(() => expect(ocupado).toHaveBeenLastCalledWith(false));
  });
});

describe("FormImagensPerfil", () => {
  it("tem campos de imagem, banners (até 3) e fotos (até 6) com rótulos", () => {
    render(<FormImagensPerfil perfilId={PERFIL} imagem={[]} banners={[]} fotos={[]} />);
    expect(screen.getByText("Imagem do perfil")).toBeTruthy();
    expect(screen.getByText("Banners")).toBeTruthy();
    expect(screen.getByText("Fotos")).toBeTruthy();
    expect(screen.getByText(/Opcional\. Até 3\./)).toBeTruthy();
    expect(screen.getByText(/Opcional\. Até 6\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar imagens" })).toBeTruthy();
  });
});

describe("FormNovoPerfil", () => {
  it("rótulos em português, WhatsApp comercial obrigatório e informações sociais só texto", () => {
    render(<FormNovoPerfil categorias={CATEGORIAS} />);
    for (const r of ["Nome do perfil", "Descrição breve", "Cidade", "UF", "WhatsApp comercial"]) {
      expect(screen.getByLabelText(new RegExp(`^${r}`))).toBeTruthy();
    }
    expect(screen.getByLabelText(/Categoria principal/)).toBeTruthy();
    expect(screen.getByLabelText(/Categoria secundária 1/)).toBeTruthy();
    expect(screen.getByLabelText(/Categoria secundária 2/)).toBeTruthy();
    expect(screen.queryByLabelText(/Categoria secundária 3/)).toBeNull();
    expect(screen.getByText(/Somente texto: sem links nem @/)).toBeTruthy();
    expect(screen.getByLabelText(/WhatsApp comercial/).getAttribute("placeholder")).toBe(
      "(11) 99999-0001",
    );
    // Futuros e fora de escopo não aparecem.
    expect(screen.queryByText(/curtir|indicar|mapa|pontos/i)).toBeNull();
  });

  it("aplica a máscara brasileira no WhatsApp ao digitar", async () => {
    render(<FormNovoPerfil categorias={CATEGORIAS} />);
    const campo = screen.getByLabelText(/WhatsApp comercial/) as HTMLInputElement;
    await usuario().type(campo, "51981237661");
    expect(campo.value).toBe("(51) 98123-7661");
  });

  it("valida no navegador com o schema do módulo e não envia", async () => {
    render(<FormNovoPerfil categorias={CATEGORIAS} />);
    await usuario().click(screen.getByRole("button", { name: "Criar rascunho" }));
    expect(await screen.findByText("Informe o nome do perfil.")).toBeTruthy();
    expect(screen.getByText("Informe o WhatsApp comercial.")).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/WhatsApp comercial/).getAttribute("aria-invalid")).toBe("true");
  });

  it("trava o botão durante o envio (IM-028)", async () => {
    const u = usuario();
    render(<FormNovoPerfil categorias={CATEGORIAS} />);
    await u.type(screen.getByLabelText(/^Nome do perfil/), "Padaria");
    await u.type(screen.getByLabelText(/^Cidade/), "Canoas");
    await u.selectOptions(screen.getByLabelText(/^UF/), "RS");
    await u.type(screen.getByLabelText(/WhatsApp comercial/), "51981237661");
    await u.click(screen.getByRole("button", { name: "Criar rascunho" }));
    const botao = await screen.findByRole("button", { name: "Criando..." });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    await u.click(botao);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Criar rascunho" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(acaoLenta).toHaveBeenCalledTimes(1);
  });
});

describe("FormNovoItem", () => {
  it("anúncio particular: sem perfil e sem escolha de tipo; preço com R$", () => {
    const { container } = render(<FormNovoItem origem="anuncio" categorias={CATEGORIAS} />);
    expect(screen.queryByLabelText(/^Perfil/)).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="tipo"]')?.value).toBe("produto");
    expect(screen.getByLabelText(/^Preço/)).toBeTruthy();
    expect(screen.getByLabelText(/Valor \(R\$\)/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sob consulta" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "A partir de" })).toBeTruthy();
    // Cidade e UF (27 siglas) aparecem só no anúncio particular (D-008).
    expect(screen.getByLabelText(/^Cidade/)).toBeTruthy();
    const uf = screen.getByLabelText(/^UF/) as HTMLSelectElement;
    expect(uf.options.length).toBe(28);
  });

  it("anúncio particular sem cidade e UF mostra os erros; item de perfil não tem esses campos", async () => {
    const u = usuario();
    const { unmount } = render(<FormNovoItem origem="anuncio" categorias={CATEGORIAS} />);
    await u.type(screen.getByLabelText(/^Nome/), "Bike");
    await u.type(screen.getByLabelText(/^Descrição/), "Boa");
    await u.click(screen.getByRole("button", { name: "Criar rascunho" }));
    expect(await screen.findByText(/^Informe a cidade/)).toBeTruthy();
    expect(screen.getByText("Escolha a UF.")).toBeTruthy();
    unmount();
    render(<FormNovoItem origem="perfil" categorias={CATEGORIAS} perfis={[]} />);
    expect(screen.queryByLabelText(/^Cidade/)).toBeNull();
    expect(screen.queryByLabelText(/^UF/)).toBeNull();
  });

  it("item de perfil pede o perfil; preço inválido mostra a mensagem do módulo", async () => {
    const u = usuario();
    render(
      <FormNovoItem
        origem="perfil"
        categorias={CATEGORIAS}
        perfis={[{ id: PERFIL, nome: "Padaria da Ana" }]}
      />,
    );
    await u.type(screen.getByLabelText(/^Nome/), "Bolo");
    await u.type(screen.getByLabelText(/^Descrição/), "De cenoura");
    await u.selectOptions(screen.getByLabelText(/^Tipo/), "produto");
    await u.selectOptions(screen.getByLabelText(/^Preço/), "fixo");
    await u.type(screen.getByLabelText(/Valor \(R\$\)/), "abc");
    await u.click(screen.getByRole("button", { name: "Criar rascunho" }));
    expect(await screen.findByText("Escolha o perfil do item.")).toBeTruthy();
    expect(screen.getByText(/^Informe um valor entre R\$ 0,01 e R\$/)).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
  });
});

describe("FormDecidirRevisao (IM-023)", () => {
  it("rejeitar exige motivo; aprovar não", async () => {
    const u = usuario();
    render(
      <>
        <FormDecidirRevisao modo="rejeitar" alvo="perfil" versaoId={PERFIL} />
        <FormDecidirRevisao modo="aprovar" alvo="perfil" versaoId={PERFIL} />
      </>,
    );
    await u.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect(await screen.findByText("Informe o motivo da rejeição.")).toBeTruthy();
    expect(vazia).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(vazia).toHaveBeenCalledTimes(1));
  });
});
