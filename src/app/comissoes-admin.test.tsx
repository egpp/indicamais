// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssinaturaAdmin,
  ComissaoAdmin,
  NegocioAdmin,
  PagamentoAdmin,
  VinculoAdmin,
} from "@/modules/comissoes";

// Só fakes: nenhuma escrita em tabela comissoes_* (são só-inserção e permanentes).
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

import { AvisosSituacao } from "./_componentes/comissoes";
import {
  AbasAdmin,
  CartaoAssinaturaAdmin,
  CartaoComissaoAdmin,
  CartaoNegocioAdmin,
  CartaoPagamentoAdmin,
  CartaoVinculoAdmin,
  FiltrosAdmin,
  PaginacaoAdmin,
  AntecedenciaAtual,
  PrazoAtual,
  ResumoLista,
  hrefAdmin,
} from "./_componentes/comissoes-admin";
import { valorDivergente } from "./_lib/dinheiro-comissoes";

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

const botoes = () => screen.getAllByRole("group").length;
void botoes;
const plano = (el: Element) => (el.textContent ?? "").replace(/ /g, " ");
const resumos = () => Array.from(document.querySelectorAll("summary")).map((s) => s.textContent);

beforeEach(() => acaoLenta.mockClear());
afterEach(() => cleanup());

describe("negócios: habilitar e desabilitar por linha (IM-061)", () => {
  it("não pede identificador digitado: o negócio e a ação vão escondidos", () => {
    const n = negocio();
    const { container } = render(
      <ul>
        <CartaoNegocioAdmin n={n} />
      </ul>,
    );
    expect(resumos()).toEqual(["Habilitar o módulo"]);
    expect(screen.queryByLabelText(/Identificador/)).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="perfilId"]')?.value).toBe(
      n.negocioId,
    );
    expect(container.querySelector<HTMLInputElement>('input[name="ativa"]')?.value).toBe("sim");
    expect(screen.getByLabelText(/^Origem do pedido/)).toBeTruthy();
    expect(screen.getByLabelText(/^Motivo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Habilitar módulo" })).toBeTruthy();
  });

  it("negócio com módulo ativo oferece desabilitar; sem nome público mostra o endereço", () => {
    const { container } = render(
      <ul>
        <CartaoNegocioAdmin n={negocio({ moduloAtivo: true, nome: null, publicado: false })} />
      </ul>,
    );
    expect(resumos()).toEqual(["Desabilitar o módulo"]);
    expect(container.querySelector<HTMLInputElement>('input[name="ativa"]')?.value).toBe("nao");
    expect(screen.getByRole("heading", { name: "padaria-do-ze" })).toBeTruthy();
    expect(screen.getByText("Site não publicado")).toBeTruthy();
  });

  it("links levam às outras listas já filtradas pelo negócio", () => {
    const n = negocio();
    render(
      <ul>
        <CartaoNegocioAdmin n={n} />
      </ul>,
    );
    const href = screen.getByRole("link", { name: "pagamentos" }).getAttribute("href");
    expect(href).toBe(`/administracao/comissoes?aba=pagamentos&negocio=${n.negocioId}`);
  });
});

describe("assinaturas: confirmar pagamento por competência (IM-064, IM-070)", () => {
  const usuario = () => userEvent.setup({ applyAccept: false });

  it("traz o valor combinado, esconde a assinatura e só avisa quando o valor difere", async () => {
    const u = usuario();
    const a = assinatura();
    const { container } = render(
      <ul>
        <CartaoAssinaturaAdmin a={a} />
      </ul>,
    );
    expect(screen.queryByLabelText(/Identificador/)).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="assinaturaId"]')?.value).toBe(
      a.id,
    );
    const valor = screen.getByLabelText(/^Valor recebido/) as HTMLInputElement;
    expect(valor.value).toBe("99,90");
    expect(screen.queryByText(/diferente do combinado na assinatura/)).toBeNull();

    await u.clear(valor);
    await u.type(valor, "80,00");
    const aviso = await screen.findByText(/diferente do combinado na assinatura/);
    expect(plano(aviso)).toContain("R$ 99,90");
    expect(plano(aviso)).toContain("pelo menos 10 caracteres");

    await u.clear(valor);
    await u.type(valor, "99,90");
    await waitFor(() =>
      expect(screen.queryByText(/diferente do combinado na assinatura/)).toBeNull(),
    );
  });

  it("valor divergente exige motivo de 10+ caracteres e o envio é travado (IM-028)", async () => {
    const u = usuario();
    const { container } = render(
      <ul>
        <CartaoAssinaturaAdmin a={assinatura()} />
      </ul>,
    );
    const dentro = within(container.querySelector("details") as HTMLElement);
    const valor = dentro.getByLabelText(/^Valor recebido/);
    await u.clear(valor);
    await u.type(valor, "50");
    await u.type(dentro.getByLabelText(/^Mês da mensalidade/), "2026-10");
    await u.type(dentro.getByLabelText(/^Motivo/), "curto");
    await u.click(dentro.getByRole("checkbox", { name: /pagamento deste mês foi recebido/ }));
    await u.click(dentro.getByRole("button", { name: "Confirmar pagamento" }));
    expect(await dentro.findByText("O motivo precisa ter pelo menos 10 caracteres.")).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();

    await u.clear(dentro.getByLabelText(/^Motivo/));
    await u.type(dentro.getByLabelText(/^Motivo/), MOTIVO);
    await u.click(dentro.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(acaoLenta).toHaveBeenCalledTimes(1));
    const travado = await dentro.findByRole("button", { name: "Confirmando..." });
    expect((travado as HTMLButtonElement).disabled).toBe(true);
    await u.click(travado);
    expect(acaoLenta).toHaveBeenCalledTimes(1);
  });

  it("cancelar só para assinatura ativa; mostra o cliente só como conta curta", () => {
    const ativa = assinatura();
    const { container, rerender } = render(
      <ul>
        <CartaoAssinaturaAdmin a={ativa} />
      </ul>,
    );
    expect(resumos()).toEqual(["Confirmar pagamento de um mês", "Cancelar assinatura"]);
    expect(container.textContent).toContain(`${ativa.clienteId.slice(0, 8)}…`);
    expect(container.textContent).not.toContain(ativa.clienteId);
    expect(plano(container)).toContain("R$ 99,90 por mês");
    rerender(
      <ul>
        <CartaoAssinaturaAdmin a={assinatura({ situacao: "cancelada" })} />
      </ul>,
    );
    expect(resumos()).toEqual(["Confirmar pagamento de um mês"]);
  });

  it("assinatura cancelada mostra a dica de meses até o cancelamento; ativa não", () => {
    const { rerender } = render(
      <ul>
        <CartaoAssinaturaAdmin a={assinatura()} />
      </ul>,
    );
    expect(screen.queryByText(/só é possível confirmar meses até o cancelamento/)).toBeNull();
    rerender(
      <ul>
        <CartaoAssinaturaAdmin
          a={assinatura({ situacao: "cancelada", canceladaEm: "2026-09-10T12:00:00Z" })}
        />
      </ul>,
    );
    expect(screen.getByText(/só é possível confirmar meses até o cancelamento/)).toBeTruthy();
  });

  it("cada identificador curto tem botão Copiar id (cliente, negócio e oferta)", () => {
    render(
      <ul>
        <CartaoAssinaturaAdmin a={assinatura()} />
      </ul>,
    );
    expect(screen.getAllByRole("button", { name: /^Copiar id / })).toHaveLength(3);
  });

  it("valorDivergente ignora texto ilegível e compara em centavos", () => {
    expect(valorDivergente("99,90", 9990)).toBe(false);
    expect(valorDivergente("R$ 99,9", 9990)).toBe(false);
    expect(valorDivergente("99,80", 9990)).toBe(true);
    expect(valorDivergente("", 9990)).toBe(false);
    expect(valorDivergente("abc", 9990)).toBe(false);
  });
});

describe("pagamentos, comissões e vínculos: botões por estado (IM-070, IM-072, IM-073)", () => {
  it("pagamento confirmado pode ser estornado; estornado não tem botão", () => {
    const p = pagamento();
    const { container, rerender } = render(
      <ul>
        <CartaoPagamentoAdmin p={p} />
      </ul>,
    );
    expect(resumos()).toEqual(["Estornar este pagamento"]);
    expect(container.querySelector<HTMLInputElement>('input[name="pagamentoId"]')?.value).toBe(
      p.id,
    );
    expect(screen.queryByLabelText(/Identificador/)).toBeNull();
    expect(screen.getByText("Gerou comissão")).toBeTruthy();
    rerender(
      <ul>
        <CartaoPagamentoAdmin
          p={pagamento({ estado: "estornado", estornadoEm: "2026-11-02T10:00:00Z" })}
        />
      </ul>,
    );
    expect(resumos()).toEqual([]);
    expect(screen.getByText("Estornado")).toBeTruthy();
  });

  it("comissão gerada avança para pendente; pendente avança para paga; paga só reverte", () => {
    const g = comissao({ estado: "gerada" });
    const { container, rerender } = render(
      <ul>
        <CartaoComissaoAdmin c={g} />
      </ul>,
    );
    expect(resumos()).toEqual(["Marcar como pendente de repasse", "Reverter esta comissão"]);
    expect(container.querySelector<HTMLInputElement>('input[name="estado"]')?.value).toBe(
      "pendente_repasse",
    );
    expect(screen.getByLabelText(/^Causa da reversão/)).toBeTruthy();
    rerender(
      <ul>
        <CartaoComissaoAdmin c={comissao({ estado: "pendente_repasse" })} />
      </ul>,
    );
    expect(container.querySelector<HTMLInputElement>('input[name="estado"]')?.value).toBe("paga");
    expect(resumos()[0]).toBe("Registrar repasse feito (paga)");
    rerender(
      <ul>
        <CartaoComissaoAdmin c={comissao({ estado: "paga" })} />
      </ul>,
    );
    expect(resumos()).toEqual(["Reverter esta comissão"]);
    rerender(
      <ul>
        <CartaoComissaoAdmin
          c={comissao({ estado: "paga", revertida: true, reversaoCausa: "correcao" })}
        />
      </ul>,
    );
    expect(resumos()).toEqual([]);
    expect(container.textContent).toContain("Revertida");
    expect(container.textContent).toContain("Correção");
  });

  it("comissão mostra base, percentual congelado e valor em R$, com contas curtas", () => {
    const c = comissao();
    const { container } = render(
      <ul>
        <CartaoComissaoAdmin c={c} />
      </ul>,
    );
    expect(plano(container)).toContain("R$ 100,00 × 5% = R$ 5,00");
    expect(container.textContent).not.toContain(c.indicadorId);
    expect(container.textContent).not.toContain(c.clienteId);
  });

  it("só vínculo vencido tem o botão de encerrar, e ele é um por vez", () => {
    const v = vinculo();
    const { container, rerender } = render(
      <ul>
        <CartaoVinculoAdmin v={v} />
      </ul>,
    );
    expect(resumos()).toEqual(["Encerrar este vínculo"]);
    expect(screen.getByText("Prazo vencido")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="vinculoId"]')?.value).toBe(v.id);
    expect(container.textContent).toContain("encerramento previsto para 30/09/2026");
    rerender(
      <ul>
        <CartaoVinculoAdmin v={vinculo({ vencido: false, encerraEm: "2027-01-01" })} />
      </ul>,
    );
    expect(resumos()).toEqual([]);
    rerender(
      <ul>
        <CartaoVinculoAdmin
          v={vinculo({
            vencido: false,
            situacao: "encerrado",
            encerradoEm: "2026-10-05T10:00:00Z",
          })}
        />
      </ul>,
    );
    expect(container.textContent).toContain("encerrado em 05/10/2026");
  });

  it("irreversíveis pedem a caixa de confirmação antes de enviar", async () => {
    const u = userEvent.setup({ applyAccept: false });
    render(
      <ul>
        <CartaoVinculoAdmin v={vinculo()} />
      </ul>,
    );
    await u.type(screen.getByLabelText(/^Motivo/), MOTIVO);
    await u.click(screen.getByRole("button", { name: "Encerrar vínculo" }));
    expect(await screen.findByText("Marque a confirmação para continuar.")).toBeTruthy();
    expect(acaoLenta).not.toHaveBeenCalled();
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Encerrar vínculo" }));
    await waitFor(() => expect(acaoLenta).toHaveBeenCalledTimes(1));
  });
});

describe("filtros, abas, paginação e prazo (IM-068)", () => {
  it("abas marcam a atual com aria-current", () => {
    render(<AbasAdmin atual="pagamentos" />);
    const nav = screen.getByRole("navigation", { name: "Seções de comissões" });
    expect(within(nav).getByRole("link", { name: "Pagamentos" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Vínculos" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("filtro tem rótulos e mantém a seção e o negócio escolhidos", () => {
    const negocioId = uuid();
    const { container } = render(
      <FiltrosAdmin
        aba="comissoes"
        valores={{ estado: "paga", negocio: negocioId }}
        opcoesEstado={[
          { valor: "gerada", rotulo: "Geradas" },
          { valor: "paga", rotulo: "Pagas" },
        ]}
        rotuloEstado="Estado"
      />,
    );
    expect((screen.getByLabelText("Estado") as HTMLSelectElement).value).toBe("paga");
    expect(container.querySelector<HTMLInputElement>('input[name="aba"]')?.value).toBe("comissoes");
    expect(container.querySelector<HTMLInputElement>('input[name="negocio"]')?.value).toBe(
      negocioId,
    );
    expect(screen.queryByLabelText(/Buscar/)).toBeNull();
  });

  it("paginação preserva filtros, omite página 1 e some nos extremos", () => {
    const params = { aba: "pagamentos", estado: "confirmado", negocio: undefined };
    const { rerender } = render(
      <PaginacaoAdmin pagina={{ numero: 1, limite: 20, total: 45 }} params={params} />,
    );
    expect(screen.queryByRole("link", { name: "Página anterior" })).toBeNull();
    expect(screen.getByText("Página 1 de 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")).toBe(
      "/administracao/comissoes?aba=pagamentos&estado=confirmado&pagina=2",
    );
    rerender(<PaginacaoAdmin pagina={{ numero: 2, limite: 20, total: 45 }} params={params} />);
    expect(screen.getByRole("link", { name: "Página anterior" }).getAttribute("href")).toBe(
      "/administracao/comissoes?aba=pagamentos&estado=confirmado",
    );
    rerender(<PaginacaoAdmin pagina={{ numero: 3, limite: 20, total: 45 }} params={params} />);
    expect(screen.queryByRole("link", { name: "Próxima página" })).toBeNull();
    expect(hrefAdmin({})).toBe("/administracao/comissoes");
  });

  it("resumo conta a faixa mostrada e avisa lista vazia", () => {
    const { rerender } = render(
      <ResumoLista
        pagina={{ itens: [1, 2], total: 42, limite: 20, deslocamento: 20 }}
        vazio="Nada."
      />,
    );
    expect(screen.getByText("Mostrando 21 a 22 de 42.")).toBeTruthy();
    rerender(
      <ResumoLista pagina={{ itens: [], total: 0, limite: 20, deslocamento: 0 }} vazio="Nada." />,
    );
    expect(screen.getByText("Nada.")).toBeTruthy();
  });

  it("mostra o prazo vigente lido do banco, não um número fixo", () => {
    render(
      <PrazoAtual
        prazo={{ prazoDias: 45, minimo: 1, maximo: 365, atualizadoEm: "2026-11-01T12:00:00Z" }}
      />,
    );
    expect(screen.getByText("45 dias")).toBeTruthy();
    expect(document.body.textContent).toContain("1 a 365 dias");
    expect(document.body.textContent).toContain("alterado em 01/11/2026");
    expect(document.body.textContent).not.toContain("60");
  });
});

describe("antecedência do aviso (IM-072)", () => {
  it("mostra o valor vigente lido do banco", () => {
    render(
      <AntecedenciaAtual
        parametro={{
          chave: "aviso_encerramento_antecedencia_dias",
          valor: 12,
          minimo: 1,
          maximo: 365,
          atualizadoEm: null,
        }}
      />,
    );
    expect(screen.getByText("12 dias")).toBeTruthy();
    expect(document.body.textContent).toContain("1 a 365 dias");
  });
});

describe("painel do indicador: nome público nos avisos (IM-072, IM-050)", () => {
  const situacao = (negocioId: string) => ({
    negocioId,
    moduloAtivo: true,
    clientesAtivos: 1,
    clientesEncerrados: 0,
    emDia: false,
    inadimplenteDesde: "2026-10-01",
    encerraEm: "2026-11-30",
    prazoDias: 60,
    emAviso: true,
  });

  it("usa o nome público quando existe e um texto neutro quando é nulo", () => {
    const comNome = uuid();
    const semNome = uuid();
    render(
      <AvisosSituacao
        situacoes={[situacao(comNome), situacao(semNome)]}
        nomes={{ [comNome]: "Padaria do Zé" }}
      />,
    );
    expect(screen.getByText("Padaria do Zé:")).toBeTruthy();
    expect(screen.getByText("Em um negócio onde você indica:")).toBeTruthy();
    expect(document.body.textContent).not.toContain(semNome);
  });
});
