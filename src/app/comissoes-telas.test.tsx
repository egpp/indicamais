// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteBancoComissoes } from "@/modules/comissoes";

const acaoLenta = vi.fn(
  () => new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 200)),
);
vi.mock("./acoes-comissoes", () => {
  const a = (...x: unknown[]) => acaoLenta(...(x as []));
  return {
    acaoDefinirPrazoInadimplencia: a,
    acaoDefinirAntecedenciaAviso: a,
    acaoDefinirHabilitacao: a,
    acaoRegistrarVinculo: a,
    acaoRegistrarAssinatura: a,
    acaoCancelarAssinatura: a,
    acaoConfirmarPagamento: a,
    acaoEstornarPagamento: a,
    acaoReverterComissao: a,
    acaoAvancarRepasse: a,
    acaoEncerrarVinculo: a,
    acaoCriarOferta: a,
    acaoAlterarPercentual: a,
    acaoDefinirOfertaAtiva: a,
  };
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { FormComissoes } from "./_componentes/form-comissoes";
import { AvisosSituacao, CartaoComissao, SaldoComissoes } from "./_componentes/comissoes";
import { criarContextoComissoes } from "./_lib/contexto-comissoes";
import { errosDoFormulario } from "./_lib/definicoes-comissoes";
import {
  formatarPercentualBp,
  formatarReais,
  lerCompetencia,
  lerPercentualBp,
  lerReais,
  rotuloCompetencia,
} from "./_lib/dinheiro-comissoes";
import { lerDeRegistro } from "./_lib/entrada-conteudo";
import { tratarComissoes } from "./_lib/tratadores-comissoes";

const MOTIVO = "Conferi o recebimento no extrato.";
const ler = (d: Record<string, string>) => lerDeRegistro(d);
const form = (d: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(d)) f.set(k, v);
  return f;
};

beforeEach(() => acaoLenta.mockClear());
afterEach(() => cleanup());

describe("moeda, percentual e competência (IM-005)", () => {
  it("formata centavos em reais e pontos-base em percentual", () => {
    expect(formatarReais(12345)).toBe("R$ 123,45");
    expect(formatarReais(100_000_000)).toBe("R$ 1.000.000,00");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarPercentualBp(500)).toBe("5%");
    expect(formatarPercentualBp(250)).toBe("2,5%");
    expect(formatarPercentualBp(1)).toBe("0,01%");
    expect(formatarPercentualBp(10_000)).toBe("100%");
  });

  it("lê reais digitados em centavos e recusa lixo", () => {
    expect(lerReais("99,90")).toBe(9990);
    expect(lerReais("R$ 1.234,56")).toBe(123_456);
    expect(lerReais("50")).toBe(5000);
    expect(Number.isNaN(lerReais(""))).toBe(true);
    expect(Number.isNaN(lerReais("abc"))).toBe(true);
    expect(Number.isNaN(lerReais("1,234"))).toBe(true);
  });

  it("lê percentual em pontos-base", () => {
    expect(lerPercentualBp("10")).toBe(1000);
    expect(lerPercentualBp("7,5%")).toBe(750);
    expect(lerPercentualBp("0,01")).toBe(1);
    expect(Number.isNaN(lerPercentualBp("dez"))).toBe(true);
  });

  it("aceita competência AAAA-MM ou MM/AAAA", () => {
    expect(lerCompetencia("11/2026")).toBe("2026-11");
    expect(lerCompetencia("2026-11")).toBe("2026-11");
    expect(rotuloCompetencia("2026-11-01")).toBe("11/2026");
  });
});

describe("validação dos formulários (mesmos schemas do servidor)", () => {
  const ids = { assinaturaId: randomUUID() };

  it("pagamento: motivo curto, valor ilegível e confirmação ausente têm mensagem clara", () => {
    const e = errosDoFormulario(
      "pagamento",
      ler({ ...ids, competencia: "2026-11", valorCentavos: "abc", motivo: "curto" }),
    );
    expect(e?.motivo).toBe("O motivo precisa ter pelo menos 10 caracteres.");
    expect(e?.valorCentavos).toBe("Informe o valor em reais. Exemplo: 99,90.");
    expect(e?.confirmo).toBe("Marque a confirmação para continuar.");
  });

  it("pagamento: competência inválida é recusada em português", () => {
    const e = errosDoFormulario(
      "pagamento",
      ler({
        ...ids,
        competencia: "13/2026",
        valorCentavos: "99,90",
        motivo: MOTIVO,
        confirmo: "sim",
      }),
    );
    expect(e?.competencia).toBe("Competência inválida (use AAAA-MM).");
    expect(e?.motivo).toBeUndefined();
  });

  it("pagamento válido: sem erros", () => {
    expect(
      errosDoFormulario(
        "pagamento",
        ler({
          ...ids,
          competencia: "11/2026",
          valorCentavos: "R$ 99,90",
          motivo: MOTIVO,
          confirmo: "sim",
        }),
      ),
    ).toBeNull();
  });

  it("percentual fora de 0,01% a 100% nunca fala em pontos-base", () => {
    for (const p of ["0", "150", "abc", ""]) {
      const e = errosDoFormulario(
        "oferta",
        ler({ perfilId: randomUUID(), itemId: randomUUID(), nome: "Plano", percentualBp: p }),
      );
      expect(e?.percentualBp, p).toBe(
        "Informe um percentual entre 0,01% e 100%. Exemplo: 10 ou 7,5.",
      );
    }
    expect(
      errosDoFormulario(
        "oferta",
        ler({ perfilId: randomUUID(), itemId: randomUUID(), nome: "Plano", percentualBp: "7,5" }),
      ),
    ).toBeNull();
  });

  it("vínculo: indicador e cliente iguais; assinatura: fim antes do início", () => {
    const mesmo = randomUUID();
    const v = errosDoFormulario(
      "vinculo",
      ler({
        perfilId: randomUUID(),
        indicadorId: mesmo,
        clienteId: mesmo,
        motivo: MOTIVO,
        confirmo: "sim",
      }),
    );
    expect(v?.clienteId).toBe("Indicador e cliente devem ser contas diferentes.");
    const a = errosDoFormulario(
      "assinatura",
      ler({
        ofertaId: randomUUID(),
        clienteId: randomUUID(),
        valorCentavos: "50",
        inicio: "2026-11-10",
        fim: "2026-11-01",
        motivo: MOTIVO,
        confirmo: "sim",
      }),
    );
    expect(a?.fim).toBe("O fim não pode ser anterior ao início.");
  });

  it("habilitação e repasse não exigem a caixa de confirmação; reversão exige", () => {
    expect(
      errosDoFormulario(
        "habilitacao",
        ler({ perfilId: randomUUID(), ativa: "sim", origem: "solicitacao", motivo: MOTIVO }),
      ),
    ).toBeNull();
    const r = errosDoFormulario(
      "reversao",
      ler({ comissaoId: randomUUID(), causa: "correcao", motivo: MOTIVO }),
    );
    expect(r).toEqual({ confirmo: "Marque a confirmação para continuar." });
  });

  it("prazo de inadimplência: inteiro de dias com motivo", () => {
    expect(errosDoFormulario("parametro", ler({ valor: "abc", motivo: MOTIVO }))?.valor).toBe(
      "Informe um número inteiro de dias.",
    );
    expect(errosDoFormulario("parametro", ler({ valor: "45", motivo: MOTIVO }))).toBeNull();
  });
});

function bancoFalso(sobre: Partial<ClienteBancoComissoes> = {}) {
  const chamadas = vi.fn();
  const base = new Proxy(
    {},
    {
      get: (_, nome) => async (a: unknown) => {
        chamadas(String(nome), a);
        return { dados: null, erro: null };
      },
    },
  ) as ClienteBancoComissoes;
  return { banco: { ...base, ...sobre } as ClienteBancoComissoes, chamadas };
}

describe("tratadores (servidor)", () => {
  it("pagamento válido chama o módulo com centavos e competência no dia 1", async () => {
    const id = randomUUID();
    const { banco, chamadas } = bancoFalso({
      confirmarPagamento: async (a) => {
        chamadas("confirmarPagamento", a);
        return { dados: randomUUID(), erro: null };
      },
    });
    const ctx = criarContextoComissoes({ banco, logado: true });
    const estado = await tratarComissoes(
      ctx,
      "pagamento",
      form({
        assinaturaId: id,
        competencia: "11/2026",
        valorCentavos: "99,90",
        motivo: MOTIVO,
        confirmo: "sim",
      }),
    );
    expect(estado.sucesso).toMatch(/Pagamento confirmado/);
    expect(chamadas).toHaveBeenCalledWith("confirmarPagamento", {
      assinaturaId: id,
      competencia: "2026-11-01",
      valorCentavos: 9990,
      motivo: MOTIVO,
    });
  });

  it("sem confirmação ou com motivo curto, o banco nem é chamado", async () => {
    const { banco, chamadas } = bancoFalso();
    const ctx = criarContextoComissoes({ banco, logado: true });
    const estado = await tratarComissoes(
      ctx,
      "estorno",
      form({ pagamentoId: randomUUID(), motivo: "curto" }),
    );
    expect(estado.erros?.motivo).toBeTruthy();
    expect(estado.erros?.confirmo).toBeTruthy();
    expect(chamadas).not.toHaveBeenCalled();
  });

  it("comissão já paga: o banco pede confirmação (P0410) e a tela mostra a segunda caixa", async () => {
    const { banco } = bancoFalso({
      estornarPagamento: async () => ({ dados: null, erro: { code: "P0410" } }),
    });
    const ctx = criarContextoComissoes({ banco, logado: true });
    const estado = await tratarComissoes(
      ctx,
      "estorno",
      form({ pagamentoId: randomUUID(), motivo: MOTIVO, confirmo: "sim" }),
    );
    expect(estado.pedirConfirmacaoPaga).toBe(true);
    expect(estado.erro).toMatch(/já foi paga/);
  });

  it("não administrador: a mensagem do banco vira texto neutro, sem vazar detalhe", async () => {
    const { banco } = bancoFalso({
      definirHabilitacao: async () => ({
        dados: null,
        erro: { code: "42501", message: "detalhe interno do banco" },
      }),
    });
    const ctx = criarContextoComissoes({ banco, logado: true });
    const estado = await tratarComissoes(
      ctx,
      "habilitacao",
      form({ perfilId: randomUUID(), ativa: "sim", origem: "espontanea", motivo: MOTIVO }),
    );
    expect(estado.erro).toBe("Você não tem permissão para esta ação.");
    expect(JSON.stringify(estado)).not.toContain("detalhe interno");
  });
});

describe("formulário no navegador", () => {
  const usuario = () => userEvent.setup({ applyAccept: false });

  it("mostra erros em português e só envia depois de válido (IM-028)", async () => {
    const u = usuario();
    render(<FormComissoes chave="estorno" rotuloBotao="Estornar pagamento" />);
    await u.click(screen.getByRole("button", { name: "Estornar pagamento" }));
    expect(await screen.findByText("O motivo precisa ter pelo menos 10 caracteres.")).toBeTruthy();
    expect(screen.getByText("Marque a confirmação para continuar.")).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();

    await u.type(screen.getByLabelText(/^Identificador do pagamento/), randomUUID());
    await u.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Estornar pagamento" }));
    await waitFor(() => expect(acaoLenta).toHaveBeenCalledTimes(1));
    // Botão travado durante o envio: segundo clique não duplica.
    const travado = await screen.findByRole("button", { name: "Enviando..." });
    expect((travado as HTMLButtonElement).disabled).toBe(true);
    await u.click(travado);
    expect(acaoLenta).toHaveBeenCalledTimes(1);
  });

  it("campos têm rótulo; valor em R$ e percentual em %", () => {
    render(<FormComissoes chave="pagamento" rotuloBotao="Confirmar pagamento" />);
    expect(screen.getByLabelText(/^Valor recebido \(R\$\)/)).toBeTruthy();
    expect(screen.getByLabelText(/^Mês da mensalidade/)).toBeTruthy();
    cleanup();
    render(
      <FormComissoes
        chave="oferta"
        ocultos={{ perfilId: randomUUID() }}
        opcoes={{ itemId: [{ valor: randomUUID(), rotulo: "Plano mensal" }] }}
        rotuloBotao="Criar oferta"
      />,
    );
    expect(screen.getByLabelText(/^Comissão \(%\)/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Plano mensal" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("exibição e privacidade (IM-029, IM-041, IM-050, IM-065)", () => {
  const comissao = {
    id: randomUUID(),
    negocioId: randomUUID(),
    ofertaNome: "Plano mensal",
    competencia: "2026-11-01",
    baseCentavos: 10_000,
    percentualBp: 1000,
    valorCentavos: 1000,
    clienteRef: "a1b2c3d4e5f6a7b8c9d0",
    estado: "paga" as const,
    revertida: false,
    reversaoCausa: null,
    liquidoCentavos: 1000,
    criadaEm: "2026-11-05T12:00:00Z",
  };

  it("comissão em R$ com cliente só por referência opaca", () => {
    const { container } = render(
      <ul>
        <CartaoComissao c={comissao} />
      </ul>,
    );
    const t = container.textContent ?? "";
    expect(t).toContain("R$ 10,00");
    expect(t).toContain("10%");
    expect(t).toContain("11/2026");
    expect(t).toContain("Paga");
    expect(t).toContain("Cliente (referência): a1b2c3d4e5f6…");
    expect(t).not.toMatch(/@|\+55|telefone|whatsapp/i);
  });

  it("saldo de comissões separado dos pontos", () => {
    const { container } = render(
      <SaldoComissoes
        saldo={{
          totalGeradoCentavos: 5000,
          liquidoCentavos: 4000,
          geradaCentavos: 1000,
          pendenteRepasseCentavos: 1000,
          pagaCentavos: 2000,
          revertidaAposPagaCentavos: 0,
          quantidade: 3,
        }}
      />,
    );
    const t = container.textContent ?? "";
    expect(t).toContain("R$ 40,00");
    expect(t).toContain("Pendentes de repasse");
    expect(t).toContain("não soma nem altera seus pontos");
  });

  it("aviso de inadimplência mostra datas em pt-BR e não promete automação", () => {
    const { container } = render(
      <AvisosSituacao
        situacoes={[
          {
            negocioId: randomUUID(),
            moduloAtivo: true,
            clientesAtivos: 2,
            clientesEncerrados: 0,
            emDia: false,
            inadimplenteDesde: "2026-10-01",
            encerraEm: "2026-11-30",
            prazoDias: 60,
            emAviso: true,
          },
        ]}
      />,
    );
    const t = container.textContent ?? "";
    expect(t).toContain("em atraso desde 01/10/2026");
    expect(t).toContain("Regularize até 30/11/2026");
  });
});
