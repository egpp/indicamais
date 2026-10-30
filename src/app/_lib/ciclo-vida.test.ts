import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  criarServicoCicloVida,
  MENSAGENS_CICLO,
  type ClienteBancoCicloVida,
} from "@/modules/administracao";
import { criarServicoCicloVidaConta } from "@/modules/contas";
import { criarContextoCicloVida } from "./contexto-ciclo-vida";
import { ipDoPedido, origemDaDenuncia } from "./origem-denuncia";
import {
  decidirDenuncia,
  enviarDenuncia,
  invalidarIndicacao,
  sincronizarAcesso,
  solicitarEncerramento,
  suspenderConta,
} from "./tratadores-ciclo-vida";

vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/shared/supabase/acesso-conta", () => ({
  bloquearAcessoNoAuth: vi.fn().mockResolvedValue({ ok: true }),
  liberarAcessoNoAuth: vi.fn().mockResolvedValue({ ok: true }),
}));

const ID = "0b6f1c1e-7d0e-4c55-8a53-0d2b9f5a1111";
const sem = async () => ({ erro: null });

function banco(extra: Partial<ClienteBancoCicloVida> = {}): ClienteBancoCicloVida {
  return {
    listarMinhasPermissoes: async () => ({ dados: [], erro: null }),
    listarPermissoesConcedidas: async () => ({ dados: [], erro: null }),
    concederPermissao: sem,
    revogarPermissao: sem,
    denunciar: sem,
    listarFilaDenuncias: async () => ({ dados: [], erro: null }),
    listarDecisoesDenuncia: async () => ({ dados: [], erro: null }),
    decidirDenuncia: sem,
    suspenderConta: sem,
    reativarConta: sem,
    listarContasCicloVida: async () => ({ dados: [], erro: null }),
    invalidarIndicacao: async () => ({ dados: null, erro: null }),
    listarIndicacoesInvalidadas: async () => ({ dados: [], erro: null }),
    ...extra,
  };
}

function ctx(extra: Partial<ClienteBancoCicloVida> = {}) {
  return criarContextoCicloVida({
    admin: criarServicoCicloVida(banco(extra)),
    conta: criarServicoCicloVidaConta({
      lerMeuEstado: async () => ({ dados: [], erro: null }),
      solicitarEncerramento: async () => ({ dados: "2026-12-01T00:00:00Z", erro: null }),
      cancelarEncerramento: sem,
    }),
    logado: true,
  });
}

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("origem da denúncia (IM-076)", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it("hash sha256 de IP + navegador, nunca o IP cru", async () => {
    const o = await origemDaDenuncia(
      h({ "cf-connecting-ip": "203.0.113.9", "user-agent": "Teste/1" }),
    );
    expect(o).toBe(createHash("sha256").update("203.0.113.9|Teste/1").digest("hex"));
    expect(o).not.toContain("203");
  });
  it("prefere cf-connecting-ip; senão o primeiro de x-forwarded-for; sem IP não há origem", async () => {
    expect(ipDoPedido(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
      "1.1.1.1",
    );
    expect(ipDoPedido(h({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(await origemDaDenuncia(h({}))).toBeUndefined();
  });
});

describe("denúncia pública (IM-076)", () => {
  const entrada = { alvoTipo: "perfil", alvoId: ID, tipo: "spam_fraude", texto: "", site: "" };
  it("resposta neutra igual para aceita, robô e alvo inexistente", async () => {
    const aceita = await enviarDenuncia(ctx(), form(entrada), undefined);
    const robo = await enviarDenuncia(ctx(), form({ ...entrada, site: "http://spam" }), undefined);
    const inexistente = await enviarDenuncia(
      ctx({ denunciar: async () => ({ erro: { code: "P0002" } }) }),
      form(entrada),
      undefined,
    );
    expect(aceita.sucesso).toBe(MENSAGENS_CICLO.denunciaRecebida);
    expect(robo.sucesso).toBe(aceita.sucesso);
    // P0002 vira erro genérico neutro, nunca "alvo não existe".
    expect(inexistente.erro).toBe(MENSAGENS_CICLO.denunciaIndisponivel);
  });
  it("tipo inválido volta erro de validação; limite tem mensagem própria", async () => {
    const invalida = await enviarDenuncia(ctx(), form({ ...entrada, tipo: "x" }), undefined);
    expect(invalida.erros?.tipo ?? invalida.erro).toBeTruthy();
    const limite = await enviarDenuncia(
      ctx({ denunciar: async () => ({ erro: { code: "P0429" } }) }),
      form(entrada),
      undefined,
    );
    expect(limite.erro).toBe(MENSAGENS_CICLO.denunciaLimite);
  });
});

describe("administração (IM-076, IM-077, IM-080)", () => {
  it("decidir exige motivo e não suspende nada", async () => {
    const suspender = vi.fn(sem);
    const c = ctx({ suspenderConta: suspender });
    const sem_motivo = await decidirDenuncia(
      c,
      form({ denunciaId: ID, decisao: "procedente", motivo: "" }),
    );
    expect(sem_motivo.erros?.motivo ?? sem_motivo.erro).toBeTruthy();
    const ok = await decidirDenuncia(
      c,
      form({ denunciaId: ID, decisao: "procedente", motivo: "Confirmado" }),
    );
    expect(ok.sucesso).toContain("Nenhuma conta foi suspensa");
    expect(suspender).not.toHaveBeenCalled();
  });

  it("invalidar com saldo negativo pede confirmação e preserva o que foi digitado", async () => {
    const c = ctx({ invalidarIndicacao: async () => ({ dados: null, erro: { code: "P0410" } }) });
    const r = await invalidarIndicacao(c, form({ pedidoId: ID, motivo: "Fraude" }));
    expect(r.pedirConfirmacao).toBe(true);
    expect(r.valores?.motivo).toBe("Fraude");
  });

  it("falha ao bloquear no Auth avisa sem desfazer a suspensão", async () => {
    const c = ctx();
    c.falhas.suspender = true;
    const r = await suspenderConta(c, form({ contaId: ID, motivo: "Fraude comprovada" }));
    expect(r.erro).toContain("Sincronizar acesso");
    expect(r.sucesso).toBeUndefined();
  });

  it("sincronizar acesso exige a permissão suspender (usa chave de serviço)", async () => {
    const sem_perm = await sincronizarAcesso(ctx(), form({ contaId: ID }));
    expect(sem_perm.erro).toBe(MENSAGENS_CICLO.semPermissao);
    const com = ctx({
      listarMinhasPermissoes: async () => ({
        dados: [{ permissao: "suspender", criado_em: "" }],
        erro: null,
      }),
    });
    expect((await sincronizarAcesso(com, form({ contaId: ID }))).sucesso).toBeTruthy();
  });
});

describe("encerrar a própria conta (IM-081)", () => {
  it("exige a palavra ENCERRAR", async () => {
    const r = await solicitarEncerramento(ctx(), form({ confirmacao: "sim" }));
    expect(r.erros?.confirmacao).toContain("ENCERRAR");
    expect(
      (await solicitarEncerramento(ctx(), form({ confirmacao: "encerrar" }))).sucesso,
    ).toBeTruthy();
  });
});
