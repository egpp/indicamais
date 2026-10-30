import { describe, expect, it, vi } from "vitest";
import {
  ENVIADOR_EMAIL_SEM_PROVEDOR,
  ERRO_PROVEDOR_NAO_CONFIGURADO,
  type ClienteBancoNotificacoes,
} from "@/modules/indicacoes";
import {
  dispararNotificacoes,
  provedorEmailConfigurado,
  type DependenciasDisparo,
} from "./notificacoes-contato";

const PEDIDO = "22222222-2222-4222-8222-222222222222";

function bancoFalso() {
  const registrados: { pedidoId: string; sucesso: boolean; erro: string | null }[] = [];
  const banco: ClienteBancoNotificacoes = {
    listarPendentes: async () => ({
      dados: [
        {
          o_pedido_id: PEDIDO,
          o_email_responsavel: "dono@exemplo.com",
          o_destino_tipo: "perfil",
          o_destino_nome: "Padaria da Ana",
          o_tentativas: 0,
        },
      ],
      erro: null,
    }),
    registrar: async (a) => {
      registrados.push(a);
      return { erro: null };
    },
  };
  return { banco, registrados };
}

function deps(extra: Partial<DependenciasDisparo> = {}) {
  const { banco, registrados } = bancoFalso();
  const agendadas: (() => Promise<void>)[] = [];
  const criarBanco = vi.fn(() => banco);
  const d: DependenciasDisparo = {
    configurado: true,
    criarBanco,
    enviador: ENVIADOR_EMAIL_SEM_PROVEDOR,
    urlPainel: "https://app.exemplo/pedidos-de-contato",
    agendar: (t) => void agendadas.push(t),
    ...extra,
  };
  return { d, agendadas, registrados, criarBanco };
}

describe("provedor de e-mail (IM-027, IM-028)", () => {
  it("só uma EMAIL_API_KEY preenchida liga o disparo", () => {
    expect(provedorEmailConfigurado({})).toBe(false);
    expect(provedorEmailConfigurado({ EMAIL_API_KEY: "" })).toBe(false);
    expect(provedorEmailConfigurado({ EMAIL_API_KEY: "   " })).toBe(false);
    expect(provedorEmailConfigurado({ EMAIL_API_KEY: "chave" })).toBe(true);
  });
});

describe("disparo das notificações em segundo plano", () => {
  it("sem provedor: não agenda nada e nem cria o cliente de serviço; o pedido segue pendente", () => {
    const { d, agendadas, criarBanco, registrados } = deps({ configurado: false });
    expect(dispararNotificacoes(d)).toBe(false);
    expect(agendadas).toHaveLength(0);
    expect(criarBanco).not.toHaveBeenCalled();
    expect(registrados).toHaveLength(0);
  });

  it("sem URL do painel: não dispara (o e-mail não teria para onde apontar)", () => {
    const { d, agendadas } = deps({ urlPainel: null });
    expect(dispararNotificacoes(d)).toBe(false);
    expect(agendadas).toHaveLength(0);
  });

  it("com provedor: agenda em segundo plano e, ao rodar, registra a falha controlada do enviador padrão", async () => {
    const { d, agendadas, registrados, criarBanco } = deps();
    expect(dispararNotificacoes(d)).toBe(true);
    // Nada roda antes de a tarefa em segundo plano ser executada.
    expect(criarBanco).not.toHaveBeenCalled();
    await agendadas[0]!();
    expect(registrados).toEqual([
      { pedidoId: PEDIDO, sucesso: false, erro: ERRO_PROVEDOR_NAO_CONFIGURADO },
    ]);
  });

  it("falha ao criar o cliente de serviço não vaza e não derruba a requisição", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { d, agendadas } = deps({
      criarBanco: () => {
        throw new Error("Configure a chave: valor-secreto-123");
      },
    });
    expect(dispararNotificacoes(d)).toBe(true);
    await expect(agendadas[0]!()).resolves.toBeUndefined();
    const registrado = JSON.stringify(erro.mock.calls);
    expect(registrado).not.toContain("valor-secreto-123");
    erro.mockRestore();
  });
});
