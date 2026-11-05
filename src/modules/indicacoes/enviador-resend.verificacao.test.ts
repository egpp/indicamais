import { describe, expect, it, vi } from "vitest";
import { criarServicoNotificacoesContato, montarEmailNovoPedido } from "./index";
import { criarEnviadorResend } from "@/shared/email/enviador-resend";

const CHAVE = "re_chave_falsa_verificador";

type Init = RequestInit & { headers: Record<string, string> };
const chamada = (f: ReturnType<typeof vi.fn>, i: number) =>
  f.mock.calls[i] as unknown as [string, Init];

describe("verificação independente do enviador Resend (IM-027, IM-028, IM-029, IM-041, IM-050)", () => {
  it("nome de destino com quebras de linha e script não altera assunto nem remetente", () => {
    const e = montarEmailNovoPedido(
      {
        emailResponsavel: "dono@exemplo.com.br",
        destinoTipo: "perfil",
        destinoNome: "Loja\r\nBcc: x@y.com\n<script>alert(1)</script>",
        pedidoId: "p1",
        tentativas: 0,
      },
      "https://x.test/painel",
    );
    expect(e.assunto).toBe("Novo pedido de contato no IndicaMais");
    expect(e.texto).not.toMatch(/\r/);
    // o nome vira uma única linha: a primeira linha do texto contém todo o nome
    expect(e.texto.split("\n")[0]).toContain("Bcc: x@y.com");
  });

  it("o corpo enviado ao Resend é JSON de texto puro (sem html) e cabeçalhos fixos", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const e = montarEmailNovoPedido(
      { emailResponsavel: "d@e.com", destinoTipo: "item", destinoNome: "<b>X</b>\r\nCc: a@b.c" },
      "https://x.test/p",
    );
    await criarEnviadorResend({
      chave: CHAVE,
      remetente: "IM <a@d.com>",
      fetchImpl: f as unknown as typeof fetch,
    }).enviar(e);
    const [, init] = chamada(f, 0);
    expect(Object.keys(init.headers).sort()).toEqual(["Authorization", "Content-Type"]);
    const corpo = JSON.parse(init.body as string);
    expect(Object.keys(corpo).sort()).toEqual(["from", "subject", "text", "to"]);
    expect(corpo.to).toEqual(["d@e.com"]);
  });

  it("chave de idempotência é estável para o mesmo pedido/tentativa e muda na seguinte", () => {
    const base = { emailResponsavel: "d@e.com", destinoTipo: "perfil", destinoNome: "A" };
    const k = (pedidoId: string, tentativas: number) =>
      montarEmailNovoPedido({ ...base, pedidoId, tentativas }, "u").chaveIdempotencia ?? "";
    expect(k("p1", 0)).toBe("notificacao-contato/p1/0");
    expect(k("p1", 0)).toBe(k("p1", 0));
    expect(k("p1", 1)).not.toBe(k("p1", 0));
    expect(k("p2", 0)).not.toBe(k("p1", 0));
    expect(k("00000000-0000-0000-0000-000000000000", 3).length).toBeLessThanOrEqual(256);
  });

  it("serviço completo: sem dado privado no corpo; mesma chave se a gravação falhar e reprocessar", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const enviador = criarEnviadorResend({
      chave: CHAVE,
      remetente: "a@d.com",
      fetchImpl: f as unknown as typeof fetch,
    });
    const linha = {
      o_pedido_id: "ped-1",
      o_email_responsavel: "dono@exemplo.com.br",
      o_destino_tipo: "perfil",
      o_destino_nome: "Padaria Boa",
      o_tentativas: 0,
    };
    const banco = {
      listarPendentes: vi.fn(async () => ({ dados: [linha], erro: null })),
      registrar: vi.fn(async () => ({ erro: { codigo: "x", mensagem: "falha" } })),
    };
    const svc = criarServicoNotificacoesContato(banco as never, enviador);
    await svc.processarNotificacoesPendentes({ urlPainel: "https://x.test/painel" });
    await svc.processarNotificacoesPendentes({ urlPainel: "https://x.test/painel" });
    expect(f).toHaveBeenCalledTimes(2);
    expect(chamada(f, 0)[1].headers["Idempotency-Key"]).toBe("notificacao-contato/ped-1/0");
    expect(chamada(f, 1)[1].headers["Idempotency-Key"]).toBe("notificacao-contato/ped-1/0");
    const corpo = chamada(f, 0)[1].body as string;
    expect(corpo).toContain("Padaria Boa");
    expect(corpo).not.toMatch(/\+55|telefone|visitante|indicador/i);
  });
});
