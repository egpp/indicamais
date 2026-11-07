import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formulario } from "../../tests/suporte/bancos-memoria";
import { criarMundoIndicacoes } from "../../tests/suporte/banco-indicacoes-memoria";
import { criarMundoPublico } from "../../tests/suporte/bancos-publicos-memoria";
import type { ContextoIndicacoes } from "./_lib/contexto-indicacoes";
import type { Usuario } from "../../tests/suporte/banco-indicacoes-memoria";

let obter: () => Promise<ContextoIndicacoes>;
let cabecalhos = new Headers({ "cf-connecting-ip": "203.0.113.9", "user-agent": "Teste/1" });
const disparar = vi.fn(() => true);
const revalidar = vi.fn();

vi.mock("./_lib/contexto-indicacoes", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-indicacoes")>()),
  obterContextoIndicacoes: () => obter(),
  obterContextoIndicacoesAberto: () => obter(),
  obterContextoContatoPublico: () => obter(),
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
vi.mock("next/headers", () => ({ headers: async () => cabecalhos }));
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  cabecalhos = new Headers({ "cf-connecting-ip": "203.0.113.9", "user-agent": "Teste/1" });
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

describe("proteção do contato público (RSA-05, RSA-07, IM-026, IM-076)", () => {
  const SEGREDO_HASH = "segredo-de-teste-com-pelo-menos-32-caracteres";
  const comTurnstile = (tokenValido: boolean) => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    const buscar = vi.fn(async () => new Response(JSON.stringify({ success: tokenValido })));
    vi.stubGlobal("fetch", buscar);
    return buscar;
  };

  it("com Turnstile configurado e sem token: recusa com mensagem amigável, sem tocar no banco nem disparar aviso", async () => {
    const m = mundo(null);
    comTurnstile(true);
    const r = await acaoEnviarContato({}, formulario(dados));
    expect(r.erro).toBe("Confirme a verificação de segurança antes de enviar.");
    expect(r.valores).toMatchObject({ nome: "Carla Visitante" });
    expect(m.chamadasContato).toHaveLength(0);
    expect(disparar).not.toHaveBeenCalled();
  });

  it("token recusado pela Cloudflare: recusa, nada é gravado", async () => {
    const m = mundo(null);
    comTurnstile(false);
    const r = await acaoEnviarContato(
      {},
      formulario({ ...dados, "cf-turnstile-response": "ruim" }),
    );
    expect(r.erro).toBe("Não foi possível confirmar a verificação de segurança. Tente de novo.");
    expect(m.chamadasContato).toHaveLength(0);
    expect(r.urlWhatsapp).toBeUndefined();
  });

  it("token aceito: envia, com a origem em HMAC (nunca o IP) vinda do servidor, ignorando qualquer origem do formulário", async () => {
    const m = mundo(null);
    const buscar = comTurnstile(true);
    vi.stubEnv("DENUNCIA_HASH_SEGREDO", SEGREDO_HASH);
    const r = await acaoEnviarContato(
      {},
      formulario({ ...dados, "cf-turnstile-response": "bom", origem: "a".repeat(64) }),
    );
    expect(r.urlWhatsapp).toBeTruthy();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(m.chamadasContato).toHaveLength(1);
    const origem = m.chamadasContato[0]!.origem;
    expect(origem).toMatch(/^[0-9a-f]{64}$/);
    expect(origem).not.toBe("a".repeat(64));
    expect(JSON.stringify(m.chamadasContato)).not.toContain("203.0.113.9");
  });

  it("produção sem chave do Turnstile: falha fechado (não grava, não consulta a rede)", async () => {
    const m = mundo(null);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DENUNCIA_HASH_SEGREDO", SEGREDO_HASH);
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const r = await acaoEnviarContato({}, formulario({ ...dados, "cf-turnstile-response": "x" }));
    expect(r.erro).toBe(
      "A verificação de segurança está indisponível agora. Tente novamente em instantes.",
    );
    expect(m.chamadasContato).toHaveLength(0);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("produção com Turnstile mas sem segredo do hash: falha segura (mensagem genérica, nada gravado)", async () => {
    const m = mundo(null);
    comTurnstile(true);
    vi.stubEnv("NODE_ENV", "production");
    const r = await acaoEnviarContato({}, formulario({ ...dados, "cf-turnstile-response": "bom" }));
    expect(r.erro).toBe("Não foi possível concluir agora. Tente novamente em instantes.");
    expect(m.chamadasContato).toHaveLength(0);
  });
});
