import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-034, decisão 2 (IM-026, IM-076, IM-086): contato e denúncia de quem NÃO está logado chegam ao banco pelo servidor.
 * Aqui: a chamada vai ao RPC certo, a chave só é pedida no instante da chamada, e a falta de configuração vira
 * falha controlada (nunca exceção, nunca texto com segredo).
 */
const rpc = vi.fn();
const criar = vi.fn();
vi.mock("@/shared/supabase/servico", () => ({ criarClienteServico: () => criar() }));

import { denunciarViaServidor, enviarContatoViaServidor } from "./chamada-publica-servidor";

const ID = "11111111-1111-4111-8111-111111111111";
const contato = {
  perfilId: ID,
  nome: "Carla Visitante",
  whatsapp: "+5551988887777",
  chave: "chave-de-teste-0123456789",
  origem: "a".repeat(64),
};
const denuncia = {
  alvoTipo: "perfil",
  alvoId: ID,
  tipo: "spam_fraude",
  texto: null,
  origem: "b".repeat(64),
  site: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  criar.mockReturnValue({ rpc });
});

describe("contato do visitante pelo servidor", () => {
  it("chama indicacoes_enviar_contato com o hash de origem, criando o cliente de serviço só agora", async () => {
    expect(criar).not.toHaveBeenCalled();
    const r = await enviarContatoViaServidor(contato as never);
    expect(criar).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]![0]).toBe("indicacoes_enviar_contato");
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_origem_hash: "a".repeat(64), p_perfil_id: ID });
    expect(r.erro).toBeNull();
  });

  it("sem chave de serviço ou URL: falha controlada (XX000), sem exceção, sem chamar o banco e sem dizer o que falta", async () => {
    criar.mockImplementation(() => {
      throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e a chave de serviço do servidor.");
    });
    const r = await enviarContatoViaServidor(contato as never);
    expect(r).toEqual({ dados: null, erro: { code: "XX000" } });
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/Configure|chave|SERVICE/i);
  });

  it("erro do banco vira ErroBanco com código, sem derrubar a ação", async () => {
    rpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { code: "P0429", message: "limite" } }),
    );
    const r = await enviarContatoViaServidor(contato as never);
    expect(r.erro).toMatchObject({ code: "P0429" });
  });
});

describe("denúncia pública pelo servidor", () => {
  it("chama administracao_denunciar com a origem calculada no servidor", async () => {
    const r = await denunciarViaServidor(denuncia as never);
    expect(rpc.mock.calls[0]![0]).toBe("administracao_denunciar");
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_origem: "b".repeat(64), p_alvo_id: ID });
    expect(r.erro).toBeNull();
  });

  it("sem chave de serviço: falha controlada e nada é gravado", async () => {
    criar.mockImplementation(() => {
      throw new Error("sem chave");
    });
    const r = await denunciarViaServidor(denuncia as never);
    expect(r.erro).toEqual({ code: "XX000" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
