import { describe, expect, it, vi } from "vitest";
import {
  COLUNAS,
  criarBancoAdministracao,
  criarBancoCategorias,
  criarBancoBusca,
  criarBancoItens,
  criarBancoPatrocinadores,
  criarBancoPerfis,
  criarBancosSupabase,
  type ClienteSupabaseFase2,
} from "./bancos-supabase";

type Chamada = { metodo: string; args: unknown[] };
type Resposta = { data: unknown; error: unknown };

/** Cliente Supabase simulado: grava cada chamada encadeada e responde com a fila configurada. */
function simular(respostas: Resposta[] = [], storage?: unknown) {
  const consultas: { tabela: string; chamadas: Chamada[] }[] = [];
  const rpcs: { nome: string; args: unknown }[] = [];
  const fila = [...respostas];
  const proxima = () => fila.shift() ?? { data: null, error: null };

  const cliente = {
    from(tabela: string) {
      const registro = { tabela, chamadas: [] as Chamada[] };
      consultas.push(registro);
      const b: Record<string, unknown> = {};
      for (const m of [
        "select",
        "insert",
        "update",
        "eq",
        "in",
        "order",
        "maybeSingle",
        "single",
      ]) {
        b[m] = (...args: unknown[]) => {
          registro.chamadas.push({ metodo: m, args });
          return b;
        };
      }
      b.then = (ok: (r: Resposta) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(proxima()).then(ok, ko);
      return b;
    },
    rpc(nome: string, args?: unknown) {
      rpcs.push({ nome, args });
      return Promise.resolve(proxima());
    },
    storage,
  };
  return { cliente: cliente as unknown as ClienteSupabaseFase2, consultas, rpcs };
}

const PERFIL = {
  id: "p1",
  slug: "loja",
  publicado: false,
  versao_aprovada_id: null,
  criado_em: "2026-10-23T10:00:00Z",
  atualizado_em: "2026-10-23T10:00:00Z",
};
const VERSAO = {
  id: "v1",
  perfil_id: "p1",
  situacao: "rascunho",
  nome: "Loja",
  descricao_breve: null,
  imagem_path: null,
  categoria_principal_id: null,
  categoria_secundaria_1_id: null,
  categoria_secundaria_2_id: null,
  cidade: "Santos",
  uf: "SP",
  endereco: null,
  areas_atendidas: null,
  banners_paths: null,
  fotos_paths: null,
  site: null,
  informacoes_sociais: null,
  criado_em: "2026-10-23T10:00:00Z",
  enviada_em: null,
};
const PROIBIDAS = ["responsavel_id", "conta_id", "autor_id", "decidida_por"];

function colunasUsadas(consultas: { chamadas: Chamada[] }[]) {
  return consultas.flatMap((c) =>
    c.chamadas.filter((x) => x.metodo === "select").map((x) => String(x.args[0])),
  );
}

describe("colunas nomeadas", () => {
  it("nenhuma lista de colunas é '*' nem contém coluna que ninguém lê", () => {
    for (const lista of Object.values(COLUNAS)) {
      expect(lista).not.toContain("*");
      for (const p of PROIBIDAS) expect(lista).not.toMatch(new RegExp(`\\b${p}\\b`));
    }
  });
});

describe("perfis", () => {
  it("lista e busca pela visão perfis_meus_perfis com colunas nomeadas", async () => {
    const { cliente, consultas } = simular([
      { data: [PERFIL], error: null },
      { data: PERFIL, error: null },
    ]);
    const banco = criarBancoPerfis(cliente);
    const lista = await banco.listarMeusPerfis();
    const um = await banco.buscarMeuPerfil("p1");
    expect(lista.dados).toEqual([PERFIL]);
    expect(um.dados?.id).toBe("p1");
    expect(consultas.map((c) => c.tabela)).toEqual(["perfis_meus_perfis", "perfis_meus_perfis"]);
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.perfil, COLUNAS.perfil]);
    expect(consultas[1]!.chamadas).toContainEqual({ metodo: "eq", args: ["id", "p1"] });
  });

  it("junta o WhatsApp da tabela de contato às versões", async () => {
    const { cliente, consultas } = simular([
      { data: [VERSAO], error: null },
      { data: [{ versao_id: "v1", whatsapp_comercial_e164: "+5513999990000" }], error: null },
    ]);
    const r = await criarBancoPerfis(cliente).listarVersoes(["p1"]);
    expect(r.dados?.[0]).toMatchObject({
      whatsapp_comercial_e164: "+5513999990000",
      areas_atendidas: [],
      banners_paths: [],
    });
    expect(consultas.map((c) => c.tabela)).toEqual([
      "perfis_perfil_versao",
      "perfis_perfil_versao_contato",
    ]);
    expect(colunasUsadas(consultas)[0]).toBe(COLUNAS.versaoPerfil);
  });

  it("não consulta o banco com lista vazia", async () => {
    const { cliente, consultas } = simular();
    const r = await criarBancoPerfis(cliente).listarVersoes([]);
    expect(r.dados).toEqual([]);
    expect(consultas).toHaveLength(0);
  });

  it("criarRascunho usa a RPC com os parâmetros p_*", async () => {
    const { cliente, rpcs } = simular([
      { data: [{ o_perfil_id: "p1", o_versao_id: "v1" }], error: null },
    ]);
    const r = await criarBancoPerfis(cliente).criarRascunho({
      slug: "loja",
      whatsapp_comercial_e164: "+5513999990000",
      nome: "Loja",
      descricao_breve: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: "c1",
      categoria_secundaria_2_id: "c1",
      cidade: "Santos",
      uf: "SP",
      endereco: null,
      areas_atendidas: [],
      site: null,
      informacoes_sociais: null,
    });
    expect(r.dados).toEqual({ perfil_id: "p1", versao_id: "v1" });
    expect(rpcs[0]!.nome).toBe("perfis_criar_rascunho");
    expect(rpcs[0]!.args).toMatchObject({
      p_slug: "loja",
      p_whatsapp_comercial: "+5513999990000",
      p_nome: "Loja",
      p_cidade: "Santos",
      p_uf: "SP",
      p_areas_atendidas: [],
    });
    expect(Object.keys(rpcs[0]!.args as object).every((k) => k.startsWith("p_"))).toBe(true);
    // Nulo vira argumento omitido (o banco aplica o default), nunca null explícito.
    expect(Object.values(rpcs[0]!.args as object)).not.toContain(null);
  });

  it("anúncio particular leva p_cidade e p_uf; versões gravam e leem cidade/UF (D-008)", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: [{ o_item_id: "i1", o_versao_id: "iv1" }], error: null },
      {
        data: { id: "iv2", item_id: "i1", situacao: "rascunho", cidade: "Canoas", uf: "RS" },
        error: null,
      },
    ]);
    const banco = criarBancoItens(cliente);
    await banco.criarItem({
      tipo: "produto",
      perfil_id: null,
      nome: "Bike",
      descricao: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: "c1",
      categoria_secundaria_2_id: "c1",
      preco_modo: "fixo",
      preco_centavos: 1000,
      cidade: "Canoas",
      uf: "RS",
    });
    expect(rpcs[0]!.args).toMatchObject({ p_cidade: "Canoas", p_uf: "RS" });
    const v = await banco.atualizarVersao("iv2", {
      nome: "Bike",
      descricao: null,
      foto_path: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: "c1",
      categoria_secundaria_2_id: "c1",
      preco_modo: "fixo",
      preco_centavos: 1000,
      cidade: "Canoas",
      uf: "RS",
    });
    expect(v.dados).toMatchObject({ cidade: "Canoas", uf: "RS" });
    expect(consultas[0]!.chamadas).toContainEqual({
      metodo: "update",
      args: [expect.objectContaining({ cidade: "Canoas", uf: "RS" })],
    });
    expect(COLUNAS.versaoItem).toMatch(/\bcidade, uf\b/);
  });

  it("gravarVersao, enviarVersao e atualizarPerfil", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: "v9", error: null },
      { data: null, error: null },
      { data: PERFIL, error: null },
    ]);
    const banco = criarBancoPerfis(cliente);
    const g = await banco.gravarVersao("p1", {
      nome: "Loja",
      descricao_breve: null,
      imagem_path: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: "c1",
      categoria_secundaria_2_id: "c1",
      cidade: null,
      uf: null,
      endereco: null,
      areas_atendidas: [],
      banners_paths: ["perfil/a/b.webp"],
      fotos_paths: [],
      site: null,
      informacoes_sociais: null,
      whatsapp_comercial_e164: "+5513999990000",
    });
    expect(g.dados).toBe("v9");
    expect(rpcs[0]).toMatchObject({
      nome: "perfis_gravar_versao",
      args: { p_perfil_id: "p1", p_banners_paths: ["perfil/a/b.webp"] },
    });
    await banco.enviarVersao("v9");
    expect(rpcs[1]).toEqual({ nome: "perfis_enviar_versao", args: { p_versao_id: "v9" } });
    await banco.atualizarPerfil("p1", { publicado: true });
    expect(consultas[0]!.tabela).toBe("perfis_perfil");
    expect(consultas[0]!.chamadas).toContainEqual({
      metodo: "update",
      args: [{ publicado: true }],
    });
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.perfil]);
  });

  it("erro do banco vira só código e texto de classificação; exceção vira erro genérico", async () => {
    const { cliente } = simular([
      { data: null, error: { code: "23505", message: "perfis_perfil_slug_key", extra: "x" } },
    ]);
    const r = await criarBancoPerfis(cliente).atualizarPerfil("p1", { slug: "a" });
    expect(r.erro).toEqual({
      code: "23505",
      message: "perfis_perfil_slug_key",
      details: undefined,
    });

    const quebrado = {
      rpc: () => {
        throw new Error("ECONNRESET postgres://usuario:segredo@host");
      },
    } as unknown as ClienteSupabaseFase2;
    const e = await criarBancoPerfis(quebrado).enviarVersao("v1");
    expect(e.erro).toEqual({ code: "XX000" });
    expect(JSON.stringify(e)).not.toMatch(/segredo|ECONNRESET/);
  });
});

describe("itens", () => {
  it("criarItem usa a RPC catalogo_criar_item", async () => {
    const { cliente, rpcs } = simular([
      { data: [{ o_item_id: "i1", o_versao_id: "iv1" }], error: null },
    ]);
    const r = await criarBancoItens(cliente).criarItem({
      tipo: "produto",
      perfil_id: null,
      nome: "Bolo",
      descricao: null,
      categoria_principal_id: null,
      categoria_secundaria_1_id: "c1",
      categoria_secundaria_2_id: "c1",
      preco_modo: "fixo",
      preco_centavos: 1000,
    });
    expect(r.dados).toEqual({ item_id: "i1", versao_id: "iv1" });
    expect(rpcs[0]).toMatchObject({
      nome: "catalogo_criar_item",
      args: { p_tipo: "produto", p_nome: "Bolo", p_preco_modo: "fixo", p_preco_centavos: 1000 },
    });
    expect(Object.values(rpcs[0]!.args as object)).not.toContain(null);
    // Item de perfil/sem localização: p_cidade e p_uf são omitidos.
    expect(rpcs[0]!.args).not.toHaveProperty("p_cidade");
    expect(rpcs[0]!.args).not.toHaveProperty("p_uf");
  });

  it("lê pela visão catalogo_meus_itens e pelas versões com colunas nomeadas", async () => {
    const { cliente, consultas } = simular([
      {
        data: [
          {
            id: "i1",
            perfil_id: null,
            tipo: "produto",
            publicado: true,
            versao_aprovada_id: null,
            criado_em: "x",
            atualizado_em: "y",
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    const banco = criarBancoItens(cliente);
    await banco.listarMeusItens();
    await banco.listarVersoes(["i1"]);
    expect(consultas.map((c) => c.tabela)).toEqual(["catalogo_meus_itens", "catalogo_item_versao"]);
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.item, COLUNAS.versaoItem]);
  });

  it("enviar usa a RPC e publicar atualiza só a coluna publicado", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const banco = criarBancoItens(cliente);
    await banco.enviarVersao("iv1");
    await banco.definirPublicado("i1", false);
    expect(rpcs[0]).toEqual({ nome: "catalogo_enviar_item_versao", args: { p_versao_id: "iv1" } });
    expect(consultas[0]!.chamadas).toContainEqual({
      metodo: "update",
      args: [{ publicado: false }],
    });
  });
});

describe("categorias e administração", () => {
  it("categorias: RPCs com parâmetros p_* e leitura sem decidida_por", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: "c1", error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const banco = criarBancoCategorias(cliente, "u1");
    const criada = await banco.criarCategoria({ nome: "Doces", slug: "doces", ordem: 3 });
    expect(criada.id).toBe("c1");
    await banco.alterarCategoria({ id: "c1", nome: "Doces", ativa: false, ordem: 1, motivo: "x" });
    await banco.decidirSolicitacao({ id: "s1", atendida: true, motivo: "ok", categoriaId: "c1" });
    await banco.listarMinhasSolicitacoes();
    await banco.listarSolicitacoesPendentes();
    expect(rpcs.map((r) => r.nome)).toEqual([
      "catalogo_criar_categoria",
      "catalogo_alterar_categoria",
      "catalogo_decidir_solicitacao",
    ]);
    expect(rpcs[0]!.args).toEqual({ p_nome: "Doces", p_slug: "doces", p_ordem: 3 });
    expect(rpcs[1]!.args).toEqual({
      p_id: "c1",
      p_nome: "Doces",
      p_ativa: false,
      p_ordem: 1,
      p_motivo: "x",
    });
    expect(rpcs[2]!.args).toEqual({
      p_id: "s1",
      p_atendida: true,
      p_motivo: "ok",
      p_categoria_id: "c1",
    });
    expect(consultas[0]!.chamadas).toContainEqual({ metodo: "eq", args: ["solicitante_id", "u1"] });
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.solicitacao, COLUNAS.solicitacao]);
  });

  it("administração: fila, resultados e decisões pelas visões e RPCs certas", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const banco = criarBancoAdministracao(cliente, "u1");
    await banco.listarFila();
    await banco.listarMinhasRevisoes();
    await banco.decidirPerfil({ versaoId: "v1", aprovar: false, motivo: "foto ruim" });
    await banco.decidirItem({ versaoId: "iv1", aprovar: true, motivo: null });
    expect(consultas.map((c) => c.tabela)).toEqual([
      "administracao_fila_pendencias",
      "administracao_meus_resultados",
    ]);
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.fila, COLUNAS.resultado]);
    expect(rpcs[0]).toEqual({
      nome: "perfis_decidir_versao",
      args: { p_versao_id: "v1", p_aprovar: false, p_motivo: "foto ruim" },
    });
    expect(rpcs[1]!.nome).toBe("catalogo_decidir_item_versao");
    expect(rpcs[1]!.args).toEqual({ p_versao_id: "iv1", p_aprovar: true, p_motivo: undefined });
  });

  it("revisão de perfil: lê versão e id/slug, sem contato e sem responsável", async () => {
    const { cliente, consultas } = simular([
      { data: VERSAO, error: null },
      { data: { id: "p1", slug: "loja" }, error: null },
    ]);
    const r = await criarBancoPerfis(cliente).buscarVersaoParaRevisao!("v1");
    expect(r.dados?.perfil).toEqual({ id: "p1", slug: "loja" });
    expect(r.dados?.versao.whatsapp_comercial_e164).toBeNull();
    expect(consultas.map((c) => c.tabela)).toEqual(["perfis_perfil_versao", "perfis_perfil"]);
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.versaoPerfil, "id, slug"]);
  });

  it("revisão de item: lê versão e id/perfil_id/tipo, sem conta_id", async () => {
    const { cliente, consultas } = simular([
      {
        data: { id: "iv1", item_id: "i1", situacao: "pendente", nome: "Bolo", preco_centavos: 500 },
        error: null,
      },
      { data: { id: "i1", perfil_id: null, tipo: "produto" }, error: null },
    ]);
    const r = await criarBancoItens(cliente).buscarVersaoParaRevisao!("iv1");
    expect(r.dados?.item).toEqual({ id: "i1", perfil_id: null, tipo: "produto" });
    expect(consultas.map((c) => c.tabela)).toEqual(["catalogo_item_versao", "catalogo_item"]);
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.versaoItem, "id, perfil_id, tipo"]);
  });

  it("revisão inexistente: dados nulos sem erro", async () => {
    const { cliente } = simular([{ data: null, error: null }]);
    const r = await criarBancoPerfis(cliente).buscarVersaoParaRevisao!("v1");
    expect(r).toEqual({ dados: null, erro: null });
  });

  it("listarTodasCategorias não filtra por ativa", async () => {
    const { cliente, consultas } = simular([{ data: [], error: null }]);
    await criarBancoCategorias(cliente, "u1").listarTodasCategorias!();
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.categoria]);
    expect(consultas[0]!.chamadas.some((c) => c.metodo === "eq")).toBe(false);
  });
});

describe("criarBancosSupabase", () => {
  it("ehAdministrador nos quatro bancos usa a RPC administracao_eh_admin sem parâmetros", async () => {
    const { cliente, rpcs } = simular([
      { data: true, error: null },
      { data: null, error: { code: "42501" } },
      { data: false, error: null },
      { data: true, error: null },
    ]);
    expect(await criarBancoPerfis(cliente).ehAdministrador!()).toBe(true);
    expect(await criarBancoItens(cliente).ehAdministrador!()).toBe(false);
    expect(await criarBancoCategorias(cliente, "u1").ehAdministrador!()).toBe(false);
    expect(await criarBancoAdministracao(cliente, "u1").ehAdministrador!()).toBe(true);
    expect(rpcs.every((r) => r.nome === "administracao_eh_admin" && r.args === undefined)).toBe(
      true,
    );
  });

  it("assina só caminhos válidos no bucket e devolve apenas caminho -> URL (sem owner)", async () => {
    const U = "11111111-1111-4111-8111-111111111111";
    const V = "22222222-2222-4222-8222-222222222222";
    const caminho = `perfil/${U}/${V}.webp`;
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: caminho, signedUrl: "https://x/assinada", error: null, owner: "dono-secreto" },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrls });
    const { cliente } = simular([], { from });
    const d = criarBancosSupabase(cliente, "u1");
    const r = await d.assinarImagens([caminho, "../fora.png"]);
    expect(from).toHaveBeenCalledWith("indicamais-imagens");
    expect(createSignedUrls).toHaveBeenCalledWith([caminho], 3600);
    expect(r).toEqual({ [caminho]: "https://x/assinada" });
    expect(JSON.stringify(r)).not.toContain("dono-secreto");
  });
});

describe("busca pública (IM-019)", () => {
  it("rpc busca_publica omite filtros nulos e lê categorias com colunas nomeadas", async () => {
    const { cliente, rpcs, consultas } = simular([
      { data: [], error: null },
      {
        data: [{ id: "c1", nome: "Alimentação", slug: "alimentacao", ativa: true, ordem: 1 }],
        error: null,
      },
    ]);
    const banco = criarBancoBusca(cliente);
    const r = await banco.buscar({
      p_limite: 12,
      p_pagina: 1,
      p_termo: "bolo",
      p_uf: undefined,
      p_cidade: null as unknown as string,
    });
    expect(r.dados).toEqual([]);
    expect(rpcs[0]).toEqual({
      nome: "busca_publica",
      args: { p_limite: 12, p_pagina: 1, p_termo: "bolo" },
    });
    const c = await banco.listarCategorias();
    expect(c.dados?.[0]?.nome).toBe("Alimentação");
    expect(consultas[0]!.tabela).toBe("catalogo_categoria");
    expect(colunasUsadas(consultas)).toEqual([COLUNAS.categoria]);
  });

  it("erro do banco vira ErroBanco e exceção vira erro genérico (sem texto)", async () => {
    const { cliente } = simular([{ data: null, error: { code: "22023", message: "uf inválida" } }]);
    const r = await criarBancoBusca(cliente).buscar({ p_limite: 1, p_pagina: 1 });
    expect(r.erro?.code).toBe("22023");
    const quebrado = {
      rpc: () => {
        throw new Error("ECONNRESET postgres://segredo");
      },
    } as unknown as ClienteSupabaseFase2;
    const falha = await criarBancoBusca(quebrado).buscar({ p_limite: 1, p_pagina: 1 });
    expect(JSON.stringify(falha)).not.toContain("postgres://");
    expect(falha.erro).toEqual({ code: "XX000" });
  });
});

describe("patrocinadores (IM-020)", () => {
  it("leitura pública pela visão com colunas nomeadas; administrador pela tabela", async () => {
    const { cliente, consultas } = simular([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const banco = criarBancoPatrocinadores(cliente);
    await banco.listarPublicos();
    await banco.listarTodos!();
    expect(consultas.map((c) => c.tabela)).toEqual([
      "administracao_patrocinador_publico",
      "administracao_patrocinador",
    ]);
    expect(colunasUsadas(consultas)).toEqual([
      COLUNAS.patrocinadorPublico,
      COLUNAS.patrocinadorAdmin,
    ]);
  });

  it("criar omite parâmetros nulos e leva p_id; alterar e ativar levam o motivo", async () => {
    const { cliente, rpcs } = simular([
      { data: "11111111-1111-4111-8111-111111111111", error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const banco = criarBancoPatrocinadores(cliente);
    const criado = await banco.criar!({
      p_titulo: "Padaria",
      p_imagem_path: "patrocinador/x/y.webp",
      p_perfil_destino_id: null,
      p_texto_destino: "Pão quente",
      p_ordem: 1,
      p_ativo: false,
      p_inicio_em: null,
      p_fim_em: null,
      p_motivo: null,
      p_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(criado.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(Object.keys(rpcs[0]!.args as object).sort()).toEqual(
      ["p_ativo", "p_id", "p_imagem_path", "p_ordem", "p_texto_destino", "p_titulo"].sort(),
    );
    await banco.alterar!({
      p_id: "i",
      p_titulo: "Padaria",
      p_imagem_path: "patrocinador/x/y.webp",
      p_perfil_destino_id: null,
      p_texto_destino: "Pão",
      p_ordem: 0,
      p_inicio_em: null,
      p_fim_em: null,
      p_motivo: "ajuste",
    });
    expect(rpcs[1]).toMatchObject({
      nome: "administracao_alterar_patrocinador",
      args: { p_motivo: "ajuste", p_perfil_destino_id: null, p_fim_em: null },
    });
    await banco.definirAtivo!({ p_id: "i", p_ativo: false, p_motivo: "pausa" });
    expect(rpcs[2]).toEqual({
      nome: "administracao_definir_patrocinador_ativo",
      args: { p_id: "i", p_ativo: false, p_motivo: "pausa" },
    });
  });

  it("administrador falha fechado quando a rpc dá erro", async () => {
    const { cliente } = simular([{ data: null, error: { code: "42501" } }]);
    expect(await criarBancoPatrocinadores(cliente).ehAdministrador!()).toBe(false);
  });
});
