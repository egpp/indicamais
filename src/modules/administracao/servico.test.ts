import { describe, expect, it, vi } from "vitest";
import {
  criarServicoAdministracao,
  decidirRevisaoSchema,
  mapearErroBancoAdministracao,
  ordenarFila,
  paraItemFila,
  podeDecidir,
  resultadoDaRevisao,
  type ClienteBancoAdministracao,
  type LinhaFila,
  type LinhaResultadoRevisao,
  type NotificadorRevisao,
} from "./index";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DONO = "11111111-1111-4111-8111-111111111111";
const V1 = "00000000-0000-4000-8000-000000000001";
const V2 = "00000000-0000-4000-8000-000000000002";
const P1 = "00000000-0000-4000-8000-0000000000a1";

const fila = (p: Partial<LinhaFila> = {}): LinhaFila => ({
  alvo_tipo: "perfil",
  versao_id: V1,
  alvo_id: P1,
  nome: "Padaria",
  enviada_em: "2026-10-23T10:00:00Z",
  dono_id: DONO,
  eh_edicao: false,
  ...p,
});

function fake(over: Partial<ClienteBancoAdministracao> = {}, contaId = ADMIN) {
  const banco: ClienteBancoAdministracao = {
    contaId,
    listarFila: vi.fn(async () => ({ dados: [fila()], erro: null })),
    decidirPerfil: vi.fn(async () => ({ erro: null })),
    decidirItem: vi.fn(async () => ({ erro: null })),
    listarMinhasRevisoes: vi.fn(async () => ({ dados: [], erro: null })),
    ...over,
  };
  return banco;
}

describe("fila de revisão (IM-021, IM-023)", () => {
  it("ordena do mais antigo e marca o conteúdo do próprio administrador", async () => {
    const banco = fake({
      listarFila: async () => ({
        dados: [
          fila({ versao_id: V2, enviada_em: "2026-10-23T12:00:00Z", dono_id: ADMIN }),
          fila({ versao_id: V1, enviada_em: "2026-10-23T09:00:00Z" }),
        ],
        erro: null,
      }),
    });
    const r = await criarServicoAdministracao(banco).listarFila();
    expect(r.ok && r.valor.map((i) => i.versaoId)).toEqual([V1, V2]);
    expect(r.ok && r.valor.map((i) => i.proprio)).toEqual([false, true]);
  });

  it("quem não é administrador recebe fila vazia ou erro de permissão, sem texto do banco", async () => {
    const vazio = await criarServicoAdministracao(
      fake({ listarFila: async () => ({ dados: [], erro: null }) }),
    ).listarFila();
    expect(vazio.ok && vazio.valor).toEqual([]);
    const negado = await criarServicoAdministracao(
      fake({
        listarFila: async () => ({
          dados: null,
          erro: { code: "42501", message: "permission denied for view SEGREDO" },
        }),
      }),
    ).listarFila();
    expect(!negado.ok && negado.erro.codigo).toBe("SEM_PERMISSAO");
    expect(JSON.stringify(negado)).not.toContain("SEGREDO");
  });

  it("regras puras", () => {
    expect(podeDecidir({ adminId: ADMIN, donoId: DONO })).toBe(true);
    expect(podeDecidir({ adminId: ADMIN, donoId: ADMIN })).toBe(false);
    expect(paraItemFila(fila({ eh_edicao: true }), ADMIN).ehEdicao).toBe(true);
    expect(ordenarFila([])).toEqual([]);
  });
});

describe("decidir (IM-021, IM-023)", () => {
  it("aprova perfil pelo banco e devolve a decisão", async () => {
    const banco = fake();
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(r.ok && r.valor.decisao).toBe("aprovada");
    expect(banco.decidirPerfil).toHaveBeenCalledWith({ versaoId: V1, aprovar: true, motivo: null });
    expect(banco.decidirItem).not.toHaveBeenCalled();
  });

  it("decide item pela função de itens", async () => {
    const banco = fake({
      listarFila: async () => ({ dados: [fila({ alvo_tipo: "item" })], erro: null }),
    });
    await criarServicoAdministracao(banco).decidir({
      alvo: "item",
      versaoId: V1,
      aprovar: false,
      motivo: "Foto não corresponde ao produto",
    });
    expect(banco.decidirItem).toHaveBeenCalledWith({
      versaoId: V1,
      aprovar: false,
      motivo: "Foto não corresponde ao produto",
    });
    expect(banco.decidirPerfil).not.toHaveBeenCalled();
  });

  it("rejeição SEM motivo é recusada antes do banco", async () => {
    const banco = fake();
    const svc = criarServicoAdministracao(banco);
    for (const motivo of [undefined, "", "   ", null]) {
      const r = await svc.decidir({ alvo: "perfil", versaoId: V1, aprovar: false, motivo });
      expect(!r.ok && r.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    }
    expect(banco.decidirPerfil).not.toHaveBeenCalled();
  });

  it("motivo maior que 500 caracteres é recusado", async () => {
    const r = await criarServicoAdministracao(fake()).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: false,
      motivo: "m".repeat(501),
    });
    expect(r.ok).toBe(false);
  });

  it("entrada inválida (alvo, id, aprovar ausente) não chega ao banco", async () => {
    const banco = fake();
    const svc = criarServicoAdministracao(banco);
    for (const e of [
      { alvo: "conta", versaoId: V1, aprovar: true },
      { alvo: "perfil", versaoId: "x", aprovar: true },
      { alvo: "perfil", versaoId: V1 },
      { alvo: "perfil", versaoId: V1, aprovar: "sim" },
      null,
    ]) {
      expect((await svc.decidir(e)).ok).toBe(false);
    }
    expect(banco.decidirPerfil).not.toHaveBeenCalled();
    expect(decidirRevisaoSchema.safeParse({}).success).toBe(false);
  });

  it("o dono NÃO aprova o próprio conteúdo: recusado antes do banco, com mensagem clara", async () => {
    const banco = fake(
      { listarFila: async () => ({ dados: [fila({ dono_id: ADMIN })], erro: null }) },
      ADMIN,
    );
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(!r.ok && r.erro.codigo).toBe("AUTO_APROVACAO");
    expect(!r.ok && r.erro.mensagem).toMatch(/próprio conteúdo/);
    expect(banco.decidirPerfil).not.toHaveBeenCalled();
  });

  it("o dono também não rejeita o próprio conteúdo", async () => {
    const banco = fake(
      { listarFila: async () => ({ dados: [fila({ dono_id: ADMIN })], erro: null }) },
      ADMIN,
    );
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: false,
      motivo: "teste",
    });
    expect(!r.ok && r.erro.codigo).toBe("AUTO_APROVACAO");
  });

  it("se o banco recusar a auto-aprovação (42501), trata com a mesma mensagem clara", async () => {
    const banco = fake({
      listarFila: async () => ({ dados: [], erro: null }),
      decidirPerfil: async () => ({
        erro: { code: "42501", message: "o responsável não decide o próprio conteúdo" },
      }),
    });
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(!r.ok && r.erro.codigo).toBe("AUTO_APROVACAO");
    expect(!r.ok && r.erro.mensagem).not.toMatch(/42501|responsável não decide/);
  });

  it("não-administrador (42501 de acesso) recebe mensagem de permissão", async () => {
    const banco = fake({
      decidirPerfil: async () => ({
        erro: { code: "42501", message: "acesso restrito a administradores" },
      }),
    });
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
  });

  it("versão já decidida (P0001) e inexistente (P0002) viram mensagens claras", async () => {
    const ja = await criarServicoAdministracao(
      fake({
        decidirPerfil: async () => ({
          erro: { code: "P0001", message: "só versão pendente pode ser decidida" },
        }),
      }),
    ).decidir({ alvo: "perfil", versaoId: V1, aprovar: true });
    expect(!ja.ok && ja.erro.codigo).toBe("JA_DECIDIDA");
    const nao = await criarServicoAdministracao(
      fake({
        decidirPerfil: async () => ({ erro: { code: "P0002", message: "versão não encontrada" } }),
      }),
    ).decidir({ alvo: "perfil", versaoId: V1, aprovar: true });
    expect(!nao.ok && nao.erro.codigo).toBe("NAO_ENCONTRADO");
  });

  it("22023 do banco (motivo obrigatório) vira mensagem de motivo", () => {
    expect(
      mapearErroBancoAdministracao({ code: "22023", message: "motivo obrigatório" }).codigo,
    ).toBe("MOTIVO_OBRIGATORIO");
    expect(
      mapearErroBancoAdministracao({ code: "23514", constraint: "perfis_revisao_motivo" }).codigo,
    ).toBe("MOTIVO_OBRIGATORIO");
    expect(
      mapearErroBancoAdministracao({ code: "XX000", message: "SEGREDO" }).mensagem,
    ).not.toContain("SEGREDO");
  });

  it("exceção do banco injetado vira erro genérico", async () => {
    const banco = fake({
      decidirPerfil: async () => {
        throw new Error("postgres://segredo");
      },
    });
    const r = await criarServicoAdministracao(banco).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});

describe("ponto de extensão do e-mail do resultado (D-006)", () => {
  it("o notificador recebe o evento sem e-mail/telefone; só em decisão bem-sucedida", async () => {
    const aoDecidir = vi.fn(async () => {});
    const notificador: NotificadorRevisao = { aoDecidir };
    const svc = criarServicoAdministracao(fake(), {
      notificador,
      agora: () => new Date("2026-10-23T15:00:00Z"),
    });
    await svc.decidir({ alvo: "perfil", versaoId: V1, aprovar: false, motivo: "Imagem ilegível" });
    expect(aoDecidir).toHaveBeenCalledWith({
      alvo: "perfil",
      versaoId: V1,
      decisao: "rejeitada",
      motivo: "Imagem ilegível",
      decididoPor: ADMIN,
      decididaEm: "2026-10-23T15:00:00.000Z",
      donoId: DONO,
    });
    const json = JSON.stringify(aoDecidir.mock.calls);
    expect(json).not.toMatch(/@|whatsapp|telefone|email/i);
  });

  it("não notifica quando a decisão falha", async () => {
    const aoDecidir = vi.fn(async () => {});
    const banco = fake({ decidirPerfil: async () => ({ erro: { code: "P0001" } }) });
    await criarServicoAdministracao(banco, { notificador: { aoDecidir } }).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(aoDecidir).not.toHaveBeenCalled();
  });

  it("falha do notificador não desfaz nem esconde a decisão", async () => {
    const svc = criarServicoAdministracao(fake(), {
      notificador: {
        aoDecidir: async () => {
          throw new Error("SMTP fora do ar");
        },
      },
    });
    const r = await svc.decidir({ alvo: "perfil", versaoId: V1, aprovar: true });
    expect(r.ok && r.valor.decisao).toBe("aprovada");
  });

  it("sem notificador injetado, nada é enviado (padrão nulo)", async () => {
    const r = await criarServicoAdministracao(fake()).decidir({
      alvo: "perfil",
      versaoId: V1,
      aprovar: true,
    });
    expect(r.ok).toBe(true);
  });
});

describe("resultado da revisão para o responsável (IM-023)", () => {
  const base: LinhaResultadoRevisao = {
    alvo_tipo: "perfil",
    alvo_id: P1,
    versao_id: V1,
    nome: "Padaria",
    slug: "padaria",
    enviada_em: "2026-10-23T10:00:00Z",
    situacao: "aprovada",
    motivo: null,
    autor_id: ADMIN,
    decidida_em: "2026-10-23T11:00:00Z",
    publicado: true,
    versao_aprovada_id: V1,
  };

  it("aprovado e publicado: situação, link, autor e data", () => {
    const r = resultadoDaRevisao(base);
    expect(r.situacao).toBe("aprovado");
    expect(r.linkPublicado).toBe("/perfil/padaria");
    expect(r.autorId).toBe(ADMIN);
    expect(r.decididaEm).toBe("2026-10-23T11:00:00Z");
    expect(r.motivo).toBeNull();
  });

  it("item aprovado tem link do item", () => {
    const r = resultadoDaRevisao({ ...base, alvo_tipo: "item", alvo_id: V2, slug: null });
    expect(r.linkPublicado).toBe(`/item/${V2}`);
  });

  it("aprovado mas DESPUBLICADO: sem link", () => {
    const r = resultadoDaRevisao({ ...base, publicado: false });
    expect(r.situacao).toBe("aprovado");
    expect(r.linkPublicado).toBeNull();
    expect(r.mensagem).toMatch(/despublicado/);
  });

  it("aprovação substituída por versão mais nova: sem link", () => {
    const r = resultadoDaRevisao({ ...base, versao_aprovada_id: V2 });
    expect(r.linkPublicado).toBeNull();
    expect(r.mensagem).toMatch(/substituído/);
  });

  it("rejeitado: motivo, sem link, com autor e data", () => {
    const r = resultadoDaRevisao({
      ...base,
      situacao: "rejeitada",
      motivo: "Descrição com termos proibidos",
      publicado: false,
      versao_aprovada_id: null,
    });
    expect(r.situacao).toBe("rejeitado");
    expect(r.motivo).toBe("Descrição com termos proibidos");
    expect(r.linkPublicado).toBeNull();
    expect(r.autorId).toBe(ADMIN);
    expect(r.decididaEm).not.toBeNull();
  });

  it("em análise: sem motivo, sem link, sem autor", () => {
    const r = resultadoDaRevisao({
      ...base,
      situacao: "pendente",
      autor_id: null,
      decidida_em: null,
      publicado: false,
      versao_aprovada_id: null,
    });
    expect(r.situacao).toBe("em_analise");
    expect(r.linkPublicado).toBeNull();
    expect(r.motivo).toBeNull();
    expect(r.autorId).toBeNull();
    expect(r.decididaEm).toBeNull();
  });

  it("aprovação nunca expõe motivo interno; slug com caracteres especiais é codificado", () => {
    const r = resultadoDaRevisao({ ...base, motivo: "nota interna", slug: "a/b?c" });
    expect(r.motivo).toBeNull();
    expect(r.linkPublicado).toBe("/perfil/a%2Fb%3Fc");
  });

  it("lista meus resultados, mais recentes primeiro", async () => {
    const banco = fake({
      listarMinhasRevisoes: async () => ({
        dados: [
          { ...base, versao_id: V1, decidida_em: "2026-10-20T10:00:00Z" },
          { ...base, versao_id: V2, decidida_em: "2026-10-22T10:00:00Z" },
        ],
        erro: null,
      }),
    });
    const r = await criarServicoAdministracao(banco).listarMeusResultados();
    expect(r.ok && r.valor.map((x) => x.versaoId)).toEqual([V2, V1]);
  });

  it("erro do banco vira mensagem genérica", async () => {
    const banco = fake({
      listarMinhasRevisoes: async () => ({
        dados: null,
        erro: { code: "XX000", message: "SEGREDO" },
      }),
    });
    const r = await criarServicoAdministracao(banco).listarMeusResultados();
    expect(!r.ok && r.erro.mensagem).not.toContain("SEGREDO");
  });
});
