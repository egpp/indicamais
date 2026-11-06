import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-034: só o visitante SEM login usa a chamada de servidor; quem está logado segue pela sessão (o banco usa auth.uid()
 * para solicitante, denunciante e conta suspensa). Os contextos comuns nunca usam a chave de serviço.
 */
const sessaoRpc = vi.fn();
const usuario = { current: null as { id: string } | null };
const viaServidor = vi.hoisted(() => ({ contato: vi.fn(), denuncia: vi.fn() }));

vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: usuario.current } }) },
    rpc: (...a: unknown[]) => {
      sessaoRpc(...a);
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));
vi.mock("@/shared/supabase/publico", () => ({ criarClientePublico: () => ({}) }));
vi.mock("./chamada-publica-servidor", () => ({
  enviarContatoViaServidor: viaServidor.contato,
  denunciarViaServidor: viaServidor.denuncia,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { obterContextoCicloVidaAberto, obterContextoDenunciaPublica } from "./contexto-ciclo-vida";
import { obterContextoContatoPublico, obterContextoIndicacoesAberto } from "./contexto-indicacoes";

const ID = "11111111-1111-4111-8111-111111111111";
const contato = {
  perfilId: ID,
  nomeDestino: "Padaria",
  nome: "Carla Visitante",
  whatsapp: "(51) 98888-7777",
  chave: "chave-de-teste-0123456789",
};
const denuncia = { alvoTipo: "perfil", alvoId: ID, tipo: "spam_fraude", origem: "b".repeat(64) };

beforeEach(() => {
  vi.clearAllMocks();
  usuario.current = null;
  viaServidor.contato.mockResolvedValue({ dados: null, erro: { code: "XX000" } });
  viaServidor.denuncia.mockResolvedValue({ erro: { code: "XX000" } });
});

describe("contexto do contato público", () => {
  it("anônimo: o envio passa pela chamada de servidor e não toca a sessão", async () => {
    const ctx = await obterContextoContatoPublico();
    await ctx.servico.enviarContato(contato as never);
    expect(viaServidor.contato).toHaveBeenCalledTimes(1);
    expect(sessaoRpc).not.toHaveBeenCalled();
  });

  it("logado: o envio segue pela sessão (auth.uid() vale) e não usa a chave de serviço", async () => {
    usuario.current = { id: ID };
    const ctx = await obterContextoContatoPublico();
    await ctx.servico.enviarContato(contato as never);
    expect(sessaoRpc.mock.calls[0]![0]).toBe("indicacoes_enviar_contato");
    expect(viaServidor.contato).not.toHaveBeenCalled();
  });

  it("o contexto comum nunca usa a chave de serviço no contato", async () => {
    const ctx = await obterContextoIndicacoesAberto();
    await ctx.servico.enviarContato(contato as never);
    expect(viaServidor.contato).not.toHaveBeenCalled();
  });
});

describe("contexto da denúncia pública", () => {
  it("anônimo: a denúncia passa pela chamada de servidor", async () => {
    const ctx = await obterContextoDenunciaPublica();
    await ctx.admin.denunciar(denuncia as never);
    expect(viaServidor.denuncia).toHaveBeenCalledTimes(1);
    expect(sessaoRpc).not.toHaveBeenCalled();
  });

  it("logado: a denúncia segue pela sessão", async () => {
    usuario.current = { id: ID };
    const ctx = await obterContextoDenunciaPublica();
    await ctx.admin.denunciar(denuncia as never);
    expect(sessaoRpc.mock.calls[0]![0]).toBe("administracao_denunciar");
    expect(viaServidor.denuncia).not.toHaveBeenCalled();
  });

  it("o contexto comum nunca usa a chave de serviço na denúncia", async () => {
    const ctx = await obterContextoCicloVidaAberto();
    await ctx.admin.denunciar(denuncia as never);
    expect(viaServidor.denuncia).not.toHaveBeenCalled();
  });
});
