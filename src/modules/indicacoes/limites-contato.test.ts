import { describe, expect, it, vi } from "vitest";
import {
  criarServicoIndicacoes,
  type ClienteBancoIndicacoes,
  type LinhaAlarme,
  type LinhaParametro,
} from "./index";

/** Tela "Limites do contato" (D-034 item 1, S-03, IM-076, IM-086): leitura e escrita pelo serviço do módulo. */

const PERFIL = "11111111-1111-4111-8111-111111111111";
const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const semErro = async () => ({ erro: null });
const erroSimples = (code: string) => async () => ({
  erro: { code, message: "texto interno do banco" },
});
const erroDb = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco" },
});

function fake(sobrescrever: Partial<ClienteBancoIndicacoes> = {}) {
  return {
    gerarLink: vi.fn(ok([])),
    registrarCompartilhamento: vi.fn(semErro),
    enviarContato: vi.fn(ok([])),
    listarMeusPedidos: vi.fn(ok([])),
    listarMinhasIndicacoes: vi.fn(ok([])),
    listarMeusLinks: vi.fn(ok([])),
    listarFilaContatos: vi.fn(ok([])),
    solicitarReenvio: vi.fn(semErro),
    tratarAlerta: vi.fn(semErro),
    listarParametros: vi.fn(ok<LinhaParametro[]>([])),
    definirParametro: vi.fn(semErro),
    listarAlarmes: vi.fn(ok<LinhaAlarme[]>([])),
    descartarNotificacoes: vi.fn(ok(0)),
    listarNotificacoesDescartaveis: vi.fn(ok({ linhas: [], total: 0 })),
    ...sobrescrever,
  } satisfies ClienteBancoIndicacoes;
}
const servico = (b = fake()) => criarServicoIndicacoes(b, { urlBase: "https://exemplo.com.br" });

const lp = (chave: string, valor: number, minimo: number, maximo: number): LinhaParametro => ({
  chave,
  valor,
  minimo,
  maximo,
  descricao: "d",
  atualizado_em: "2026-11-06T12:00:00Z",
});
const todos = [
  lp("contato_janela_repeticao_minutos", 5, 1, 1440),
  lp("contato_limite_global_hora", 1000, 10, 10000),
  lp("contato_recusar_excesso", 0, 0, 1),
  lp("contato_limite_por_destino_hora", 60, 1, 10000),
  lp("contato_limite_por_link_hora", 20, 1, 1000),
];
const motivo = "Turnstile no ar, ligando a recusa";
const RECUSAR = "contato_recusar_excesso";

describe("parâmetros do contato", () => {
  it("lista só as 4 chaves do contato, na ordem de exibição", async () => {
    const r = await servico(fake({ listarParametros: ok(todos) })).listarParametrosContato();
    expect(r.ok && r.valor.map((p) => p.chave)).toEqual([
      "contato_recusar_excesso",
      "contato_limite_por_link_hora",
      "contato_limite_por_destino_hora",
      "contato_limite_global_hora",
    ]);
  });

  it("não administrador: lista vazia e definir recusado como sem permissão, sem escrever", async () => {
    const b = fake({ listarParametros: ok([]) });
    const l = await servico(b).listarParametrosContato();
    expect(l.ok && l.valor).toEqual([]);
    const r = await servico(b).definirParametroContato({ chave: RECUSAR, valor: 1, motivo });
    expect(!r.ok && r.erro.codigo).toBe("PERMISSAO");
    expect(b.definirParametro).not.toHaveBeenCalled();
  });

  it("liga o interruptor com motivo válido, sem espaços nas pontas", async () => {
    const b = fake({ listarParametros: ok(todos) });
    const r = await servico(b).definirParametroContato({
      chave: RECUSAR,
      valor: 1,
      motivo: `  ${motivo}  `,
    });
    expect(r.ok).toBe(true);
    expect(b.definirParametro).toHaveBeenCalledWith({ chave: RECUSAR, valor: 1, motivo });
  });

  it("chave fora da lista do contato é recusada, mesmo existindo em indicacoes_parametro", async () => {
    const b = fake({ listarParametros: ok(todos) });
    const r = await servico(b).definirParametroContato({
      chave: "contato_janela_repeticao_minutos",
      valor: 5,
      motivo,
    });
    expect(!r.ok && r.erro.mensagem).toBe("Este parâmetro não pode ser alterado aqui.");
    expect(b.definirParametro).not.toHaveBeenCalled();
  });

  it("motivo com menos de 10 caracteres ou ausente é recusado", async () => {
    const b = fake({ listarParametros: ok(todos) });
    const s = servico(b);
    const curto = await s.definirParametroContato({ chave: RECUSAR, valor: 1, motivo: "curto" });
    expect(!curto.ok && curto.erro.campos?.motivo).toBe(
      "O motivo deve ter ao menos 10 caracteres.",
    );
    const brancos = await s.definirParametroContato({
      chave: RECUSAR,
      valor: 1,
      motivo: " ".repeat(20),
    });
    expect(brancos.ok).toBe(false);
    expect((await s.definirParametroContato({ chave: RECUSAR, valor: 1 })).ok).toBe(false);
    expect(b.definirParametro).not.toHaveBeenCalled();
  });

  it("valor fora da faixa, não inteiro ou texto: recusado antes de escrever; os limites da faixa passam", async () => {
    const b = fake({ listarParametros: ok(todos) });
    const s = servico(b);
    const g = "contato_limite_global_hora";
    const l = "contato_limite_por_link_hora";
    const f1 = await s.definirParametroContato({ chave: RECUSAR, valor: 2, motivo });
    expect(!f1.ok && f1.erro.campos?.valor).toBe("Informe um valor entre 0 e 1.");
    const f2 = await s.definirParametroContato({ chave: g, valor: 9, motivo });
    expect(!f2.ok && f2.erro.campos?.valor).toBe("Informe um valor entre 10 e 10000.");
    for (const valor of [1001, 0, 1.5, "7"]) {
      expect((await s.definirParametroContato({ chave: l, valor, motivo })).ok).toBe(false);
    }
    expect(b.definirParametro).not.toHaveBeenCalled();
    expect((await s.definirParametroContato({ chave: g, valor: 10, motivo })).ok).toBe(true);
    expect((await s.definirParametroContato({ chave: l, valor: 1000, motivo })).ok).toBe(true);
  });

  it("erro do banco vira mensagem em português, sem o texto interno", async () => {
    const b = fake({ listarParametros: ok(todos), definirParametro: erroSimples("42501") });
    const r = await servico(b).definirParametroContato({ chave: RECUSAR, valor: 1, motivo });
    expect(!r.ok && r.erro.mensagem).toBe("Você não tem permissão para esta ação.");
    expect(JSON.stringify(r)).not.toMatch(/texto interno/);
    const c = fake({ listarParametros: ok(todos), definirParametro: erroSimples("23514") });
    const r2 = await servico(c).definirParametroContato({ chave: RECUSAR, valor: 1, motivo });
    expect(!r2.ok && r2.erro.mensagem).toBe(
      "O valor está fora da faixa permitida para este parâmetro.",
    );
  });
});

describe("alarmes de excesso do contato", () => {
  const alarme = (id: number, tipo: string, total: number): LinhaAlarme => ({
    o_id: id,
    o_tipo: tipo,
    o_janela: "2026-11-09T12:00:00Z",
    o_alvo_id: (tipo === "global" ? null : PERFIL) as string,
    o_nivel: 1,
    o_quantidade: 130,
    o_limite: 60,
    o_criado_em: "2026-11-09T12:30:00Z",
    o_total: total,
  });

  it("paginação de 50, filtro por tipo, total e nenhum dado pessoal", async () => {
    const b = fake({
      listarAlarmes: vi.fn(ok([alarme(2, "destino", 73), alarme(1, "global", 73)])),
    });
    const r = await servico(b).listarAlarmesContato({ tipo: "destino", pagina: 2 });
    expect(b.listarAlarmes).toHaveBeenCalledWith({ tipo: "destino", limite: 50, deslocamento: 50 });
    expect(r.ok && r.valor.total).toBe(73);
    expect(r.ok && r.valor.itens[0]).toEqual({
      id: 2,
      tipo: "destino",
      janela: "2026-11-09T12:00:00Z",
      alvoId: PERFIL,
      nivel: 1,
      quantidade: 130,
      limite: 60,
      criadoEm: "2026-11-09T12:30:00Z",
    });
    expect(JSON.stringify(r)).not.toMatch(/whatsapp|email|nome|mensagem/i);
  });

  it("padrão página 1 sem filtro; tipo ou página inválidos não chegam ao banco; sem permissão", async () => {
    const b = fake();
    const r = await servico(b).listarAlarmesContato();
    expect(r.ok && r.valor).toEqual({ itens: [], total: 0, pagina: 1, porPagina: 50 });
    expect(b.listarAlarmes).toHaveBeenCalledWith({ tipo: null, limite: 50, deslocamento: 0 });
    expect((await servico(b).listarAlarmesContato({ tipo: "x" })).ok).toBe(false);
    expect((await servico(b).listarAlarmesContato({ pagina: 0 })).ok).toBe(false);
    expect(b.listarAlarmes).toHaveBeenCalledTimes(1);
    const n = await servico(fake({ listarAlarmes: erroDb("42501") })).listarAlarmesContato({});
    expect(!n.ok && n.erro.codigo).toBe("PERMISSAO");
  });
});
