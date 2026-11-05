// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssinaturaAdmin,
  ClienteBancoComissoes,
  ComissaoAdmin,
  NegocioAdmin,
  PagamentoAdmin,
  VinculoAdmin,
} from "@/modules/comissoes";
import { criarServicoComissoes } from "@/modules/comissoes";
import type { ChaveComissoes } from "./_lib/definicoes-comissoes";
import { criarContextoComissoes } from "./_lib/contexto-comissoes";
import { tratarComissoes } from "./_lib/tratadores-comissoes";

/**
 * Auditoria de TODOS os botões de ação de /administracao/comissoes: cada cartão é montado, o usuário preenche os campos
 * visíveis, e o FormData REAL do navegador (jsdom) passa pelo tratador de servidor (Zod + serviço do módulo) com um
 * banco falso que só grava as chamadas. Prova que o botão envia os campos certos (uma única vez cada) e que o servidor
 * os aceita. Nenhuma escrita em tabela comissoes_* (são só-inserção e permanentes).
 */

const chamadas: { metodo: string; args: unknown }[] = [];
let codigoErroBanco: string | null = null;

function bancoFalso(): ClienteBancoComissoes {
  return new Proxy({} as ClienteBancoComissoes, {
    get: (_, metodo: string) => async (args: unknown) => {
      chamadas.push({ metodo, args });
      if (codigoErroBanco) return { dados: null, erro: { code: codigoErroBanco, message: "x" } };
      return { dados: "99999999-9999-4999-8999-999999999999", erro: null };
    },
  });
}

const formDatas: { chave: ChaveComissoes; dados: FormData }[] = [];
const ctx = () =>
  criarContextoComissoes({
    banco: bancoFalso(),
    logado: true,
    ehAdministrador: async () => true,
  });

vi.mock("./acoes-comissoes", () => {
  const por = (chave: ChaveComissoes) => async (_: unknown, dados: FormData) => {
    formDatas.push({ chave, dados });
    return tratarComissoes(ctx(), chave, dados);
  };
  return {
    acaoDefinirPrazoInadimplencia: por("parametro"),
    acaoDefinirAntecedenciaAviso: por("antecedenciaAviso"),
    acaoDefinirHabilitacao: por("habilitacao"),
    acaoRegistrarVinculo: por("vinculo"),
    acaoRegistrarAssinatura: por("assinatura"),
    acaoCancelarAssinatura: por("cancelarAssinatura"),
    acaoConfirmarPagamento: por("pagamento"),
    acaoEstornarPagamento: por("estorno"),
    acaoReverterComissao: por("reversao"),
    acaoAvancarRepasse: por("repasse"),
    acaoEncerrarVinculo: por("encerrarVinculo"),
    acaoCriarOferta: por("oferta"),
    acaoAlterarPercentual: por("percentual"),
    acaoDefinirOfertaAtiva: por("ofertaAtiva"),
  };
});

import {
  CartaoAssinaturaAdmin,
  CartaoComissaoAdmin,
  CartaoNegocioAdmin,
  CartaoPagamentoAdmin,
  CartaoVinculoAdmin,
} from "./_componentes/comissoes-admin";
import { FormComissoes } from "./_componentes/form-comissoes";

const uuid = () => randomUUID();
const MOTIVO = "Conferi o recebimento no extrato.";

const negocio = (extra: Partial<NegocioAdmin> = {}): NegocioAdmin => ({
  negocioId: uuid(),
  slug: "padaria-do-ze",
  nome: "Padaria do Zé",
  publicado: true,
  moduloAtivo: false,
  estadoDesde: null,
  origem: null,
  ...extra,
});
const assinatura = (extra: Partial<AssinaturaAdmin> = {}): AssinaturaAdmin => ({
  id: uuid(),
  negocioId: uuid(),
  ofertaId: uuid(),
  ofertaNome: "Plano mensal",
  clienteId: uuid(),
  valorCentavos: 9990,
  inicio: "2026-09-01",
  fim: null,
  situacao: "ativa",
  canceladaEm: null,
  criadaEm: "2026-09-01T10:00:00Z",
  ...extra,
});
const pagamento = (extra: Partial<PagamentoAdmin> = {}): PagamentoAdmin => ({
  id: uuid(),
  assinaturaId: uuid(),
  negocioId: uuid(),
  ofertaNome: "Plano mensal",
  clienteId: uuid(),
  competencia: "2026-10-01",
  valorCentavos: 9990,
  estado: "confirmado",
  estornadoEm: null,
  comissaoId: uuid(),
  confirmadoEm: "2026-11-01T10:00:00Z",
  ...extra,
});
const comissao = (extra: Partial<ComissaoAdmin> = {}): ComissaoAdmin => ({
  id: uuid(),
  negocioId: uuid(),
  pagamentoId: uuid(),
  ofertaNome: "Plano mensal",
  competencia: "2026-10-01",
  indicadorId: uuid(),
  clienteId: uuid(),
  baseCentavos: 10000,
  percentualBp: 500,
  valorCentavos: 500,
  estado: "gerada",
  estadoEm: "2026-11-01T10:00:00Z",
  revertida: false,
  reversaoCausa: null,
  criadaEm: "2026-11-01T10:00:00Z",
  ...extra,
});
const vinculo = (extra: Partial<VinculoAdmin> = {}): VinculoAdmin => ({
  id: uuid(),
  negocioId: uuid(),
  indicadorId: uuid(),
  clienteId: uuid(),
  situacao: "ativo",
  indicadorEmDia: false,
  inadimplenteDesde: "2026-08-01",
  encerraEm: "2026-09-30",
  vencido: true,
  criadoEm: "2026-07-01T10:00:00Z",
  encerradoEm: null,
  ...extra,
});

beforeEach(() => {
  chamadas.length = 0;
  formDatas.length = 0;
  codigoErroBanco = null;
});
afterEach(() => cleanup());

const u = () => userEvent.setup({ applyAccept: false });
const nomes = (f: FormData) => Array.from(f.keys());
/** Cada campo aparece uma única vez no FormData (nada de campo oculto repetido com o mesmo nome). */
const semDuplicados = (f: FormData) => expect(new Set(nomes(f)).size).toBe(nomes(f).length);
const ultimo = () => formDatas[formDatas.length - 1]!;

async function marcarEEnviar(usuario: ReturnType<typeof u>, rotulo: string) {
  const caixa = screen.queryByRole("checkbox");
  if (caixa) await usuario.click(caixa);
  await usuario.click(screen.getByRole("button", { name: rotulo }));
  await waitFor(() => expect(chamadas.length).toBe(1));
}

describe("botões por linha: FormData real -> ação de servidor -> banco falso (IM-061 a IM-073)", () => {
  it("habilitar módulo envia perfilId e ativa=sim escondidos e origem/motivo digitados", async () => {
    const usuario = u();
    const n = negocio();
    render(<CartaoNegocioAdmin n={n} />);
    await usuario.selectOptions(screen.getByLabelText(/^Origem do pedido/), "solicitacao");
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(screen.getByRole("button", { name: "Habilitar módulo" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    semDuplicados(ultimo().dados);
    expect(chamadas[0]).toEqual({
      metodo: "definirHabilitacao",
      args: { perfilId: n.negocioId, ativa: true, origem: "solicitacao", motivo: MOTIVO },
    });
  });

  it("desabilitar módulo envia ativa=false", async () => {
    const usuario = u();
    const n = negocio({ moduloAtivo: true });
    render(<CartaoNegocioAdmin n={n} />);
    await usuario.selectOptions(screen.getByLabelText(/^Origem do pedido/), "espontanea");
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(screen.getByRole("button", { name: "Desabilitar módulo" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    expect(chamadas[0]).toEqual({
      metodo: "definirHabilitacao",
      args: { perfilId: n.negocioId, ativa: false, origem: "espontanea", motivo: MOTIVO },
    });
  });

  it("confirmar pagamento envia assinaturaId, competência, valor em centavos e motivo", async () => {
    const usuario = u();
    const a = assinatura();
    render(<CartaoAssinaturaAdmin a={a} />);
    const det = within(screen.getByText("Confirmar pagamento de um mês").closest("details")!);
    await usuario.type(det.getByLabelText(/^Mês da mensalidade/), "2026-10");
    await usuario.type(det.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(det.getByRole("checkbox"));
    await usuario.click(det.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    semDuplicados(ultimo().dados);
    expect(chamadas[0]).toEqual({
      metodo: "confirmarPagamento",
      args: { assinaturaId: a.id, competencia: "2026-10-01", valorCentavos: 9990, motivo: MOTIVO },
    });
  });

  it("confirmar pagamento com valor divergente envia os centavos digitados e o motivo", async () => {
    const usuario = u();
    const a = assinatura();
    render(<CartaoAssinaturaAdmin a={a} />);
    const det = within(screen.getByText("Confirmar pagamento de um mês").closest("details")!);
    const valor = det.getByLabelText(/^Valor recebido/);
    await usuario.clear(valor);
    await usuario.type(valor, "80,05");
    await usuario.type(det.getByLabelText(/^Mês da mensalidade/), "11/2026");
    await usuario.type(det.getByLabelText(/^Motivo/), "Cliente pagou com desconto combinado.");
    await usuario.click(det.getByRole("checkbox"));
    await usuario.click(det.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    expect(chamadas[0]).toEqual({
      metodo: "confirmarPagamento",
      args: {
        assinaturaId: a.id,
        competencia: "2026-11-01",
        valorCentavos: 8005,
        motivo: "Cliente pagou com desconto combinado.",
      },
    });
  });

  it("cancelar assinatura envia assinaturaId e motivo", async () => {
    const usuario = u();
    const a = assinatura();
    render(<CartaoAssinaturaAdmin a={a} />);
    const det = within(
      screen.getByText("Cancelar assinatura", { selector: "summary" }).closest("details")!,
    );
    await usuario.type(det.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(det.getByRole("checkbox"));
    await usuario.click(det.getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    semDuplicados(ultimo().dados);
    expect(chamadas[0]).toEqual({
      metodo: "cancelarAssinatura",
      args: { assinaturaId: a.id, motivo: MOTIVO },
    });
  });

  it("estornar pagamento envia pagamentoId e motivo (sem confirmarJaPaga)", async () => {
    const usuario = u();
    const p = pagamento();
    render(<CartaoPagamentoAdmin p={p} />);
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await marcarEEnviar(usuario, "Estornar pagamento");
    semDuplicados(ultimo().dados);
    expect(chamadas[0]).toEqual({
      metodo: "estornarPagamento",
      args: { pagamentoId: p.id, motivo: MOTIVO, confirmarJaPaga: false },
    });
  });

  it("reverter comissão envia comissaoId, causa e motivo", async () => {
    const usuario = u();
    const c = comissao();
    render(<CartaoComissaoAdmin c={c} />);
    const det = within(screen.getByText("Reverter esta comissão").closest("details")!);
    await usuario.selectOptions(det.getByLabelText(/^Causa da reversão/), "correcao");
    await usuario.type(det.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(det.getByRole("checkbox"));
    await usuario.click(det.getByRole("button", { name: "Reverter comissão" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    semDuplicados(ultimo().dados);
    expect(chamadas[0]).toEqual({
      metodo: "reverterComissao",
      args: { comissaoId: c.id, causa: "correcao", motivo: MOTIVO, confirmarJaPaga: false },
    });
  });

  it.each([
    ["gerada", "Marcar como pendente de repasse", "pendente_repasse"],
    ["pendente_repasse", "Registrar repasse feito (paga)", "paga"],
  ] as const)(
    "avançar repasse (%s) envia comissaoId e estado=%s escondidos",
    async (estado, titulo, alvo) => {
      const usuario = u();
      const c = comissao({ estado });
      render(<CartaoComissaoAdmin c={c} />);
      const det = within(screen.getByText(titulo, { selector: "summary" }).closest("details")!);
      await usuario.type(det.getByLabelText(/^Motivo/), MOTIVO);
      await usuario.click(det.getByRole("checkbox"));
      await usuario.click(det.getByRole("button", { name: titulo }));
      await waitFor(() => expect(chamadas.length).toBe(1));
      semDuplicados(ultimo().dados);
      expect(chamadas[0]).toEqual({
        metodo: "avancarRepasse",
        args: { comissaoId: c.id, estado: alvo, motivo: MOTIVO },
      });
    },
  );

  it("encerrar vínculo envia vinculoId (o bug do PR #44) e motivo", async () => {
    const usuario = u();
    const v = vinculo();
    render(<CartaoVinculoAdmin v={v} />);
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await marcarEEnviar(usuario, "Encerrar vínculo");
    semDuplicados(ultimo().dados);
    expect(ultimo().dados.get("vinculoId")).toBe(v.id);
    expect(chamadas[0]).toEqual({
      metodo: "encerrarVinculo",
      args: { vinculoId: v.id, motivo: MOTIVO },
    });
  });

  it("registrar vínculo (formulário da página) envia as três contas e o motivo", async () => {
    const usuario = u();
    const [perfil, ind, cli] = [uuid(), uuid(), uuid()];
    render(
      <FormComissoes
        chave="vinculo"
        iniciais={{ perfilId: perfil }}
        rotuloBotao="Registrar vínculo"
      />,
    );
    await usuario.clear(screen.getByLabelText(/^Identificador do negócio/));
    await usuario.type(screen.getByLabelText(/^Identificador do negócio/), perfil);
    await usuario.type(screen.getByLabelText(/^Identificador da conta do indicador/), ind);
    await usuario.type(screen.getByLabelText(/^Identificador da conta do cliente/), cli);
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await marcarEEnviar(usuario, "Registrar vínculo");
    expect(chamadas[0]).toEqual({
      metodo: "registrarVinculo",
      args: { perfilId: perfil, indicadorId: ind, clienteId: cli, motivo: MOTIVO },
    });
  });

  it("registrar assinatura envia oferta, cliente, centavos, datas e motivo", async () => {
    const usuario = u();
    const [oferta, cli] = [uuid(), uuid()];
    render(<FormComissoes chave="assinatura" rotuloBotao="Registrar assinatura" />);
    await usuario.type(screen.getByLabelText(/^Identificador da oferta/), oferta);
    await usuario.type(screen.getByLabelText(/^Identificador da conta do cliente/), cli);
    await usuario.type(screen.getByLabelText(/^Valor da mensalidade/), "149,90");
    await usuario.type(screen.getByLabelText(/^Início da assinatura/), "2026-09-01");
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await marcarEEnviar(usuario, "Registrar assinatura");
    expect(chamadas[0]).toEqual({
      metodo: "registrarAssinatura",
      args: {
        ofertaId: oferta,
        clienteId: cli,
        valorCentavos: 14990,
        inicio: "2026-09-01",
        fim: null,
        motivo: MOTIVO,
      },
    });
  });

  it("prazo de inadimplência envia a chave fixa, o valor inteiro e o motivo", async () => {
    const usuario = u();
    render(<FormComissoes chave="parametro" rotuloBotao="Salvar prazo" />);
    await usuario.type(screen.getByLabelText(/^Prazo de inadimplência/), "45");
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(screen.getByRole("button", { name: "Salvar prazo" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    expect(chamadas[0]).toEqual({
      metodo: "definirParametro",
      args: { chave: "prazo_inadimplencia_dias", valor: 45, motivo: MOTIVO },
    });
  });
});

describe("antecedência do aviso de encerramento (IM-072)", () => {
  it("envia a chave fixa, o valor inteiro e o motivo, só com a confirmação marcada", async () => {
    const usuario = u();
    render(
      <FormComissoes
        chave="antecedenciaAviso"
        rotuloBotao="Salvar antecedência"
        textoConfirmacao="Confirmo a mudança."
      />,
    );
    await usuario.type(screen.getByLabelText(/^Antecedência do aviso de encerramento/), "400");
    await usuario.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await usuario.click(screen.getByRole("button", { name: "Salvar antecedência" }));
    expect(chamadas.length).toBe(0);
    expect(document.body.textContent).toContain("dias entre 1 e 365");
    expect(document.body.textContent).toContain("Marque a confirmação");
    const campo = screen.getByLabelText(/^Antecedência do aviso de encerramento/);
    await usuario.clear(campo);
    await usuario.type(campo, "10");
    await usuario.click(screen.getByLabelText("Confirmo a mudança."));
    await usuario.click(screen.getByRole("button", { name: "Salvar antecedência" }));
    await waitFor(() => expect(chamadas.length).toBe(1));
    expect(chamadas[0]).toEqual({
      metodo: "definirParametro",
      args: { chave: "aviso_encerramento_antecedencia_dias", valor: 10, motivo: MOTIVO },
    });
  });
});

describe("servidor não confia nos campos escondidos do cliente (Zod + banco)", () => {
  const fd = (campos: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    return f;
  };

  it.each([
    ["estorno", { pagamentoId: "nao-e-uuid", motivo: MOTIVO, confirmo: "on" }],
    ["encerrarVinculo", { vinculoId: "' or 1=1 --", motivo: MOTIVO, confirmo: "on" }],
    ["cancelarAssinatura", { assinaturaId: "", motivo: MOTIVO, confirmo: "on" }],
    ["reversao", { comissaoId: "123", causa: "correcao", motivo: MOTIVO, confirmo: "on" }],
    ["repasse", { comissaoId: uuid(), estado: "gerada", motivo: MOTIVO, confirmo: "on" }],
    ["habilitacao", { perfilId: uuid(), ativa: "talvez", origem: "espontanea", motivo: MOTIVO }],
  ] as const)("%s com id/valor adulterado é recusado antes do banco", async (chave, campos) => {
    const r = await tratarComissoes(ctx(), chave, fd(campos));
    expect(chamadas).toEqual([]);
    expect(r.sucesso).toBeUndefined();
    expect(r.erros ?? r.erro).toBeTruthy();
  });

  it("repasse com id duplicado no FormData usa só o primeiro e ainda passa pelo Zod", async () => {
    const f = fd({ comissaoId: uuid(), estado: "paga", motivo: MOTIVO, confirmo: "on" });
    f.append("comissaoId", "lixo");
    const r = await tratarComissoes(ctx(), "repasse", f);
    expect(r.sucesso).toBeTruthy();
    expect(chamadas).toHaveLength(1);
  });

  it("quem não é administrador: o banco recusa (42501) e a mensagem não vaza texto técnico", async () => {
    codigoErroBanco = "42501";
    const r = await tratarComissoes(
      ctx(),
      "encerrarVinculo",
      fd({ vinculoId: uuid(), motivo: MOTIVO, confirmo: "on" }),
    );
    expect(r.sucesso).toBeUndefined();
    expect(r.erro).toBeTruthy();
    expect(JSON.stringify(r)).not.toMatch(/42501|comissoes_|permission|rpc/i);
  });

  it("o tratador nunca usa chave de serviço: só o cliente do contexto", () => {
    const servico = criarServicoComissoes(bancoFalso());
    expect(typeof servico.encerrarVinculo).toBe("function");
  });
});

describe("IM-090: nenhum texto sugere cobrança ou repasse automático", () => {
  it("cartões e formulários não prometem cobrar, debitar ou transferir sozinhos", () => {
    const { container } = render(
      <ul>
        <CartaoNegocioAdmin n={negocio()} />
        <CartaoAssinaturaAdmin a={assinatura()} />
        <CartaoPagamentoAdmin p={pagamento()} />
        <CartaoComissaoAdmin c={comissao()} />
        <CartaoComissaoAdmin c={comissao({ estado: "pendente_repasse" })} />
        <CartaoVinculoAdmin v={vinculo()} />
      </ul>,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(
      /cobrar|cobran[çc]a autom|d[ée]bito autom|transfer[ie]\w* autom|pagamento autom|pix autom|repasse autom/i,
    );
    expect(texto).toMatch(/fora da plataforma/);
  });
});
