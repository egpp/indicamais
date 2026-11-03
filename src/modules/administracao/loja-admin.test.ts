import { describe, expect, it, vi } from "vitest";
import {
  criarServicoLojaAdmin,
  mapearErroBancoLojaAdmin,
  type ClienteBancoLojaAdmin,
  type LinhaConsultaNegocio,
} from "./index";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

const perfil = (
  id: string,
  nome: string,
  o: Partial<LinhaConsultaNegocio> = {},
): LinhaConsultaNegocio => ({
  alvo_tipo: "perfil",
  alvo_id: id,
  dono_id: "dono-secreto",
  versao_id: "v",
  nome,
  categoria: "Imóveis",
  cidade: "Maceió",
  uf: "AL",
  situacao: "aprovada",
  tem_versao_aprovada: true,
  publicado: true,
  disponivel: true,
  item_tipo: null,
  perfil_id: null,
  slug: `slug-${nome.toLowerCase()}`,
  criado_em: "2026-11-01T00:00:00Z",
  atualizado_em: "2026-11-02T00:00:00Z",
  ...o,
});

function fakeBanco(o: Partial<ClienteBancoLojaAdmin> = {}, admin = true): ClienteBancoLojaAdmin {
  return {
    ehAdministrador: vi.fn(async () => admin),
    consultarPerfis: vi.fn(async () => ({
      dados: [perfil(P1, "Sol"), perfil(P2, "Mar")],
      erro: null,
    })),
    listarLiberacoes: vi.fn(async () => ({
      dados: [{ perfil_id: P1, liberada: true, atualizado_em: "2026-11-03T00:00:00Z" }],
      erro: null,
    })),
    definirLiberacao: vi.fn(async () => ({ erro: null })),
    ...o,
  };
}

describe("administração da Loja: listar perfis (IM-097, IM-099)", () => {
  it("junta o estado da Loja aos perfis; sem linha = desligada", async () => {
    const r = await criarServicoLojaAdmin(fakeBanco()).listarPerfis({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.itens.map((p) => [p.nome, p.lojaLiberada])).toEqual([
      ["Sol", true],
      ["Mar", false],
    ]);
    expect(r.valor.itens[0]!.lojaAtualizadaEm).toBe("2026-11-03T00:00:00Z");
    expect(r.valor.itens[1]!.lojaAtualizadaEm).toBeNull();
    expect(JSON.stringify(r.valor)).not.toContain("dono-secreto");
  });

  it("não administrador não lê nada", async () => {
    const banco = fakeBanco({}, false);
    const r = await criarServicoLojaAdmin(banco).listarPerfis({});
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    expect(banco.consultarPerfis).not.toHaveBeenCalled();
    expect(banco.listarLiberacoes).not.toHaveBeenCalled();
  });

  it("falha ao verificar o papel falha fechado", async () => {
    const banco = fakeBanco({
      ehAdministrador: vi.fn(async () => {
        throw new Error("rede");
      }),
    });
    const r = await criarServicoLojaAdmin(banco).listarPerfis({});
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
  });

  it("filtro 'liberadas' consulta só os ids liberados; sem nenhum, nem consulta", async () => {
    const banco = fakeBanco();
    await criarServicoLojaAdmin(banco).listarPerfis({ loja: "liberadas" });
    expect(vi.mocked(banco.consultarPerfis).mock.calls[0]![0].ids).toEqual([P1]);
    const vazio = fakeBanco({
      listarLiberacoes: vi.fn(async () => ({
        dados: [{ perfil_id: P1, liberada: false, atualizado_em: "x" }],
        erro: null,
      })),
    });
    const r = await criarServicoLojaAdmin(vazio).listarPerfis({ loja: "liberadas" });
    expect(r.ok && r.valor.itens).toEqual([]);
    expect(vazio.consultarPerfis).not.toHaveBeenCalled();
  });

  it("busca escapa curingas, pagina 20 e filtro desconhecido vira sem filtro", async () => {
    const banco = fakeBanco();
    await criarServicoLojaAdmin(banco).listarPerfis({ busca: "50%_", loja: "xyz", pagina: "2" });
    const c = vi.mocked(banco.consultarPerfis).mock.calls[0]![0];
    expect(c.buscaLike).toBe("50\\%\\_");
    expect(c.ids).toBeUndefined();
    expect([c.de, c.ate]).toEqual([20, 40]);
  });

  it("ignora linhas que não são perfil e erro do banco vira mensagem neutra", async () => {
    const banco = fakeBanco({
      consultarPerfis: vi.fn(async () => ({
        dados: [perfil(P1, "Sol"), perfil(P2, "Item", { alvo_tipo: "item" })],
        erro: null,
      })),
    });
    const r = await criarServicoLojaAdmin(banco).listarPerfis({});
    expect(r.ok && r.valor.itens).toHaveLength(1);
    const e = await criarServicoLojaAdmin(
      fakeBanco({
        consultarPerfis: vi.fn(async () => ({
          dados: null,
          erro: { code: "XX000", message: "pg secreto" },
        })),
      }),
    ).listarPerfis({});
    expect(!e.ok && e.erro.mensagem).not.toMatch(/pg secreto/);
  });
});

describe("administração da Loja: liberar e retirar", () => {
  it("libera com motivo e chama a função do banco com o perfil em minúsculas", async () => {
    const banco = fakeBanco();
    const r = await criarServicoLojaAdmin(banco).definirLiberacao({
      perfilId: P1.toUpperCase(),
      liberada: "true",
      motivo: "  Teste da Loja  ",
    });
    expect(r).toEqual({ ok: true, valor: { perfilId: P1, liberada: true } });
    expect(banco.definirLiberacao).toHaveBeenCalledWith({
      p_perfil_id: P1,
      p_liberada: true,
      p_motivo: "Teste da Loja",
    });
  });

  it("retira com 'false' ou 'off'", async () => {
    const banco = fakeBanco();
    const svc = criarServicoLojaAdmin(banco);
    for (const v of ["false", "off", false]) {
      const r = await svc.definirLiberacao({ perfilId: P1, liberada: v, motivo: "Fim do teste" });
      expect(r.ok && r.valor.liberada).toBe(false);
    }
  });

  it("motivo obrigatório: vazio, só espaços e ausente não chegam ao banco", async () => {
    const banco = fakeBanco();
    const svc = criarServicoLojaAdmin(banco);
    for (const motivo of ["", "   ", undefined]) {
      const r = await svc.definirLiberacao({ perfilId: P1, liberada: "true", motivo });
      expect(!r.ok && r.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    }
    expect(banco.definirLiberacao).not.toHaveBeenCalled();
  });

  it("recusa motivo longo, perfil inválido e valor de liberada desconhecido", async () => {
    const banco = fakeBanco();
    const svc = criarServicoLojaAdmin(banco);
    const base = { perfilId: P1, liberada: "true", motivo: "ok" };
    for (const e of [
      { ...base, motivo: "x".repeat(501) },
      { ...base, perfilId: "abc" },
      { ...base, liberada: "talvez" },
      { ...base, liberada: undefined },
      null,
    ]) {
      expect((await svc.definirLiberacao(e)).ok).toBe(false);
    }
    expect(banco.definirLiberacao).not.toHaveBeenCalled();
  });

  it("não administrador não chama o banco", async () => {
    const banco = fakeBanco({}, false);
    const r = await criarServicoLojaAdmin(banco).definirLiberacao({
      perfilId: P1,
      liberada: "true",
      motivo: "x",
    });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    expect(banco.definirLiberacao).not.toHaveBeenCalled();
  });

  it("traduz 42501, 22023, P0002 e o resto, sem texto do banco", () => {
    const m = (code: string) => mapearErroBancoLojaAdmin({ code, message: "texto do banco" });
    expect(m("42501").codigo).toBe("SEM_PERMISSAO");
    expect(m("22023").codigo).toBe("MOTIVO_OBRIGATORIO");
    expect(m("P0002")).toMatchObject({
      codigo: "NAO_ENCONTRADO",
      mensagem: "Perfil não encontrado.",
    });
    expect(m("XX000").codigo).toBe("ERRO_INTERNO");
    for (const c of ["42501", "22023", "P0002", "XX000"]) {
      expect(m(c).mensagem).not.toContain("texto do banco");
    }
  });

  it("erro do banco na liberação volta traduzido; exceção vira erro interno", async () => {
    const svc = (b: Partial<ClienteBancoLojaAdmin>) => criarServicoLojaAdmin(fakeBanco(b));
    const entrada = { perfilId: P1, liberada: "true", motivo: "x" };
    const a = await svc({
      definirLiberacao: vi.fn(async () => ({ erro: { code: "P0002" } })),
    }).definirLiberacao(entrada);
    expect(!a.ok && a.erro.codigo).toBe("NAO_ENCONTRADO");
    const b = await svc({
      definirLiberacao: vi.fn(async () => {
        throw new Error("x");
      }),
    }).definirLiberacao(entrada);
    expect(!b.ok && b.erro.codigo).toBe("ERRO_INTERNO");
  });
});
