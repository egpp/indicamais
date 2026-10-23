import { describe, expect, it, vi } from "vitest";
import {
  criarServicoCategorias,
  type ClienteBancoCategorias,
  type LinhaCategoria,
  type LinhaSolicitacao,
} from "./index";

const CONTA = "11111111-1111-4111-8111-111111111111";
const ID1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const cat = (p: Partial<LinhaCategoria> & { nome: string }): LinhaCategoria => ({
  id: ID1,
  slug: "x",
  ativa: true,
  ordem: 0,
  ...p,
});

function fake(over: Partial<ClienteBancoCategorias> = {}, categorias: LinhaCategoria[] = []) {
  const banco: ClienteBancoCategorias = {
    contaId: CONTA,
    listarCategorias: vi.fn(async () => ({ dados: categorias, erro: null })),
    inserirSolicitacao: vi.fn(async (c) => ({
      dados: {
        id: ID2,
        situacao: "pendente",
        categoria_id: null,
        motivo_resposta: null,
        decidida_em: null,
        criado_em: "2026-10-23T00:00:00Z",
        ...c,
      } as LinhaSolicitacao,
      erro: null,
    })),
    listarMinhasSolicitacoes: vi.fn(async () => ({ dados: [], erro: null })),
    listarSolicitacoesPendentes: vi.fn(async () => ({ dados: [], erro: null })),
    criarCategoria: vi.fn(async () => ({ id: ID1, erro: null })),
    alterarCategoria: vi.fn(async () => ({ erro: null })),
    decidirSolicitacao: vi.fn(async () => ({ erro: null })),
    ...over,
  };
  return banco;
}

describe("categorias (IM-016)", () => {
  it("lista só ativas, por ordem e nome", async () => {
    const b = fake({}, [
      cat({ id: "1", nome: "Veículos", ordem: 5 }),
      cat({ id: "2", nome: "Alimentação", ordem: 1 }),
      cat({ id: "3", nome: "Antiga", ordem: 0, ativa: false }),
      cat({ id: "4", nome: "Beleza", ordem: 1 }),
    ]);
    const r = await criarServicoCategorias(b).listarAtivas();
    expect(r.ok && r.valor.map((c) => c.nome)).toEqual(["Alimentação", "Beleza", "Veículos"]);
  });

  it("solicitar nova categoria grava pedido da própria conta e não cria categoria", async () => {
    const b = fake();
    const r = await criarServicoCategorias(b).solicitar({
      nome: "  Pet shop ",
      justificativa: "",
      solicitante_id: "outro",
    });
    expect(r.ok && r.valor.situacao).toBe("pendente");
    expect(b.inserirSolicitacao).toHaveBeenCalledWith({
      solicitante_id: CONTA,
      nome_sugerido: "Pet shop",
      justificativa: null,
    });
    expect(b.criarCategoria).not.toHaveBeenCalled();
  });

  it("recusa pedido de categoria que já existe (sem acento e caixa)", async () => {
    const b = fake({}, [cat({ nome: "Alimentação" })]);
    const r = await criarServicoCategorias(b).solicitar({ nome: "alimentacao" });
    expect(!r.ok && r.erro.codigo).toBe("CATEGORIA_DUPLICADA");
    expect(b.inserirSolicitacao).not.toHaveBeenCalled();
  });

  it("recusa nome curto/longo e justificativa longa", async () => {
    const b = fake();
    const s = criarServicoCategorias(b);
    expect((await s.solicitar({ nome: "a" })).ok).toBe(false);
    expect((await s.solicitar({ nome: "a".repeat(61) })).ok).toBe(false);
    expect((await s.solicitar({ nome: "Pets", justificativa: "j".repeat(301) })).ok).toBe(false);
    expect(b.inserirSolicitacao).not.toHaveBeenCalled();
  });

  it("limite de pedidos pendentes (banco) vira mensagem clara", async () => {
    const b = fake({
      inserirSolicitacao: async () => ({
        dados: null,
        erro: { code: "P0001", message: "limite de 5 pedidos pendentes de categoria" },
      }),
    });
    const r = await criarServicoCategorias(b).solicitar({ nome: "Pets" });
    expect(!r.ok && r.erro.codigo).toBe("LIMITE_SOLICITACOES");
    expect(!r.ok && r.erro.mensagem).not.toMatch(/limite de 5/);
  });

  it("só mostra os pedidos da própria conta", async () => {
    const meu = { id: "a", solicitante_id: CONTA, nome_sugerido: "A", situacao: "pendente" };
    const alheio = { id: "b", solicitante_id: "outra", nome_sugerido: "B", situacao: "pendente" };
    const b = fake({
      listarMinhasSolicitacoes: async () => ({
        dados: [meu, alheio] as unknown as LinhaSolicitacao[],
        erro: null,
      }),
    });
    const r = await criarServicoCategorias(b).listarMinhasSolicitacoes();
    expect(r.ok && r.valor.map((s) => s.id)).toEqual(["a"]);
  });

  describe("administrador", () => {
    it("cria categoria com slug sem acentos", async () => {
      const b = fake();
      const r = await criarServicoCategorias(b).criarCategoria({ nome: "Saúde e Bem-estar" });
      expect(r.ok && r.valor.slug).toBe("saude-e-bem-estar");
      expect(b.criarCategoria).toHaveBeenCalledWith({
        nome: "Saúde e Bem-estar",
        slug: "saude-e-bem-estar",
        ordem: 0,
      });
    });

    it("nome sem letras/números não gera slug", async () => {
      const b = fake();
      const r = await criarServicoCategorias(b).criarCategoria({ nome: "!!" });
      expect(r.ok).toBe(false);
      expect(b.criarCategoria).not.toHaveBeenCalled();
    });

    it("categoria duplicada (23505) vira mensagem clara", async () => {
      const b = fake({
        criarCategoria: async () => ({
          id: null,
          erro: { code: "23505", constraint: "catalogo_categoria_nome_unico" },
        }),
      });
      const r = await criarServicoCategorias(b).criarCategoria({ nome: "Pets" });
      expect(!r.ok && r.erro.codigo).toBe("CATEGORIA_DUPLICADA");
    });

    it("quem não é administrador recebe mensagem de permissão", async () => {
      const b = fake({
        criarCategoria: async () => ({
          id: null,
          erro: { code: "42501", message: "acesso restrito a administradores" },
        }),
      });
      const r = await criarServicoCategorias(b).criarCategoria({ nome: "Pets" });
      expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    });

    it("alterar exige motivo", async () => {
      const b = fake();
      const s = criarServicoCategorias(b);
      const base = { id: ID1, nome: "Pets", ativa: false, ordem: 3 };
      expect((await s.alterarCategoria({ ...base, motivo: "  " })).ok).toBe(false);
      expect((await s.alterarCategoria(base)).ok).toBe(false);
      expect(b.alterarCategoria).not.toHaveBeenCalled();
      expect((await s.alterarCategoria({ ...base, motivo: "Duplicada" })).ok).toBe(true);
    });

    it("recusar pedido exige motivo; atender exige a categoria criada", async () => {
      const b = fake();
      const s = criarServicoCategorias(b);
      expect((await s.decidirSolicitacao({ id: ID1, atendida: false })).ok).toBe(false);
      expect((await s.decidirSolicitacao({ id: ID1, atendida: false, motivo: " " })).ok).toBe(
        false,
      );
      expect((await s.decidirSolicitacao({ id: ID1, atendida: true })).ok).toBe(false);
      expect(b.decidirSolicitacao).not.toHaveBeenCalled();
      expect(
        (await s.decidirSolicitacao({ id: ID1, atendida: false, motivo: "Fora do escopo" })).ok,
      ).toBe(true);
      expect((await s.decidirSolicitacao({ id: ID1, atendida: true, categoriaId: ID2 })).ok).toBe(
        true,
      );
      expect(b.decidirSolicitacao).toHaveBeenLastCalledWith({
        id: ID1,
        atendida: true,
        motivo: null,
        categoriaId: ID2,
      });
    });

    it("pedido já decidido vira mensagem clara", async () => {
      const b = fake({
        decidirSolicitacao: async () => ({
          erro: { code: "P0001", message: "pedido já decidido" },
        }),
      });
      const r = await criarServicoCategorias(b).decidirSolicitacao({
        id: ID1,
        atendida: false,
        motivo: "x",
      });
      expect(!r.ok && r.erro.codigo).toBe("ESTADO_INVALIDO");
    });
  });
});
