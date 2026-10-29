import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formulario } from "../../tests/suporte/bancos-memoria";
import { criarMundoIndicacoes } from "../../tests/suporte/banco-indicacoes-memoria";
import { criarMundoPublico } from "../../tests/suporte/bancos-publicos-memoria";
import type { ContextoIndicacoes } from "./_lib/contexto-indicacoes";
import type { Usuario } from "../../tests/suporte/banco-indicacoes-memoria";

let obter: () => Promise<ContextoIndicacoes>;
const disparar = vi.fn(() => true);
const revalidar = vi.fn();

vi.mock("./_lib/contexto-indicacoes", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-indicacoes")>()),
  obterContextoIndicacoes: () => obter(),
  obterContextoIndicacoesAberto: () => obter(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("./_lib/notificacoes-contato", () => ({
  dispararNotificacoesDoServidor: (...a: unknown[]) => disparar(...(a as [])),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidar(...a) }));

import {
  acaoEnviarContato,
  acaoGerarLink,
  acaoPedirReenvio,
  acaoReenviarComoAdmin,
  acaoRegistrarCompartilhamento,
  acaoTratarAlerta,
} from "./acoes-indicacoes";

const dados = {
  tipo: "perfil",
  slug: "padaria-da-ana",
  nome: "Carla Visitante",
  whatsapp: "(11) 98765-4321",
  email: "",
  mensagem: "",
  chave: "chave-de-teste-0123456789",
};

function mundo(usuario: Usuario | null = null) {
  const publico = criarMundoPublico();
  publico.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
  const m = criarMundoIndicacoes({ usuario });
  obter = async () => m.contexto(publico.contexto().leitura);
  return m;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Server Actions da Fase 3", () => {
  it("contato com sucesso: devolve o wa.me e dispara o aviso em segundo plano (que só age com provedor)", async () => {
    mundo(null);
    const r = await acaoEnviarContato({}, formulario(dados));
    expect(r.urlWhatsapp).toMatch(/^https:\/\/wa\.me\/5551988887777\?text=/);
    expect(disparar).toHaveBeenCalledTimes(1);
    expect(revalidar).toHaveBeenCalledWith("/pedidos-de-contato");
  });

  it("contato com erro de validação: nada é disparado", async () => {
    mundo(null);
    const r = await acaoEnviarContato({}, formulario({ ...dados, nome: "" }));
    expect(r.erros?.nome).toBe("Informe seu nome.");
    expect(disparar).not.toHaveBeenCalled();
  });

  it("falha do disparo nunca chega ao visitante: o pedido já está salvo", async () => {
    mundo(null);
    disparar.mockImplementationOnce(() => {
      throw new Error("chave secreta xyz");
    });
    const r = await acaoEnviarContato({}, formulario(dados));
    expect(r.urlWhatsapp).toBeTruthy();
    expect(r.erro).toBeUndefined();
  });

  it("falha inesperada: mensagem genérica, sem texto interno, e o que foi digitado é mantido", async () => {
    obter = async () => {
      throw new Error("postgres://usuario:senha@host/db caiu");
    };
    const r = await acaoEnviarContato({}, formulario(dados));
    expect(r.erro).toBe("Não foi possível concluir agora. Tente novamente em instantes.");
    expect(JSON.stringify(r)).not.toMatch(/postgres|senha/);
    expect(r.valores).toMatchObject({ nome: "Carla Visitante", whatsapp: "(11) 98765-4321" });
    expect(disparar).not.toHaveBeenCalled();
  });

  it("redirecionamento do Next passa adiante (sessão expirada)", async () => {
    obter = async () => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/entrar" });
    };
    await expect(acaoPedirReenvio({}, formulario({ pedidoId: randomUUID() }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });

  it("gerar link e registrar compartilhamento", async () => {
    const m = mundo({ id: randomUUID(), comWhatsapp: true });
    const r = await acaoGerarLink({}, formulario({ tipo: "perfil", slug: "padaria-da-ana" }));
    expect(r.link?.codigo).toMatch(/^[0-9a-f]{32}$/);
    expect(await acaoRegistrarCompartilhamento(r.link!.codigo, "copiar")).toBe(true);
    expect(m.compartilhamentos).toEqual([{ codigo: r.link!.codigo, canal: "copiar" }]);
    obter = async () => {
      throw new Error("boom");
    };
    expect(await acaoRegistrarCompartilhamento(r.link!.codigo, "copiar")).toBe(false);
  });

  it("reenvio do responsável dispara o aviso; o do administrador ignora o limite de tentativas", async () => {
    mundo({ id: randomUUID(), admin: true });
    const pedidoId = randomUUID();
    await acaoPedirReenvio({}, formulario({ pedidoId }));
    expect(disparar).toHaveBeenLastCalledWith();
    await acaoReenviarComoAdmin({}, formulario({ pedidoId, motivo: "Corrigido" }));
    expect(disparar).toHaveBeenLastCalledWith({ ignorarLimiteTentativas: true });
    expect(disparar).toHaveBeenCalledTimes(2);
  });

  it("tratar alerta e reenvio sem motivo: erro por campo e nada disparado", async () => {
    mundo({ id: randomUUID(), admin: true });
    const pedidoId = randomUUID();
    const a = await acaoReenviarComoAdmin({}, formulario({ pedidoId, motivo: "" }));
    const b = await acaoTratarAlerta({}, formulario({ pedidoId, motivo: "" }));
    expect(a.erros?.motivo).toBe("Informe o motivo.");
    expect(b.erros?.motivo).toBe("Informe o motivo.");
    expect(disparar).not.toHaveBeenCalled();
  });
});
