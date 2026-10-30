// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caminhoDe, criarMundo, formulario, type Mundo } from "../../tests/suporte/bancos-memoria";
import type { Contexto } from "./_lib/contexto";

let contextoAtual: Contexto;

vi.mock("./_lib/contexto-sessao", () => ({ obterContexto: async () => contextoAtual }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./acoes-conteudo", () => {
  const f = async () => ({});
  return {
    acaoCriarPerfil: f,
    acaoEditarPerfil: f,
    acaoSalvarImagensPerfil: f,
    acaoAlterarEnderecoPerfil: f,
    acaoEnviarPerfil: f,
    acaoPublicarPerfil: f,
    acaoDespublicarPerfil: f,
    acaoCriarItem: f,
    acaoEditarItem: f,
    acaoSalvarFotoItem: f,
    acaoEnviarItem: f,
    acaoPublicarItem: f,
    acaoDespublicarItem: f,
    acaoSolicitarCategoria: f,
    acaoDecidirRevisao: f,
    acaoCriarCategoria: f,
    acaoAlterarCategoria: f,
    acaoDecidirSolicitacao: f,
  };
});

import PaginaCategoriasAdmin from "./administracao/categorias/page";
import PaginaFilaRevisao from "./administracao/revisao/page";
import PaginaRevisar from "./administracao/revisao/[alvo]/[versaoId]/page";
import PaginaMeusAnuncios from "./meus-anuncios/page";
import PaginaMeusItens from "./meus-itens/page";
import PaginaMeusPerfis from "./meus-perfis/page";
import PaginaPerfil from "./meus-perfis/[id]/page";
import PaginaPreviaPerfil from "./meus-perfis/[id]/previa/page";
import PaginaMinhasRevisoes from "./minhas-revisoes/page";
import { decidirRevisao } from "./_lib/tratadores-administracao";
import { criarItem, enviarItem, salvarFotoItem } from "./_lib/tratadores-itens";
import { criarPerfil, enviarPerfil, salvarImagensPerfil } from "./_lib/tratadores-perfis";

const ANA = randomUUID();
const BIA = randomUUID();
const ADM = randomUUID();
const WHATSAPP_DIGITADO = "(51) 98123-7661";

let m: Mundo;
beforeEach(() => {
  m = criarMundo({ administradores: [ADM] });
});
afterEach(() => cleanup());

const como = (conta: string) => {
  contextoAtual = m.contexto(conta);
  return contextoAtual;
};
const args = (params: Record<string, string> = {}, busca: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params), searchParams: Promise.resolve(busca) }) as never;

async function perfilPronto(conta = ANA, enviar = true) {
  const ctx = como(conta);
  const r = await criarPerfil(
    ctx,
    formulario({
      nome: "Padaria da Ana",
      descricaoBreve: "Pães artesanais.",
      cidade: "Porto Alegre",
      uf: "RS",
      whatsappComercial: WHATSAPP_DIGITADO,
      categoriaPrincipalId: m.categorias[0]!.id,
      informacoesSociais: "Atendemos de segunda a sábado.",
    }),
  );
  const id = /meus-perfis\/([0-9a-f-]{36})/.exec(r.destino!)![1]!;
  await salvarImagensPerfil(ctx, formulario({ id, imagemPath: caminhoDe("perfil", id) }));
  if (enviar) await enviarPerfil(ctx, formulario({ id }));
  return id;
}

const versaoPendenteDe = (id: string) =>
  m.versoesPerfil.find((v) => v.perfil_id === id && v.situacao === "pendente")!;

describe("administração: acesso restrito (IM-077)", () => {
  it("quem não é administrador recebe 404 em todas as rotas, sem pista da área", async () => {
    const id = await perfilPronto();
    const v = versaoPendenteDe(id);
    como(BIA);
    await expect(PaginaFilaRevisao(args())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PaginaCategoriasAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PaginaRevisar(args({ alvo: "perfil", versaoId: v.id }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    como(ANA);
    await expect(PaginaFilaRevisao(args())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("administrador vê a fila e confere o conteúdo sem WhatsApp, e-mail nem dono", async () => {
    const id = await perfilPronto();
    const v = versaoPendenteDe(id);
    como(ADM);
    const { container, unmount } = render(await PaginaFilaRevisao(args()));
    expect(screen.getByRole("link", { name: "Padaria da Ana" }).getAttribute("href")).toBe(
      `/administracao/revisao/perfil/${v.id}`,
    );
    unmount();

    const tela = render(await PaginaRevisar(args({ alvo: "perfil", versaoId: v.id })));
    expect(screen.getByRole("heading", { name: "Padaria da Ana" })).toBeTruthy();
    expect(screen.getByText("Atendemos de segunda a sábado.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rejeitar" })).toBeTruthy();
    const html = tela.container.innerHTML;
    for (const privado of ["98123", "5551981", "WhatsApp", ANA, "@"]) {
      expect(html).not.toContain(privado);
    }
    expect(container).toBeTruthy();
  });

  it("alvo inválido é 404 e conteúdo próprio do administrador não tem botão de decidir", async () => {
    como(ADM);
    await expect(PaginaRevisar(args({ alvo: "outro", versaoId: randomUUID() }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    const id = await perfilPronto(ADM);
    const v = versaoPendenteDe(id);
    render(await PaginaRevisar(args({ alvo: "perfil", versaoId: v.id })));
    expect(screen.getByText(/Este conteúdo é seu/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
  });

  it("depois de decidido, o conteúdo sai da fila", async () => {
    const id = await perfilPronto();
    const v = versaoPendenteDe(id);
    await decidirRevisao(
      como(ADM),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: v.id }),
    );
    render(await PaginaRevisar(args({ alvo: "perfil", versaoId: v.id })));
    expect(screen.getByText(/não está mais aguardando revisão/)).toBeTruthy();
  });

  it("categorias: lista inclusive inativas e os pedidos pendentes", async () => {
    como(ADM);
    m.categorias[1]!.ativa = false;
    await m.contexto(ANA).categorias.solicitar({ nome: "Pet shop", justificativa: "Banho e tosa" });
    render(await PaginaCategoriasAdmin());
    expect(screen.getByText("Beleza e estética")).toBeTruthy();
    expect(screen.getByText("Inativa", { selector: "span.selo" })).toBeTruthy();
    expect(screen.getByText("Pet shop")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recusar pedido" })).toBeTruthy();
  });
});

describe("responsável: prévia e perfil (IM-017, IM-022, IM-079)", () => {
  it("a prévia mostra o perfil no formato público, sem o WhatsApp comercial", async () => {
    const id = await perfilPronto(ANA, false);
    como(ANA);
    const tela = render(await PaginaPreviaPerfil(args({ id })));
    expect(screen.getByText(/só você a vê/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Padaria da Ana" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar para aprovação" })).toBeTruthy();
    const img = screen.getByAltText("Imagem de Padaria da Ana") as HTMLImageElement;
    expect(img.src).toContain("https://storage.exemplo/assinada/perfil/");
    const html = tela.container.innerHTML;
    for (const privado of ["98123", "5551981", "WhatsApp", ANA]) {
      expect(html).not.toContain(privado);
    }
  });

  it("detalhe do perfil em rascunho avisa que não foi enviado e oferece o envio no topo; a lista traz a etiqueta", async () => {
    const id = await perfilPronto(ANA, false);
    como(ANA);
    render(await PaginaPerfil(args({ id })));
    expect(
      screen.getByText(/alterações salvas que ainda não foram enviadas para aprovação/),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Enviar para aprovação" })).toHaveLength(1);
    cleanup();
    render(await PaginaMeusPerfis());
    expect(screen.getByText("Rascunho não enviado")).toBeTruthy();
  });

  it("prévia com pendências lista o que falta e não oferece envio", async () => {
    const ctx = como(ANA);
    const r = await criarPerfil(
      ctx,
      formulario({
        nome: "Sem imagem",
        descricaoBreve: "x",
        cidade: "Canoas",
        uf: "RS",
        whatsappComercial: WHATSAPP_DIGITADO,
        categoriaPrincipalId: m.categorias[0]!.id,
      }),
    );
    const id = /meus-perfis\/([0-9a-f-]{36})/.exec(r.destino!)![1]!;
    render(await PaginaPreviaPerfil(args({ id })));
    expect(screen.getByText("Envie a imagem do perfil.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar para aprovação" })).toBeNull();
  });

  it("perfil de outra conta é 404", async () => {
    const id = await perfilPronto(ANA, false);
    como(BIA);
    await expect(PaginaPerfil(args({ id }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(PaginaPreviaPerfil(args({ id }))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("em análise não há formulários de edição", async () => {
    const id = await perfilPronto(ANA, true);
    como(ANA);
    render(await PaginaPerfil(args({ id })));
    expect(screen.getByText("Aguardando aprovação")).toBeTruthy();
    expect(screen.getByText(/Em análise\. Você poderá editar/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });

  it("aprovado e editado: avisa que a versão aprovada continua no ar; o dono vê o próprio WhatsApp", async () => {
    const id = await perfilPronto(ANA, true);
    await decidirRevisao(
      como(ADM),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: versaoPendenteDe(id).id }),
    );
    const ana = como(ANA);
    await ana.perfis.publicar(id);
    await ana.perfis.editar(id, { nome: "Padaria Premium" });
    render(await PaginaPerfil(args({ id })));
    expect(screen.getByText("Edição em rascunho")).toBeTruthy();
    expect(
      screen.getByText("A versão aprovada continua no ar enquanto esta edição não for aprovada."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Despublicar perfil" })).toBeTruthy();
    expect((screen.getByLabelText(/WhatsApp comercial/) as HTMLInputElement).value).toBe(
      WHATSAPP_DIGITADO,
    );
    // Depois da primeira aprovação o endereço não é mais editável.
    expect(screen.queryByRole("button", { name: "Salvar endereço" })).toBeNull();
  });

  it("rascunho novo: endereço editável, ações de rascunho e nenhuma ação futura", async () => {
    const id = await perfilPronto(ANA, false);
    como(ANA);
    render(await PaginaPerfil(args({ id }, { aviso: "criado" })));
    expect(screen.getByText(/Rascunho criado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar endereço" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver prévia" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();
    expect(screen.queryByText(/curtir|indicar|mapa/i)).toBeNull();
  });
});

describe("itens, anúncios e revisões (IM-014, IM-015, IM-023)", () => {
  it("lista separa itens de perfil e anúncios particulares", async () => {
    const perfilId = await perfilPronto(ANA, false);
    const ctx = como(ANA);
    const base = {
      tipo: "servico",
      nome: "Entrega",
      descricao: "Entregamos.",
      categoriaPrincipalId: m.categorias[0]!.id,
      precoModo: "sob_consulta",
    };
    await criarItem(ctx, formulario({ ...base, origem: "perfil", perfilId }));
    await criarItem(
      ctx,
      formulario({
        ...base,
        tipo: "produto",
        nome: "Bicicleta",
        origem: "anuncio",
        cidade: "Porto Alegre",
        uf: "RS",
        precoModo: "fixo",
        precoValor: "1.250,00",
      }),
    );
    render(await PaginaMeusItens());
    expect(screen.getByText("Entrega")).toBeTruthy();
    expect(screen.queryByText("Bicicleta")).toBeNull();
    expect(screen.getByText(/Padaria da Ana/)).toBeTruthy();
    cleanup();
    render(await PaginaMeusAnuncios());
    expect(screen.getByText("Bicicleta")).toBeTruthy();
    expect(screen.getByText(/R\$\s1\.250,00/)).toBeTruthy();
    expect(screen.queryByText("Entrega")).toBeNull();
  });

  it("minhas revisões: em análise, rejeitado com motivo e aprovado e publicado com link", async () => {
    const aprovado = await perfilPronto(ANA, true);
    await decidirRevisao(
      como(ADM),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: versaoPendenteDe(aprovado).id }),
    );
    const ana = como(ANA);
    await ana.perfis.publicar(aprovado);

    const ctx = como(ANA);
    const r = await criarItem(
      ctx,
      formulario({
        tipo: "produto",
        origem: "anuncio",
        cidade: "Canoas",
        uf: "RS",
        nome: "Sofá",
        descricao: "Usado.",
        categoriaPrincipalId: m.categorias[0]!.id,
        precoModo: "",
      }),
    );
    const itemId = /meus-itens\/([0-9a-f-]{36})/.exec(r.destino!)![1]!;
    await salvarFotoItem(ctx, formulario({ id: itemId, fotoPath: caminhoDe("item", itemId) }));
    await enviarItem(ctx, formulario({ id: itemId }));
    const versaoItem = m.versoesItem.find((v) => v.item_id === itemId)!;
    await decidirRevisao(
      como(ADM),
      formulario({
        decisao: "rejeitar",
        alvo: "item",
        versaoId: versaoItem.id,
        motivo: "Foto não mostra o produto.",
      }),
    );

    como(ANA);
    render(await PaginaMinhasRevisoes());
    expect(screen.getByText("Aprovado e publicado.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver página publicada" })).toBeTruthy();
    expect(screen.getByText(/Rejeitado\. Veja o motivo/)).toBeTruthy();
    expect(screen.getByText("Foto não mostra o produto.")).toBeTruthy();
    // Autor da decisão é referência opaca: nunca aparece id, nome ou e-mail do administrador.
    expect(document.body.innerHTML).not.toContain(ADM);
  });
});
