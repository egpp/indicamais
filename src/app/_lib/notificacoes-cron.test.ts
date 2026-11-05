import { describe, expect, it, vi } from "vitest";
import type { EnviadorEmail, LinhaNotificacaoPendente } from "@/modules/indicacoes";
import { LIMITES } from "@/shared/config/limites";
import { ERRO_EMAIL } from "@/shared/email/enviador-resend";
import { processarNotificacoesNoCron, type BancoNotificacoesCron } from "./notificacoes-cron";

const ENV = {
  EMAIL_API_KEY: "chave-de-teste",
  EMAIL_FROM: "IndicaMais <avisos@exemplo.com.br>",
  NEXT_PUBLIC_APP_URL: "https://indicamais.exemplo.com.br/qualquer/coisa",
};
const id = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const linha = (n: number, tentativas = 0): LinhaNotificacaoPendente => ({
  o_pedido_id: id(n),
  o_email_responsavel: `dono${n}@padaria.com.br`,
  o_destino_tipo: "perfil",
  o_destino_nome: "Padaria do Zé",
  o_tentativas: tentativas,
});

function banco(pendentes: LinhaNotificacaoPendente[], recolocadas = 0) {
  const listarPendentes = vi.fn<BancoNotificacoesCron["listarPendentes"]>(async () => ({
    dados: pendentes,
    erro: null,
  }));
  const registrar = vi.fn<BancoNotificacoesCron["registrar"]>(async () => ({ erro: null }));
  const recolocarFalhas = vi.fn<BancoNotificacoesCron["recolocarFalhas"]>(async () => ({
    dados: recolocadas,
    erro: false,
  }));
  return {
    b: { listarPendentes, registrar, recolocarFalhas },
    listarPendentes,
    registrar,
    recolocarFalhas,
  };
}
const enviadorFake = (resp: Awaited<ReturnType<EnviadorEmail["enviar"]>> = { ok: true }) => {
  const enviar = vi.fn<EnviadorEmail["enviar"]>(async () => resp);
  return { enviar, criarEnviador: () => ({ enviar }) };
};

describe("notificações de contato no cron (IM-027, IM-028, IM-080)", () => {
  it("sem chave ou sem remetente ou sem URL: não faz nada e não dá erro", async () => {
    for (const env of [
      { ...ENV, EMAIL_API_KEY: "" },
      { ...ENV, EMAIL_FROM: undefined },
      { ...ENV, NEXT_PUBLIC_APP_URL: "" },
      { ...ENV, NEXT_PUBLIC_APP_URL: "ftp://x" },
    ]) {
      const f = banco([linha(1)]);
      const e = enviadorFake();
      const r = await processarNotificacoesNoCron({
        banco: f.b,
        env,
        criarEnviador: e.criarEnviador,
      });
      expect(r).toEqual({});
      expect(f.listarPendentes).not.toHaveBeenCalled();
      expect(f.recolocarFalhas).not.toHaveBeenCalled();
      expect(e.enviar).not.toHaveBeenCalled();
    }
  });

  it("usa o lote do cron, recoloca falhas com os limites centrais e envia sem duplicar", async () => {
    const f = banco([linha(1), linha(2)], 3);
    const e = enviadorFake();
    const r = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    const n = LIMITES.notificacaoContato;
    expect(f.recolocarFalhas).toHaveBeenCalledWith({
      limite: n.loteCron,
      tentativasMax: n.tentativasMax,
      esperaMinutos: n.esperaReenvioMin,
    });
    expect(f.listarPendentes).toHaveBeenCalledWith(n.loteCron);
    expect(r).toMatchObject({
      notificacoes_contato_recolocadas: 3,
      notificacoes_contato_lidas: 2,
      notificacoes_contato_enviadas: 2,
      notificacoes_contato_falhas: 0,
      notificacoes_contato_interrompido: 0,
    });
    expect(e.enviar).toHaveBeenCalledTimes(2);
    // Idempotência por pedido e tentativa; link do painel só com a origem.
    const emails = e.enviar.mock.calls.map((c) => c[0]);
    expect(emails.map((m) => m.chaveIdempotencia)).toEqual([
      `notificacao-contato/${id(1)}/0`,
      `notificacao-contato/${id(2)}/0`,
    ]);
    expect(emails[0]!.texto).toContain("https://indicamais.exemplo.com.br/pedidos-de-contato");
    expect(emails[0]!.texto).not.toContain("qualquer/coisa");
    expect(f.registrar).toHaveBeenCalledTimes(2);
  });

  it("pedido que já excedeu as tentativas não recebe e-mail (falha registrada, alerta)", async () => {
    const max = LIMITES.notificacaoContato.tentativasMax;
    const f = banco([linha(1, max), linha(2, max - 1)]);
    const e = enviadorFake();
    const r = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    expect(e.enviar).toHaveBeenCalledTimes(1);
    expect(e.enviar.mock.calls[0]![0].chaveIdempotencia).toBe(
      `notificacao-contato/${id(2)}/${max - 1}`,
    );
    expect(r).toMatchObject({
      notificacoes_contato_limite_tentativas: 1,
      notificacoes_contato_enviadas: 1,
    });
  });

  it("limite do provedor (429): para o lote, sem gravar falha nem gastar tentativa", async () => {
    const f = banco([linha(1), linha(2), linha(3)]);
    const e = enviadorFake({ ok: false, erro: ERRO_EMAIL.limite });
    const r = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    expect(e.enviar).toHaveBeenCalledTimes(1);
    expect(f.registrar).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      notificacoes_contato_interrompido: 1,
      notificacoes_contato_enviadas: 0,
      notificacoes_contato_falhas: 0,
    });
  });

  it("outras falhas (5xx, conflito 409) são gravadas e o lote segue", async () => {
    for (const erro of [ERRO_EMAIL.indisponivel, ERRO_EMAIL.conflito]) {
      const f = banco([linha(1), linha(2)]);
      const e = enviadorFake({ ok: false, erro });
      const r = await processarNotificacoesNoCron({
        banco: f.b,
        env: ENV,
        criarEnviador: e.criarEnviador,
      });
      expect(e.enviar).toHaveBeenCalledTimes(2);
      expect(f.registrar).toHaveBeenCalledTimes(2);
      expect(r).toMatchObject({
        notificacoes_contato_falhas: 2,
        notificacoes_contato_interrompido: 0,
      });
    }
  });

  it("falha ao recolocar não impede o envio; falha ao ler vira 'falhou'", async () => {
    const f = banco([linha(1)]);
    f.recolocarFalhas.mockResolvedValue({ dados: null, erro: true });
    const e = enviadorFake();
    const r = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    expect(r.notificacoes_contato_recolocadas).toBe("falhou");
    expect(r.notificacoes_contato_enviadas).toBe(1);

    f.listarPendentes.mockResolvedValue({ dados: null, erro: { code: "XX000" } });
    const r2 = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    expect(r2.notificacoes_contato_processamento).toBe("falhou");
  });

  it("o resultado traz só números (nenhum e-mail, nome ou conteúdo)", async () => {
    const f = banco([linha(1)], 1);
    const e = enviadorFake();
    const r = await processarNotificacoesNoCron({
      banco: f.b,
      env: ENV,
      criarEnviador: e.criarEnviador,
    });
    const texto = JSON.stringify(r);
    expect(Object.values(r).every((v) => typeof v === "number" || v === "falhou")).toBe(true);
    expect(texto).not.toMatch(/@|Padaria|chave-de-teste|exemplo/);
  });
});
