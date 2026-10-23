import { describe, expect, it, vi } from "vitest";
import {
  MENSAGEM_WHATSAPP_INDISPONIVEL,
  atualizarWhatsappSchema,
  cadastroSchema,
  criarServicoContas,
  mapearErroBanco,
  normalizarWhatsappBR,
  type ClienteBancoContas,
  type LinhaConta,
} from "./index";

// Testes negativos do verificador (IM-009, IM-008, IM-086): entradas hostis e vazamentos.

const linha = (p: Partial<LinhaConta> = {}): LinhaConta => ({
  id: "11111111-1111-1111-1111-111111111111",
  nome_exibicao: "Ana",
  whatsapp_e164: null,
  whatsapp_verificado: false,
  criado_em: "2026-10-23T00:00:00Z",
  atualizado_em: "2026-10-23T00:00:00Z",
  ...p,
});

describe("normalização com entradas hostis (IM-009)", () => {
  it.each([
    ["dígitos de largura total", "１１９９９９９０００１"],
    ["dígitos árabe-índicos", "١١٩٩٩٩٩٠٠٠١"],
    ["injeção SQL", "11999990001' OR '1'='1"],
    ["HTML", "<script>11999990001</script>"],
    ["mais no meio", "11+999990001"],
    ["dois mais", "++5511999990001"],
    ["byte nulo", "11999990001\u0000"],
    ["emoji", "11 99999-0001 📱"],
    ["letra O no lugar de zero", "11 9999O-0001"],
    ["vírgula", "11,99999,0001"],
    ["barra", "11/999990001"],
  ])("rejeita %s", (_n, entrada) => {
    expect(normalizarWhatsappBR(entrada).ok).toBe(false);
  });

  it("entrada gigante não trava nem é aceita", () => {
    const t0 = Date.now();
    expect(normalizarWhatsappBR("1".repeat(100_000)).ok).toBe(false);
    expect(normalizarWhatsappBR(" ".repeat(100_000) + "1").ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it("quebra de linha nas bordas é aparada, no meio vira espaço aceito mas saída é sempre E.164 limpo", () => {
    const r = normalizarWhatsappBR("\n(11) 99999-0001\r\n");
    expect(r.ok && r.e164).toBe("+5511999990001");
  });

  it("saída, quando ok, sempre casa com o CHECK do banco (fuzz determinístico)", () => {
    const alfabeto = "0123456789 ()-.+";
    let semente = 42;
    const rnd = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 5000; i++) {
      const n = 1 + Math.floor(rnd() * 16);
      let s = "";
      for (let k = 0; k < n; k++) s += alfabeto[Math.floor(rnd() * alfabeto.length)];
      const r = normalizarWhatsappBR(s);
      if (r.ok) expect(r.e164).toMatch(/^\+55\d{10,11}$/);
    }
  });

  it("formas diferentes do mesmo número dão o mesmo valor (base da exclusividade)", () => {
    const formas = [
      "(11) 99999-0001",
      "11 99999 0001",
      "+55 11 99999-0001",
      "5511999990001",
      "011999990001",
    ];
    const set = new Set(
      formas.map((f) => normalizarWhatsappBR(f)).map((r) => (r.ok ? r.e164 : "x")),
    );
    expect([...set]).toEqual(["+5511999990001"]);
  });

  it("schema do WhatsApp não aceita não-string", () => {
    for (const v of [null, undefined, 11999990001, {}, [], true]) {
      expect(atualizarWhatsappSchema.safeParse({ whatsapp: v }).success).toBe(false);
    }
  });
});

describe("cadastro e mass assignment (IM-007, IM-086)", () => {
  it("campos extras como whatsapp_verificado ou id não passam no schema", () => {
    const r = cadastroSchema.safeParse({
      email: "a@b.com",
      senha: "senha1234",
      whatsapp_verificado: true,
      id: "x",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(Object.keys(r.data).sort()).toEqual(["email", "senha"]);
  });

  it("e-mail com quebra de linha/cabeçalho injetado é rejeitado", () => {
    for (const e of ["a@b.com\r\nBcc: x@y.com", "a@b.com, c@d.com", "a b@c.com", "<a@b.com>"]) {
      expect(cadastroSchema.safeParse({ email: e, senha: "senha1234" }).success).toBe(false);
    }
  });
});

describe("serviço: o que não pode vazar nem ser gravado (IM-009, IM-086)", () => {
  it("atualizarWhatsapp ignora campos extras e só envia whatsapp_e164", async () => {
    const atualizar = vi.fn(async (c) => ({ dados: linha({ ...c }), erro: null }));
    const banco: ClienteBancoContas = {
      buscarMinhaConta: async () => ({ dados: linha(), erro: null }),
      atualizarMinhaConta: atualizar,
    };
    await criarServicoContas(banco).atualizarWhatsapp({
      whatsapp: "(11) 99999-0001",
      whatsapp_verificado: true,
      id: "outro",
    });
    expect(atualizar).toHaveBeenCalledWith({ whatsapp_e164: "+5511999990001" });
  });

  it("duplicado, formato inválido e 23505 de outra origem: nenhum texto do banco, número ou id no erro", async () => {
    const segredo = "+5511999990001";
    const erros = [
      {
        code: "23505",
        constraint: "contas_conta_whatsapp_unico",
        message: `duplicate key value violates unique constraint`,
        details: `Key (whatsapp_e164)=(${segredo}) already exists.`,
      },
      {
        code: "23514",
        constraint: "contas_conta_whatsapp_formato",
        message: "violates check constraint",
        details: `Failing row contains (${segredo})`,
      },
      { code: "42501", message: "permission denied for table contas_conta" },
      { code: "XX000", message: `fatal ${segredo} auth.users` },
    ];
    for (const e of erros) {
      const m = mapearErroBanco(e);
      expect(JSON.stringify(m)).not.toContain("5511999990001");
      expect(JSON.stringify(m)).not.toMatch(/duplicate|constraint|permission|auth\.users|Key \(/i);
    }
    expect(mapearErroBanco(erros[0]!).mensagem).toBe(MENSAGEM_WHATSAPP_INDISPONIVEL);
  });

  it("a mensagem de duplicado não diferencia 'em uso' de 'inválido' (sem oráculo de números)", () => {
    const dup = mapearErroBanco({ code: "23505", constraint: "contas_conta_whatsapp_unico" });
    const fmt = mapearErroBanco({ code: "23514", constraint: "contas_conta_whatsapp_formato" });
    expect(dup).toEqual(fmt);
    expect(dup.mensagem).not.toMatch(/uso|outra conta|cadastrad|existe/i);
  });

  it("23505 de outra constraint (não WhatsApp) não vira WHATSAPP_INDISPONIVEL", () => {
    expect(mapearErroBanco({ code: "23505", constraint: "contas_conta_pkey" }).codigo).toBe(
      "ERRO_INTERNO",
    );
  });

  it("objeto de erro sem campos e exceção não quebram o mapeamento", () => {
    expect(mapearErroBanco({}).codigo).toBe("ERRO_INTERNO");
  });

  it("nome com 81 caracteres ou só espaços não chega ao banco", async () => {
    const atualizar = vi.fn();
    const banco: ClienteBancoContas = {
      buscarMinhaConta: async () => ({ dados: linha(), erro: null }),
      atualizarMinhaConta: atualizar,
    };
    const s = criarServicoContas(banco);
    expect((await s.atualizarNomeExibicao("x".repeat(81))).ok).toBe(false);
    expect((await s.atualizarNomeExibicao("   ")).ok).toBe(false);
    expect((await s.atualizarNomeExibicao(null)).ok).toBe(false);
    expect(atualizar).not.toHaveBeenCalled();
  });
});
