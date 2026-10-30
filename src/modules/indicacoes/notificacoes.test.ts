import { describe, expect, it, vi } from "vitest";
import { LIMITES } from "@/shared/config/limites";
import {
  criarServicoNotificacoesContato,
  ENVIADOR_EMAIL_SEM_PROVEDOR,
  ERRO_LIMITE_TENTATIVAS,
  ERRO_PROVEDOR_NAO_CONFIGURADO,
  montarEmailNovoPedido,
  sanitizarErroNotificacao,
  type ClienteBancoNotificacoes,
  type EmailParaEnviar,
  type EnviadorEmail,
  type LinhaNotificacaoPendente,
} from "./index";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const PAINEL = "https://indicamais.exemplo.com.br/minha-conta/pedidos";

const linha = (extra: Partial<LinhaNotificacaoPendente> = {}): LinhaNotificacaoPendente => ({
  o_pedido_id: P1,
  o_email_responsavel: "dono@padaria.com.br",
  o_destino_tipo: "perfil",
  o_destino_nome: "Padaria do Zé",
  o_tentativas: 0,
  ...extra,
});

function fake(pendentes: LinhaNotificacaoPendente[]) {
  const registrar = vi.fn<ClienteBancoNotificacoes["registrar"]>(async () => ({ erro: null }));
  const listarPendentes = vi.fn<ClienteBancoNotificacoes["listarPendentes"]>(async () => ({
    dados: pendentes,
    erro: null,
  }));
  return {
    banco: { listarPendentes, registrar } satisfies ClienteBancoNotificacoes,
    registrar,
    listarPendentes,
  };
}
const enviadorOk = () => {
  const enviar = vi.fn<EnviadorEmail["enviar"]>(async () => ({ ok: true }));
  return { enviador: { enviar } satisfies EnviadorEmail, enviar };
};

describe("e-mail ao responsável (IM-027, IM-050)", () => {
  it("texto fixo com o nome do destino e o link do painel", () => {
    const e = montarEmailNovoPedido(
      {
        emailResponsavel: "dono@padaria.com.br",
        destinoTipo: "perfil",
        destinoNome: "Padaria do Zé",
      },
      PAINEL,
    );
    expect(e.para).toBe("dono@padaria.com.br");
    expect(e.texto).toBe(
      `Você recebeu um novo pedido de contato em Padaria do Zé. Acesse o painel para ver.\n\n${PAINEL}`,
    );
  });

  it("sem nome do destino usa texto neutro por tipo; nome hostil é limpo", () => {
    const item = montarEmailNovoPedido(
      { emailResponsavel: "a@b.com", destinoTipo: "item", destinoNome: null },
      PAINEL,
    );
    expect(item.texto).toContain("em seu anúncio.");
    const perfil = montarEmailNovoPedido(
      { emailResponsavel: "a@b.com", destinoTipo: "perfil", destinoNome: "  " },
      PAINEL,
    );
    expect(perfil.texto).toContain("em seu perfil.");
    const sujo = montarEmailNovoPedido(
      { emailResponsavel: "a@b.com", destinoTipo: "perfil", destinoNome: "Loja\n\nCC: x@y.com" },
      PAINEL,
    );
    expect(sujo.texto.split("\n")[0]).toContain("Loja CC: x@y.com");
    expect(sujo.assunto).not.toContain("\n");
  });
});

describe("processarNotificacoesPendentes", () => {
  it("envia só o texto permitido e registra sucesso", async () => {
    const f = fake([linha()]);
    const m = enviadorOk();
    const r = await criarServicoNotificacoesContato(
      f.banco,
      m.enviador,
    ).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(r).toEqual({
      ok: true,
      resumo: { lidas: 1, enviadas: 1, falhas: 0, limiteAtingido: 0, semRegistro: 0 },
    });
    expect(f.listarPendentes).toHaveBeenCalledWith(LIMITES.notificacaoContato.lote);
    expect(f.registrar).toHaveBeenCalledWith({ pedidoId: P1, sucesso: true, erro: null });
    const email = m.enviar.mock.calls[0]![0] as EmailParaEnviar;
    expect(email.para).toBe("dono@padaria.com.br");
    expect(Object.keys(email).sort()).toEqual(["assunto", "para", "texto"]);
  });

  it("e-mail NÃO contém nome, WhatsApp, e-mail nem mensagem do visitante (IM-050)", async () => {
    // O banco de notificação nem entrega esses dados; mesmo assim, um nome de destino com eles não os revela
    // além do que é público, e a linha lida não tem campo do visitante.
    const f = fake([linha()]);
    const m = enviadorOk();
    await criarServicoNotificacoesContato(f.banco, m.enviador).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    const email = m.enviar.mock.calls[0]![0] as EmailParaEnviar;
    const tudo = `${email.assunto}\n${email.texto}`;
    for (const privado of [
      "Maria Souza",
      "51999999999",
      "(51) 99999",
      "maria@exemplo.com",
      "orçamento",
    ]) {
      expect(tudo).not.toContain(privado);
    }
    expect(tudo).not.toMatch(/\+55|[0-9]{8,}/);
    expect(Object.keys(linha()).sort()).toEqual(
      [
        "o_destino_nome",
        "o_destino_tipo",
        "o_email_responsavel",
        "o_pedido_id",
        "o_tentativas",
      ].sort(),
    );
  });

  it("provedor ausente: falha controlada, alerta aberto via registro de erro, nada se perde", async () => {
    const f = fake([linha(), linha({ o_pedido_id: P2 })]);
    const r = await criarServicoNotificacoesContato(
      f.banco,
      ENVIADOR_EMAIL_SEM_PROVEDOR,
    ).processarNotificacoesPendentes({ urlPainel: PAINEL });
    expect(r.ok && r.resumo).toMatchObject({ lidas: 2, enviadas: 0, falhas: 2 });
    expect(f.registrar).toHaveBeenCalledTimes(2);
    expect(f.registrar).toHaveBeenCalledWith({
      pedidoId: P1,
      sucesso: false,
      erro: ERRO_PROVEDOR_NAO_CONFIGURADO,
    });
    expect(ERRO_PROVEDOR_NAO_CONFIGURADO).toBe("provedor de e-mail não configurado");
  });

  it("uma falha não interrompe os demais; exceção do enviador também é falha controlada", async () => {
    const f = fake([linha(), linha({ o_pedido_id: P2 })]);
    const enviar = vi
      .fn<EnviadorEmail["enviar"]>()
      .mockRejectedValueOnce(new Error("ECONNRESET dono@padaria.com.br"))
      .mockResolvedValueOnce({ ok: true });
    const r = await criarServicoNotificacoesContato(f.banco, {
      enviar,
    }).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(r.ok && r.resumo).toMatchObject({ enviadas: 1, falhas: 1 });
    expect(f.registrar.mock.calls[0]![0]).toEqual({
      pedidoId: P1,
      sucesso: false,
      erro: "ECONNRESET",
    });
    expect(f.registrar.mock.calls[1]![0]).toEqual({ pedidoId: P2, sucesso: true, erro: null });
  });

  it("erro do provedor com dados pessoais é sanitizado antes de gravar", async () => {
    const f = fake([linha()]);
    const enviar = async () => ({
      ok: false as const,
      erro: "550 rejeitado para maria@exemplo.com telefone +55 (51) 99999-9999 https://x.y/z?t=1 <b>",
    });
    await criarServicoNotificacoesContato(f.banco, { enviar }).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    const gravado = f.registrar.mock.calls[0]![0].erro!;
    expect(gravado).not.toMatch(/maria|exemplo|99999|https|<|>|@/);
    expect(gravado).toContain("rejeitado");
    expect(gravado.length).toBeLessThanOrEqual(LIMITES.notificacaoContato.erroMax);
  });

  describe("limite de tentativas", () => {
    const max = LIMITES.notificacaoContato.tentativasMax;

    it("abaixo do limite envia; no limite não envia e registra falha com alerta", async () => {
      const f = fake([
        linha({ o_pedido_id: P1, o_tentativas: max - 1 }),
        linha({ o_pedido_id: P2, o_tentativas: max }),
      ]);
      const m = enviadorOk();
      const r = await criarServicoNotificacoesContato(
        f.banco,
        m.enviador,
      ).processarNotificacoesPendentes({
        urlPainel: PAINEL,
      });
      expect(m.enviar).toHaveBeenCalledTimes(1);
      expect(r.ok && r.resumo).toMatchObject({ enviadas: 1, falhas: 1, limiteAtingido: 1 });
      expect(f.registrar).toHaveBeenCalledWith({
        pedidoId: P2,
        sucesso: false,
        erro: ERRO_LIMITE_TENTATIVAS,
      });
    });

    it("limite configurável por opção", async () => {
      const f = fake([linha({ o_tentativas: 1 })]);
      const m = enviadorOk();
      await criarServicoNotificacoesContato(f.banco, m.enviador).processarNotificacoesPendentes({
        urlPainel: PAINEL,
        tentativasMax: 1,
      });
      expect(m.enviar).not.toHaveBeenCalled();
    });

    it("administrador pode forçar acima do limite (ação explícita)", async () => {
      const f = fake([linha({ o_tentativas: max + 5 })]);
      const m = enviadorOk();
      const r = await criarServicoNotificacoesContato(
        f.banco,
        m.enviador,
      ).processarNotificacoesPendentes({
        urlPainel: PAINEL,
        ignorarLimiteTentativas: true,
      });
      expect(m.enviar).toHaveBeenCalledTimes(1);
      expect(r.ok && r.resumo.enviadas).toBe(1);
    });
  });

  it("responsável sem e-mail: falha registrada, sem tentar enviar", async () => {
    const f = fake([linha({ o_email_responsavel: null })]);
    const m = enviadorOk();
    await criarServicoNotificacoesContato(f.banco, m.enviador).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(m.enviar).not.toHaveBeenCalled();
    expect(f.registrar.mock.calls[0]![0]).toMatchObject({
      sucesso: false,
      erro: "responsável sem e-mail",
    });
  });

  it("falha ao gravar o resultado é contada e não derruba o lote", async () => {
    const f = fake([linha(), linha({ o_pedido_id: P2 })]);
    f.registrar
      .mockResolvedValueOnce({ erro: { code: "XX000", message: "x" } })
      .mockResolvedValueOnce({ erro: null });
    const m = enviadorOk();
    const r = await criarServicoNotificacoesContato(
      f.banco,
      m.enviador,
    ).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(r.ok && r.resumo).toMatchObject({ lidas: 2, enviadas: 1, semRegistro: 1 });
  });

  it("falha ao ler a fila devolve erro sem texto do banco; fila vazia não envia nada", async () => {
    const m = enviadorOk();
    const ruim = fake([]);
    ruim.listarPendentes.mockResolvedValueOnce({
      dados: null,
      erro: { code: "42501", message: "SEGREDO" },
    });
    const r = await criarServicoNotificacoesContato(
      ruim.banco,
      m.enviador,
    ).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
    const vazia = await criarServicoNotificacoesContato(
      fake([]).banco,
      m.enviador,
    ).processarNotificacoesPendentes({
      urlPainel: PAINEL,
    });
    expect(vazia.ok && vazia.resumo.lidas).toBe(0);
    expect(m.enviar).not.toHaveBeenCalled();
  });
});

describe("sanitizarErroNotificacao", () => {
  it("trunca no limite configurado", () => {
    expect(sanitizarErroNotificacao("a".repeat(500)).length).toBe(
      LIMITES.notificacaoContato.erroMax,
    );
  });
  it("vazio ou tipo estranho vira erro_desconhecido", () => {
    expect(sanitizarErroNotificacao("")).toBe("erro_desconhecido");
    expect(sanitizarErroNotificacao(undefined)).toBe("erro_desconhecido");
    expect(sanitizarErroNotificacao("@@@ ###")).toBe("erro_desconhecido");
  });
  it("preserva mensagem simples em português", () => {
    expect(sanitizarErroNotificacao("provedor de e-mail não configurado")).toBe(
      "provedor de e-mail não configurado",
    );
  });
  it("remove sequências longas de dígitos (telefones, CPF)", () => {
    expect(sanitizarErroNotificacao("falha 51999999999 fim")).toBe("falha fim");
    expect(sanitizarErroNotificacao("cpf 000.000.000-00")).not.toMatch(/[0-9]{3}/);
    expect(sanitizarErroNotificacao("smtp 421 timeout")).toBe("smtp 421 timeout");
  });
});
