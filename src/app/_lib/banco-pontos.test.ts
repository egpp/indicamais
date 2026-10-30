import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_PONTOS, criarBancoPontos } from "./banco-pontos";

const ID = "11111111-1111-4111-8111-111111111111";

/** Cliente supabase-js falso: registra o que foi chamado e devolve o que o teste mandar. */
function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const chamadas: { rpc: [string, Record<string, unknown>][]; selects: [string, string][] } = {
    rpc: [],
    selects: [],
  };
  const pronto = () => {
    if (lancar) throw new Error("rede caiu: segredo-interno");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const consulta = {
    eq: () => consulta,
    in: () => consulta,
    then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res),
  };
  const cliente = {
    rpc: (nome: string, args: Record<string, unknown>) => {
      chamadas.rpc.push([nome, args]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (tabela: string) => ({
      select: (colunas: string) => {
        chamadas.selects.push([tabela, colunas]);
        return consulta;
      },
    }),
  };
  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

describe("adaptador do banco de pontos (sessão do usuário)", () => {
  it("lê visões com colunas nomeadas, nunca '*', e sem colunas de conta", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoPontos(cliente as never);
    await banco.lerMeuSaldo();
    await banco.listarMeusLancamentos();
    await banco.listarLancamentosAdmin();
    await banco.listarSaldosAdmin();
    await banco.listarDecisoesAdmin();
    await banco.listarFalhasAdmin();
    await banco.listarBeneficiosPublicos();
    await banco.listarFilaBeneficios();
    expect(chamadas.selects.map(([t]) => t)).toEqual([
      "pontos_meu_saldo",
      "pontos_meus_lancamentos",
      "administracao_pontos_lancamentos",
      "administracao_pontos_saldos",
      "administracao_pontos_decisoes",
      "administracao_pontos_falhas",
      "pontos_beneficio_publico",
      "administracao_fila_beneficios",
    ]);
    for (const [, colunas] of chamadas.selects) {
      expect(colunas).not.toContain("*");
    }
    for (const colunas of Object.values(COLUNAS_PONTOS)) {
      expect(colunas).not.toMatch(
        /(^|[ ,])(conta_id|indicador_id|autor_id|responsavel_id|whatsapp|email)([ ,]|$)/,
      );
    }
  });

  it("reverter: provisório envia só o rótulo da categoria, nunca a observação interna", async () => {
    const { cliente, chamadas } = falso({ data: ID });
    const banco = criarBancoPontos(cliente as never);
    const r = await banco.reverterCredito({
      lancamentoId: ID,
      categoria: "fraude",
      observacao: "segredo do admin",
      confirmarSaldoNegativo: true,
    });
    expect(r.dados).toBe(ID);
    expect(chamadas.rpc[0]).toEqual([
      "pontos_reverter_credito",
      { p_lancamento_id: ID, p_motivo: "Suspeita de fraude", p_confirmar_saldo_negativo: true },
    ]);
  });

  it("repassa o código de erro do banco (P0409/P0410) sem expor exceção", async () => {
    const { cliente } = falso({ error: { code: "P0410", message: "x" } });
    const r = await criarBancoPontos(cliente as never).reverterCredito({
      lancamentoId: ID,
      categoria: "outro",
      observacao: null,
      confirmarSaldoNegativo: false,
    });
    expect(r.erro?.code).toBe("P0410");
  });

  it("exceção de rede vira erro genérico sem a mensagem original", async () => {
    const { cliente } = falso({}, true);
    const r = await criarBancoPontos(cliente as never).lerMeuSaldo();
    expect(r.erro?.code).toBe("XX000");
    expect(JSON.stringify(r)).not.toContain("segredo-interno");
  });

  it("benefício: opcionais viram nulos esperados pelo banco e o motivo da decisão idem", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoPontos(cliente as never);
    await banco.criarBeneficio({
      perfilId: ID,
      nome: "n",
      descricao: "d",
      pontosNecessarios: 5,
      condicoes: null,
      limiteTotal: null,
      limitePorPessoa: null,
      prazoResgateAte: null,
      prazoUsoAte: null,
    });
    await banco.decidirVersao({ versaoId: ID, aprovar: true, motivo: null });
    expect(chamadas.rpc[0]![0]).toBe("pontos_criar_beneficio");
    expect(chamadas.rpc[0]![1]).toMatchObject({
      p_perfil_id: ID,
      p_pontos_necessarios: 5,
      p_condicoes: null,
      p_limite_total: null,
    });
    expect(chamadas.rpc[1]).toEqual([
      "pontos_decidir_beneficio_versao",
      { p_versao_id: ID, p_aprovar: true, p_motivo: null },
    ]);
  });

  it("nenhuma RPC de resgate, cupom ou sorteio é chamada", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoPontos(cliente as never);
    for (const f of Object.values(banco)) {
      try {
        await (f as (a: unknown) => Promise<unknown>)({
          perfilId: ID,
          beneficioId: ID,
          versaoId: ID,
          pedidoId: ID,
          lancamentoId: ID,
          categoria: "outro",
          chave: "intervalo_dias",
        });
      } catch {
        /* ignorado: só interessa o nome das RPCs */
      }
    }
    for (const [nome] of chamadas.rpc) expect(nome).not.toMatch(/resgat|cupom|sorteio|premio/i);
  });
});
