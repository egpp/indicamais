import { describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_CONFIRMACAO_REENVIADA,
  MENSAGEM_RECUPERACAO_SOLICITADA,
  MENSAGEM_WHATSAPP_INDISPONIVEL,
  criarServicoContas,
  mapearErroBanco,
  podeIndicar,
  whatsappApresentavelComoVerificado,
  type ClienteBancoContas,
  type LinhaConta,
} from "./index";

const linha = (p: Partial<LinhaConta> = {}): LinhaConta => ({
  id: "11111111-1111-1111-1111-111111111111",
  nome_exibicao: "Ana",
  whatsapp_e164: null,
  whatsapp_verificado: false,
  criado_em: "2026-10-23T00:00:00Z",
  atualizado_em: "2026-10-23T00:00:00Z",
  ...p,
});

function fake(over: Partial<ClienteBancoContas> = {}) {
  const banco: ClienteBancoContas = {
    buscarMinhaConta: vi.fn(async () => ({ dados: linha(), erro: null })),
    atualizarMinhaConta: vi.fn(async (c) => ({ dados: linha({ ...c }), erro: null })),
    ...over,
  };
  return banco;
}

describe("IM-009 regras", () => {
  it("podeIndicar depende só de ter WhatsApp", () => {
    expect(podeIndicar({ whatsappE164: null })).toBe(false);
    expect(podeIndicar({ whatsappE164: "" })).toBe(false);
    expect(podeIndicar({ whatsappE164: "+5511999990001" })).toBe(true);
  });
  it("verificado nunca é apresentado como true, mesmo se o banco disser true", () => {
    expect(whatsappApresentavelComoVerificado({ whatsappVerificado: true })).toBe(false);
    expect(whatsappApresentavelComoVerificado()).toBe(false);
  });
});

describe("serviço de contas", () => {
  it("obterMinhaConta sem WhatsApp: não pode indicar", async () => {
    const r = await criarServicoContas(fake()).obterMinhaConta();
    expect(r.ok && r.valor.podeIndicar).toBe(false);
  });

  it("obterMinhaConta nunca devolve verificado true", async () => {
    const banco = fake({
      buscarMinhaConta: async () => ({
        dados: linha({ whatsapp_e164: "+5511999990001", whatsapp_verificado: true }),
        erro: null,
      }),
    });
    const r = await criarServicoContas(banco).obterMinhaConta();
    expect(r.ok && r.valor.whatsappVerificado).toBe(false);
    expect(r.ok && r.valor.podeIndicar).toBe(true);
  });

  it("conta inexistente/RLS (sem linha) vira NAO_ENCONTRADA", async () => {
    const banco = fake({ buscarMinhaConta: async () => ({ dados: null, erro: null }) });
    const r = await criarServicoContas(banco).obterMinhaConta();
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADA");
  });

  it("atualizarWhatsapp envia E.164 normalizado e habilita indicar", async () => {
    const banco = fake();
    const r = await criarServicoContas(banco).atualizarWhatsapp({ whatsapp: "(11) 99999-0001" });
    expect(banco.atualizarMinhaConta).toHaveBeenCalledWith({ whatsapp_e164: "+5511999990001" });
    expect(r.ok && r.valor.podeIndicar).toBe(true);
  });

  it("número inválido não chega ao banco", async () => {
    const banco = fake();
    const r = await criarServicoContas(banco).atualizarWhatsapp({ whatsapp: "+1 415 555 2671" });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(banco.atualizarMinhaConta).not.toHaveBeenCalled();
  });

  it("número duplicado (23505) não vaza que é de outra conta", async () => {
    const banco = fake({
      atualizarMinhaConta: async () => ({
        dados: null,
        erro: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "contas_conta_whatsapp_unico"',
          details: "Key (whatsapp_e164)=(+5511999990001) already exists.",
        },
      }),
    });
    const r = await criarServicoContas(banco).atualizarWhatsapp({ whatsapp: "11999990001" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.mensagem).toBe(MENSAGEM_WHATSAPP_INDISPONIVEL);
      const texto = JSON.stringify(r.erro).toLowerCase();
      expect(texto).not.toMatch(/duplic|já existe|already|outra conta|unique|cadastrad|\+55/);
    }
  });

  it("falha de rede/exceção vira erro genérico sem texto interno", async () => {
    const banco = fake({
      atualizarMinhaConta: async () => {
        throw new Error("connection refused host=db.interno");
      },
    });
    const r = await criarServicoContas(banco).atualizarNomeExibicao("Ana");
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("interno");
  });

  it("atualizarNomeExibicao valida 1–80 e apara", async () => {
    const banco = fake();
    const s = criarServicoContas(banco);
    await s.atualizarNomeExibicao("  Ana Souza ");
    expect(banco.atualizarMinhaConta).toHaveBeenCalledWith({ nome_exibicao: "Ana Souza" });
    const ruim = await s.atualizarNomeExibicao("x".repeat(81));
    expect(!ruim.ok && ruim.erro.codigo).toBe("VALIDACAO");
    const vazio = await s.atualizarNomeExibicao("   ");
    expect(vazio.ok).toBe(false);
  });

  it("o serviço nunca tenta gravar whatsapp_verificado", async () => {
    const banco = fake();
    const s = criarServicoContas(banco);
    await s.atualizarWhatsapp({ whatsapp: "11999990001", whatsapp_verificado: true });
    await s.atualizarNomeExibicao("Ana");
    for (const [campos] of vi.mocked(banco.atualizarMinhaConta).mock.calls) {
      expect(Object.keys(campos)).not.toContain("whatsapp_verificado");
    }
  });
});

describe("mapearErroBanco", () => {
  it("23514 de formato usa a mensagem genérica", () => {
    const e = mapearErroBanco({
      code: "23514",
      message: 'new row violates check constraint "contas_conta_whatsapp_formato"',
    });
    expect(e.mensagem).toBe(MENSAGEM_WHATSAPP_INDISPONIVEL);
  });
  it("23514 de nome", () => {
    expect(
      mapearErroBanco({ code: "23514", message: 'check constraint "contas_conta_nome_tamanho"' })
        .codigo,
    ).toBe("NOME_INVALIDO");
  });
  it("outros códigos viram erro genérico e não repassam texto do banco", () => {
    const e = mapearErroBanco({ code: "XX000", message: "segredo interno" });
    expect(e.codigo).toBe("ERRO_INTERNO");
    expect(e.mensagem).not.toContain("segredo");
    expect(mapearErroBanco({ code: "23505", message: 'constraint "outra"' }).codigo).toBe(
      "ERRO_INTERNO",
    );
  });
});

describe("IM-008 mensagens que não revelam existência", () => {
  it("não afirmam que o e-mail existe", () => {
    for (const m of [MENSAGEM_RECUPERACAO_SOLICITADA, MENSAGEM_CONFIRMACAO_REENVIADA]) {
      expect(m).toMatch(/^Se este e-mail/);
      expect(m).not.toMatch(/não encontrado|não existe|não cadastrado|já confirmado/i);
    }
  });
});
