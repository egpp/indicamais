import { describe, expect, it, vi } from "vitest";
import {
  alterarSecaoHomeSchema,
  criarServicoHomeAdmin,
  mapearErroBancoHomeAdmin,
  MENSAGENS_HOME_ADMIN,
  type ClienteBancoHomeAdmin,
  type LinhaSecaoHomeAdmin,
} from "./index";

const valido = {
  chave: "novidades",
  titulo: "Novidades",
  ativa: true,
  ordem: 1,
  minimoItens: 4,
  limitePadrao: 10,
  motivo: "Ajuste de texto",
};

const linha = (extra: Partial<LinhaSecaoHomeAdmin> = {}): LinhaSecaoHomeAdmin => ({
  chave: "novidades",
  titulo: "Novidades",
  ativa: true,
  ordem: 1,
  minimo_itens: 4,
  limite_padrao: 10,
  tipo_item: "perfil",
  atualizado_em: "2026-11-03T12:00:00Z",
  ...extra,
});

function fake(
  opcoes: { admin?: boolean; linhas?: LinhaSecaoHomeAdmin[]; erro?: { code: string } } = {},
) {
  const alterarSecao = vi.fn<ClienteBancoHomeAdmin["alterarSecao"]>(async () => ({
    erro: opcoes.erro ?? null,
  }));
  const listarSecoes = vi.fn<ClienteBancoHomeAdmin["listarSecoes"]>(async () => ({
    dados: opcoes.linhas ?? [linha()],
    erro: null,
  }));
  const banco: ClienteBancoHomeAdmin = {
    ehAdministrador: async () => opcoes.admin ?? true,
    listarSecoes,
    alterarSecao,
  };
  return { banco, alterarSecao, listarSecoes };
}

describe("alterarSecaoHomeSchema", () => {
  it("aceita entrada válida e normaliza espaços do título", () => {
    const r = alterarSecaoHomeSchema.safeParse({ ...valido, titulo: "  Mais   curtidos " });
    expect(r.success && r.data.titulo).toBe("Mais curtidos");
  });
  it("aceita texto de formulário (números e booleano em string)", () => {
    const r = alterarSecaoHomeSchema.safeParse({
      ...valido,
      ativa: "on",
      ordem: "2",
      minimoItens: "3",
      limitePadrao: "12",
    });
    expect(
      r.success && [r.data.ativa, r.data.ordem, r.data.minimoItens, r.data.limitePadrao],
    ).toEqual([true, 2, 3, 12]);
  });
  it.each([
    ["título curto", { titulo: "ab" }, "titulo"],
    ["título longo", { titulo: "a".repeat(41) }, "titulo"],
    ["título com link", { titulo: "Veja www.x.com" }, "titulo"],
    ["título com emoji", { titulo: "Top 🔥" }, "titulo"],
    ["título com marcação", { titulo: "<b>Top</b>" }, "titulo"],
    ["título vazio", { titulo: "   " }, "titulo"],
    ["ordem 0", { ordem: 0 }, "ordem"],
    ["ordem 100", { ordem: 100 }, "ordem"],
    ["ordem decimal", { ordem: 1.5 }, "ordem"],
    ["mínimo 0", { minimoItens: 0 }, "minimoItens"],
    ["mínimo 21", { minimoItens: 21, limitePadrao: 30 }, "minimoItens"],
    ["limite 0", { limitePadrao: 0, minimoItens: 1 }, "limitePadrao"],
    ["limite 31", { limitePadrao: 31 }, "limitePadrao"],
    ["limite menor que mínimo", { minimoItens: 8, limitePadrao: 5 }, "limitePadrao"],
    ["sem motivo", { motivo: "" }, "motivo"],
    ["motivo só espaços", { motivo: "   " }, "motivo"],
    ["motivo longo", { motivo: "x".repeat(501) }, "motivo"],
    ["chave desconhecida", { chave: "mais_visitados" }, "chave"],
    ["ativa inválida", { ativa: "talvez" }, "ativa"],
  ])("recusa %s", (_n, extra, campo) => {
    const r = alterarSecaoHomeSchema.safeParse({ ...valido, ...extra });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
  });
  it("limite igual ao mínimo é aceito (borda)", () => {
    expect(
      alterarSecaoHomeSchema.safeParse({ ...valido, minimoItens: 5, limitePadrao: 5 }).success,
    ).toBe(true);
  });
});

describe("mapearErroBancoHomeAdmin", () => {
  it.each([
    ["42501", "SEM_PERMISSAO"],
    ["22023", "MOTIVO_OBRIGATORIO"],
    ["23514", "VALIDACAO"],
    ["P0002", "NAO_ENCONTRADO"],
    ["XX000", "ERRO_INTERNO"],
    [undefined, "ERRO_INTERNO"],
  ])("%s vira %s sem vazar o texto do banco", (code, codigo) => {
    const e = mapearErroBancoHomeAdmin({ code, message: "relation busca_home_secao constraint x" });
    expect(e.codigo).toBe(codigo);
    expect(e.mensagem).not.toMatch(/busca_home|constraint|relation/);
  });
});

describe("serviço de administração das seções da home", () => {
  it("não administrador não lista nem altera, e o banco nem é chamado", async () => {
    const f = fake({ admin: false });
    const s = criarServicoHomeAdmin(f.banco);
    const a = await s.listarSecoesHome();
    const b = await s.alterarSecaoHome(valido);
    expect(a.ok === false && a.erro.codigo).toBe("SEM_PERMISSAO");
    expect(b.ok === false && b.erro.codigo).toBe("SEM_PERMISSAO");
    expect(f.listarSecoes).not.toHaveBeenCalled();
    expect(f.alterarSecao).not.toHaveBeenCalled();
  });
  it("falha na checagem de papel falha fechado", async () => {
    const banco: ClienteBancoHomeAdmin = {
      ehAdministrador: async () => {
        throw new Error("x");
      },
      listarSecoes: async () => ({ dados: [linha()], erro: null }),
      alterarSecao: async () => ({ erro: null }),
    };
    const r = await criarServicoHomeAdmin(banco).listarSecoesHome();
    expect(r.ok === false && r.erro.codigo).toBe("SEM_PERMISSAO");
  });
  it("lista todas em ordem, inclusive inativas, e ignora chave desconhecida", async () => {
    const f = fake({
      linhas: [
        linha({ chave: "mais_curtidos", ordem: 3, ativa: false }),
        linha({ chave: "outra" }),
        linha({ chave: "novidades", ordem: 1 }),
      ],
    });
    const r = await criarServicoHomeAdmin(f.banco).listarSecoesHome();
    expect(r.ok && r.valor.map((s) => [s.chave, s.ativa])).toEqual([
      ["novidades", true],
      ["mais_curtidos", false],
    ]);
  });
  it("altera repassando parâmetros do banco e o motivo", async () => {
    const f = fake();
    const r = await criarServicoHomeAdmin(f.banco).alterarSecaoHome({ ...valido, ativa: false });
    expect(r.ok).toBe(true);
    expect(f.alterarSecao).toHaveBeenCalledWith({
      p_chave: "novidades",
      p_titulo: "Novidades",
      p_ativa: false,
      p_ordem: 1,
      p_minimo_itens: 4,
      p_limite_padrao: 10,
      p_motivo: "Ajuste de texto",
    });
  });
  it("sem motivo: MOTIVO_OBRIGATORIO e nada gravado", async () => {
    const f = fake();
    const r = await criarServicoHomeAdmin(f.banco).alterarSecaoHome({ ...valido, motivo: "" });
    expect(r.ok === false && r.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    expect(f.alterarSecao).not.toHaveBeenCalled();
  });
  it("entrada inválida não chega ao banco", async () => {
    const f = fake();
    const r = await criarServicoHomeAdmin(f.banco).alterarSecaoHome({ ...valido, ordem: 500 });
    expect(r.ok === false && r.erro.campos?.ordem).toBeTruthy();
    expect(f.alterarSecao).not.toHaveBeenCalled();
  });
  it("erro do banco vira mensagem traduzida", async () => {
    const f = fake({ erro: { code: "P0002" } });
    const r = await criarServicoHomeAdmin(f.banco).alterarSecaoHome(valido);
    expect(r.ok === false && r.erro.mensagem).toBe(MENSAGENS_HOME_ADMIN.naoEncontrada);
  });
});
