import { describe, expect, it, vi } from "vitest";
import {
  criarServicoIndicacoes,
  novaChaveContato,
  type ClienteBancoIndicacoes,
  type LinhaFilaContato,
  type LinhaMeuLink,
  type LinhaMeuPedido,
  type LinhaMinhaIndicacao,
  type LinhaParametro,
  type MinhaIndicacao,
} from "./index";

const PERFIL = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const PEDIDO = "33333333-3333-4333-8333-333333333333";
const CODIGO = "0123456789abcdef0123456789abcdef";
const CHAVE = "chave-do-formulario-1";
const ORIGEM = "https://indicamais.exemplo.com.br";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const semErro = async () => ({ erro: null });

function fake(sobrescrever: Partial<ClienteBancoIndicacoes> = {}) {
  const banco = {
    gerarLink: vi.fn(ok([{ o_codigo: CODIGO, o_novo: true }])),
    registrarCompartilhamento: vi.fn(semErro),
    enviarContato: vi.fn(
      ok([{ o_pedido_id: PEDIDO, o_whatsapp_responsavel: "+5511988887777", o_repetido: false }]),
    ),
    listarMeusPedidos: vi.fn(ok<LinhaMeuPedido[]>([])),
    listarMinhasIndicacoes: vi.fn(ok<LinhaMinhaIndicacao[]>([])),
    listarMeusLinks: vi.fn(ok<LinhaMeuLink[]>([])),
    listarFilaContatos: vi.fn(ok<LinhaFilaContato[]>([])),
    solicitarReenvio: vi.fn(semErro),
    tratarAlerta: vi.fn(semErro),
    listarParametros: vi.fn(ok<LinhaParametro[]>([])),
    definirParametro: vi.fn(semErro),
    ...sobrescrever,
  } satisfies ClienteBancoIndicacoes;
  return banco;
}
const servico = (b = fake(), urlBase: string | null | undefined = ORIGEM) =>
  criarServicoIndicacoes(b, { urlBase });
const erroDb = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco" },
});
const erroSimples = (code: string) => async () => ({
  erro: { code, message: "texto interno do banco" },
});

describe("gerarLink (IM-024)", () => {
  it("perfil: URL do destino com ?ind=, texto e wa.me", async () => {
    const b = fake();
    const r = await servico(b).gerarLink({
      tipo: "perfil",
      id: PERFIL,
      slug: "padaria-do-ze",
      nome: "Padaria do Zé",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(b.gerarLink).toHaveBeenCalledWith({ perfilId: PERFIL, itemId: null });
    expect(r.valor.codigo).toBe(CODIGO);
    expect(r.valor.novo).toBe(true);
    expect(r.valor.url).toBe(`${ORIGEM}/perfil/padaria-do-ze?ind=${CODIGO}`);
    expect(r.valor.texto).toContain("Padaria do Zé");
    expect(r.valor.texto).toContain(r.valor.url);
    expect(r.valor.urlWhatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(r.valor.texto)}`);
  });

  it("item: usa o id no endereço; sem nome usa texto genérico", async () => {
    const b = fake();
    const r = await servico(b).gerarLink({ tipo: "item", id: ITEM });
    expect(r.ok && r.valor.url).toBe(`${ORIGEM}/item/${ITEM}?ind=${CODIGO}`);
    expect(b.gerarLink).toHaveBeenCalledWith({ perfilId: null, itemId: ITEM });
  });

  it("gerar de novo devolve o mesmo código (novo=false)", async () => {
    const b = fake({ gerarLink: vi.fn(ok([{ o_codigo: CODIGO, o_novo: false }])) });
    const r = await servico(b).gerarLink({ tipo: "item", id: ITEM });
    expect(r.ok && r.valor.novo).toBe(false);
  });

  it("origem com caminho ou barra final não duplica barras; esquema inválido é recusado", async () => {
    const r1 = await servico(fake(), `${ORIGEM}/algum/caminho/`).gerarLink({
      tipo: "item",
      id: ITEM,
    });
    expect(r1.ok && r1.valor.url).toBe(`${ORIGEM}/item/${ITEM}?ind=${CODIGO}`);
    for (const ruim of [null, undefined, "", "javascript:alert(1)", "nao é url"]) {
      const b = fake();
      const r = await criarServicoIndicacoes(b, { urlBase: ruim }).gerarLink({
        tipo: "item",
        id: ITEM,
      });
      expect(r.ok).toBe(false);
      expect(b.gerarLink).not.toHaveBeenCalled();
    }
  });

  it("entrada inválida não chega ao banco", async () => {
    const b = fake();
    const s = servico(b);
    expect((await s.gerarLink({ tipo: "perfil", id: PERFIL })).ok).toBe(false);
    expect((await s.gerarLink({ tipo: "item", id: "x" })).ok).toBe(false);
    expect((await s.gerarLink(null)).ok).toBe(false);
    expect(b.gerarLink).not.toHaveBeenCalled();
  });

  it.each([
    ["P0412", "SEM_WHATSAPP"],
    ["P0403", "AUTOINDICACAO"],
    ["P0002", "INDISPONIVEL"],
    ["42501", "NAO_AUTENTICADO"],
    ["22023", "VALIDACAO"],
  ])("erro %s -> %s, sem texto do banco", async (code, esperado) => {
    const r = await servico(fake({ gerarLink: erroDb(code) })).gerarLink({
      tipo: "item",
      id: ITEM,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe(esperado);
    expect(r.erro.mensagem).not.toContain("texto interno");
  });

  it("código inesperado do banco ou exceção viram erro interno", async () => {
    const r1 = await servico(
      fake({ gerarLink: ok([{ o_codigo: "ruim", o_novo: true }]) }),
    ).gerarLink({
      tipo: "item",
      id: ITEM,
    });
    expect(!r1.ok && r1.erro.codigo).toBe("ERRO_INTERNO");
    const r2 = await servico(
      fake({
        gerarLink: async () => {
          throw new Error("boom");
        },
      }),
    ).gerarLink({ tipo: "item", id: ITEM });
    expect(!r2.ok && r2.erro.codigo).toBe("ERRO_INTERNO");
  });
});

describe("registrarCompartilhamento (IM-024, IM-025)", () => {
  it("aceita whatsapp, copiar e outro", async () => {
    for (const canal of ["whatsapp", "copiar", "outro"]) {
      const b = fake();
      const r = await servico(b).registrarCompartilhamento({ codigo: CODIGO, canal });
      expect(r.ok).toBe(true);
      expect(b.registrarCompartilhamento).toHaveBeenCalledWith({ codigo: CODIGO, canal });
    }
  });

  it("canal ou código inválido não chega ao banco", async () => {
    const b = fake();
    const s = servico(b);
    expect((await s.registrarCompartilhamento({ codigo: CODIGO, canal: "sms" })).ok).toBe(false);
    expect((await s.registrarCompartilhamento({ codigo: "abc", canal: "copiar" })).ok).toBe(false);
    expect(b.registrarCompartilhamento).not.toHaveBeenCalled();
  });

  it("mapeia P0429, P0002 e 42501", async () => {
    const quando = async (code: string) => {
      const r = await servico(
        fake({ registrarCompartilhamento: erroSimples(code) }),
      ).registrarCompartilhamento({
        codigo: CODIGO,
        canal: "copiar",
      });
      return !r.ok && r.erro.codigo;
    };
    expect(await quando("P0429")).toBe("LIMITE");
    expect(await quando("P0002")).toBe("NAO_ENCONTRADO");
    expect(await quando("42501")).toBe("NAO_AUTENTICADO");
  });
});

const contato = {
  perfilId: PERFIL,
  nome: "Maria Souza",
  whatsapp: "(51) 99999-9999",
  email: "maria@exemplo.com",
  mensagem: "Quero um orçamento, meu CPF é 000.000.000-00",
  chave: CHAVE,
  codigo: CODIGO,
  nomeDestino: "Padaria do Zé",
};

describe("enviarContato (IM-026, IM-028)", () => {
  it("normaliza o WhatsApp antes do RPC e repassa os campos", async () => {
    const b = fake();
    const r = await servico(b).enviarContato(contato);
    expect(r.ok).toBe(true);
    expect(b.enviarContato).toHaveBeenCalledWith({
      perfilId: PERFIL,
      itemId: null,
      nome: "Maria Souza",
      whatsapp: "+5551999999999",
      chave: CHAVE,
      email: "maria@exemplo.com",
      mensagem: contato.mensagem,
      codigo: CODIGO,
    });
  });

  it("URL do WhatsApp do responsável: número sem +, texto curto sem dados privados do visitante", async () => {
    const r = await servico().enviarContato(contato);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.pedidoId).toBe(PEDIDO);
    expect(r.valor.repetido).toBe(false);
    const url = new URL(r.valor.urlWhatsappResponsavel);
    expect(url.origin + url.pathname).toBe("https://wa.me/5511988887777");
    const texto = url.searchParams.get("text")!;
    expect(texto).toContain("Padaria do Zé");
    expect(texto).toContain("Maria Souza");
    // IM-026/IM-029/IM-041: nada além do nome digitado.
    expect(texto).not.toContain("maria@exemplo.com");
    expect(texto).not.toContain("51999999999");
    expect(texto).not.toContain("99999");
    expect(texto).not.toContain("CPF");
    expect(texto).not.toContain(CODIGO);
    expect(texto.length).toBeLessThan(200);
    expect(r.valor.urlWhatsappResponsavel).not.toContain("+");
  });

  it("sem nome do destino a mensagem continua educada", async () => {
    const r = await servico().enviarContato({ ...contato, nomeDestino: undefined });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texto = new URL(r.valor.urlWhatsappResponsavel).searchParams.get("text")!;
    expect(texto).toContain("IndicaMais");
    expect(texto).toContain("Maria Souza");
  });

  it("nome do destino hostil não injeta parâmetros na URL", async () => {
    const r = await servico().enviarContato({ ...contato, nomeDestino: "Loja&phone=1#x?y" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.valor.urlWhatsappResponsavel);
    expect([...u.searchParams.keys()]).toEqual(["text"]);
    expect(u.hash).toBe("");
  });

  it("reenvio com a MESMA chave devolve o mesmo pedido, marcado como repetido, sem criar outro", async () => {
    let chamadas = 0;
    const chaves: string[] = [];
    const b = fake({
      enviarContato: async (a) => {
        chaves.push(a.chave);
        chamadas++;
        return {
          dados: [
            {
              o_pedido_id: PEDIDO,
              o_whatsapp_responsavel: "+5511988887777",
              o_repetido: chamadas > 1,
            },
          ],
          erro: null,
        };
      },
    });
    const s = servico(b);
    const a = await s.enviarContato(contato);
    const c = await s.enviarContato(contato);
    expect(a.ok && c.ok).toBe(true);
    if (!a.ok || !c.ok) return;
    expect(a.valor.pedidoId).toBe(c.valor.pedidoId);
    expect(a.valor.repetido).toBe(false);
    expect(c.valor.repetido).toBe(true);
    // A chave enviada ao banco é idêntica nas duas chamadas.
    expect(new Set(chaves).size).toBe(1);
  });

  it("chave reutilizada em outro destino (23505) vira conflito tipado", async () => {
    const r = await servico(fake({ enviarContato: erroDb("23505") })).enviarContato(contato);
    expect(!r.ok && r.erro.codigo).toBe("CONFLITO_CHAVE");
  });

  it.each([
    ["P0002", "INDISPONIVEL"],
    ["P0429", "LIMITE"],
    ["22023", "VALIDACAO"],
    ["23505", "CONFLITO_CHAVE"],
  ])("erro %s -> %s", async (code, esperado) => {
    const r = await servico(fake({ enviarContato: erroDb(code) })).enviarContato(contato);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe(esperado);
    expect(r.erro.mensagem).not.toContain("texto interno");
  });

  it("entrada inválida (WhatsApp, nome, destino, chave) não chega ao banco e aponta o campo", async () => {
    const b = fake();
    const s = servico(b);
    const r1 = await s.enviarContato({ ...contato, whatsapp: "abc" });
    expect(!r1.ok && r1.erro.codigo).toBe("VALIDACAO");
    expect(!r1.ok && r1.erro.campos).toHaveProperty("whatsapp");
    expect((await s.enviarContato({ ...contato, nome: "A" })).ok).toBe(false);
    expect((await s.enviarContato({ ...contato, itemId: ITEM })).ok).toBe(false);
    expect((await s.enviarContato({ ...contato, chave: "curta" })).ok).toBe(false);
    expect((await s.enviarContato(undefined)).ok).toBe(false);
    expect(b.enviarContato).not.toHaveBeenCalled();
  });

  it("código de link inválido segue sem atribuição (codigo null), sem prejudicar o visitante", async () => {
    const b = fake();
    await servico(b).enviarContato({ ...contato, codigo: "lixo" });
    expect(vi.mocked(b.enviarContato).mock.calls[0]![0].codigo).toBeNull();
  });

  it("número do responsável fora do padrão: erro interno, sem URL", async () => {
    const b = fake({
      enviarContato: ok([
        { o_pedido_id: PEDIDO, o_whatsapp_responsavel: "5511", o_repetido: false },
      ]),
    });
    const r = await servico(b).enviarContato(contato);
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
  });

  it("novaChaveContato gera chaves válidas e distintas", async () => {
    const a = novaChaveContato();
    const c = novaChaveContato();
    expect(a).not.toBe(c);
    const r = await servico().enviarContato({ ...contato, chave: a });
    expect(r.ok).toBe(true);
  });
});

describe("leituras (IM-027, IM-029)", () => {
  const pedido: LinhaMeuPedido = {
    id: PEDIDO,
    destino_tipo: "perfil",
    destino_id: PERFIL,
    destino_nome: "Padaria do Zé",
    nome: "Maria Souza",
    whatsapp_e164: "+5551999999999",
    email: "maria@exemplo.com",
    mensagem: "Oi",
    criado_em: "2026-10-29T10:00:00Z",
    veio_por_indicacao: true,
    notificacao_estado: "falhou",
  };

  it("listarMeusPedidos entrega dados do visitante ao responsável, do mais recente ao mais antigo", async () => {
    const b = fake({
      listarMeusPedidos: ok([
        pedido,
        {
          ...pedido,
          id: "44444444-4444-4444-8444-444444444444",
          criado_em: "2026-10-30T10:00:00Z",
        },
        { ...pedido, id: null },
      ]),
    });
    const r = await servico(b).listarMeusPedidos();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toHaveLength(2);
    expect(r.valor[0]!.criadoEm).toBe("2026-10-30T10:00:00Z");
    expect(r.valor[1]).toMatchObject({
      visitanteNome: "Maria Souza",
      visitanteWhatsapp: "+5551999999999",
      veioPorIndicacao: true,
      notificacaoEstado: "falhou",
    });
  });

  it("listarMinhasIndicacoes: chaves EXATAS, sem nada do visitante (IM-029)", async () => {
    // A linha pode, por engano do adaptador, trazer colunas a mais: o modelo copia campo a campo.
    const linhaSuja = {
      id: PEDIDO,
      destino_tipo: "perfil",
      destino_id: PERFIL,
      destino_nome: "Padaria do Zé",
      criado_em: "2026-10-29T10:00:00Z",
      status: "recebido",
      nome: "Maria Souza",
      whatsapp_e164: "+5551999999999",
      email: "maria@exemplo.com",
      mensagem: "Oi",
    } as unknown as LinhaMinhaIndicacao;
    const r = await servico(
      fake({ listarMinhasIndicacoes: ok([linhaSuja]) }),
    ).listarMinhasIndicacoes();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const item = r.valor[0]!;
    expect(Object.keys(item).sort()).toEqual(
      ["criadoEm", "destinoId", "destinoNome", "destinoTipo", "id", "status"].sort(),
    );
    const exato = {
      id: PEDIDO,
      destinoTipo: "perfil",
      destinoId: PERFIL,
      destinoNome: "Padaria do Zé",
      criadoEm: "2026-10-29T10:00:00Z",
      status: "recebido",
    } satisfies MinhaIndicacao;
    expect(item).toEqual(exato);
    expect(JSON.stringify(item)).not.toMatch(/Maria|99999|maria@|"nome"|"email"|"mensagem"/);
  });

  it("tipo MinhaIndicacao não aceita campos do visitante", () => {
    const ruim = {
      id: "x",
      destinoTipo: "perfil",
      destinoId: "y",
      destinoNome: "n",
      criadoEm: "d",
      status: "recebido",
      // @ts-expect-error campo do visitante não existe no tipo do indicador (IM-029)
      visitanteNome: "Maria",
    } satisfies MinhaIndicacao;
    expect(ruim).toBeDefined();
  });

  it("listarMeusLinks", async () => {
    const link: LinhaMeuLink = {
      id: PEDIDO,
      codigo: CODIGO,
      destino_tipo: "item",
      destino_id: ITEM,
      destino_nome: "Bolo",
      disponivel: false,
      criado_em: "2026-10-29T10:00:00Z",
    };
    const r = await servico(fake({ listarMeusLinks: ok([link]) })).listarMeusLinks();
    expect(r.ok && r.valor[0]).toMatchObject({
      codigo: CODIGO,
      disponivel: false,
      destinoTipo: "item",
    });
  });

  it("erro de leitura vira erro tipado sem texto do banco", async () => {
    const r = await servico(fake({ listarMeusPedidos: erroDb("42501") })).listarMeusPedidos();
    expect(!r.ok && r.erro.codigo).toBe("PERMISSAO");
    expect(!r.ok && r.erro.mensagem).not.toContain("texto interno");
  });

  const fila = (extra: Partial<LinhaFilaContato> = {}): LinhaFilaContato => ({
    ...pedido,
    autoindicacao_suspeita: true,
    notificacao_estado: "falhou",
    tentativas: 1,
    ultima_tentativa_em: "2026-10-29T10:01:00Z",
    ultimo_erro: "provedor de e-mail não configurado",
    reenvio_solicitado_em: null,
    alerta_estado: "aberto",
    ...extra,
  });

  it("filaContatosAdmin: todos e só alertas abertos", async () => {
    const b = fake({
      listarFilaContatos: ok([
        fila(),
        fila({ id: "55555555-5555-4555-8555-555555555555", alerta_estado: "tratado" }),
        fila({ id: "66666666-6666-4666-8666-666666666666", alerta_estado: "nenhum" }),
      ]),
    });
    const todos = await servico(b).filaContatosAdmin();
    expect(todos.ok && todos.valor).toHaveLength(3);
    const abertos = await servico(b).filaContatosAdmin({ somenteAlertasAbertos: true });
    expect(abertos.ok && abertos.valor).toHaveLength(1);
    expect(abertos.ok && abertos.valor[0]).toMatchObject({
      alertaEstado: "aberto",
      autoindicacaoSuspeita: true,
      tentativas: 1,
    });
  });
});

describe("reenvio e alerta (IM-028)", () => {
  it("responsável solicita reenvio sem motivo; o banco recebe motivo nulo", async () => {
    const b = fake();
    const r = await servico(b).solicitarReenvio({ pedidoId: PEDIDO });
    expect(r.ok).toBe(true);
    expect(b.solicitarReenvio).toHaveBeenCalledWith({ pedidoId: PEDIDO, motivo: null });
  });

  it("pedido inválido não chega ao banco", async () => {
    const b = fake();
    expect((await servico(b).solicitarReenvio({ pedidoId: "x" })).ok).toBe(false);
    expect(b.solicitarReenvio).not.toHaveBeenCalled();
  });

  it("administrador força reenvio: motivo obrigatório", async () => {
    const b = fake();
    const s = servico(b);
    expect((await s.reenviarComoAdmin({ pedidoId: PEDIDO })).ok).toBe(false);
    expect((await s.reenviarComoAdmin({ pedidoId: PEDIDO, motivo: "   " })).ok).toBe(false);
    expect(b.solicitarReenvio).not.toHaveBeenCalled();
    const r = await s.reenviarComoAdmin({
      pedidoId: PEDIDO,
      motivo: " Responsável corrigiu e-mail ",
    });
    expect(r.ok).toBe(true);
    expect(b.solicitarReenvio).toHaveBeenCalledWith({
      pedidoId: PEDIDO,
      motivo: "Responsável corrigiu e-mail",
    });
  });

  it("reenvio fora de falha (P0001) e de outro responsável (P0002) são tipados", async () => {
    const r1 = await servico(fake({ solicitarReenvio: erroSimples("P0001") })).solicitarReenvio({
      pedidoId: PEDIDO,
    });
    expect(!r1.ok && r1.erro.codigo).toBe("ESTADO_INVALIDO");
    const r2 = await servico(fake({ solicitarReenvio: erroSimples("P0002") })).solicitarReenvio({
      pedidoId: PEDIDO,
    });
    expect(!r2.ok && r2.erro.codigo).toBe("NAO_ENCONTRADO");
  });

  it("tratarAlerta exige motivo e mapeia permissão e ausência de alerta", async () => {
    const b = fake();
    expect((await servico(b).tratarAlerta({ pedidoId: PEDIDO })).ok).toBe(false);
    expect((await servico(b).tratarAlerta({ pedidoId: PEDIDO, motivo: "" })).ok).toBe(false);
    expect((await servico(b).tratarAlerta({ pedidoId: PEDIDO, motivo: "x".repeat(501) })).ok).toBe(
      false,
    );
    expect(b.tratarAlerta).not.toHaveBeenCalled();
    expect(
      (await servico(b).tratarAlerta({ pedidoId: PEDIDO, motivo: "Contato por telefone" })).ok,
    ).toBe(true);
    const sem = await servico(fake({ tratarAlerta: erroSimples("42501") })).tratarAlerta({
      pedidoId: PEDIDO,
      motivo: "m",
    });
    expect(!sem.ok && sem.erro.codigo).toBe("PERMISSAO");
    const nenhum = await servico(fake({ tratarAlerta: erroSimples("P0001") })).tratarAlerta({
      pedidoId: PEDIDO,
      motivo: "m",
    });
    expect(!nenhum.ok && nenhum.erro.codigo).toBe("ESTADO_INVALIDO");
  });
});

describe("parâmetros (administrador)", () => {
  const param = (extra: Partial<LinhaParametro> = {}): LinhaParametro => ({
    chave: "contato_janela_repeticao_minutos",
    valor: 10,
    minimo: 1,
    maximo: 1440,
    descricao: "janela",
    atualizado_em: "2026-10-29T10:00:00Z",
    ...extra,
  });

  it("lista ordenada por chave", async () => {
    const b = fake({
      listarParametros: ok([param({ chave: "z_param" }), param({ chave: "a_param" })]),
    });
    const r = await servico(b).listarParametros();
    expect(r.ok && r.valor.map((p) => p.chave)).toEqual(["a_param", "z_param"]);
  });

  it("não administrador recebe lista vazia e não consegue definir (permissão)", async () => {
    const b = fake({ listarParametros: ok([]) });
    const l = await servico(b).listarParametros();
    expect(l.ok && l.valor).toEqual([]);
    const r = await servico(b).definirParametro({
      chave: "contato_janela_repeticao_minutos",
      valor: 5,
      motivo: "teste",
    });
    expect(!r.ok && r.erro.codigo).toBe("PERMISSAO");
    expect(b.definirParametro).not.toHaveBeenCalled();
  });

  it("valida faixa do parâmetro, inteiro e motivo antes de chamar o banco", async () => {
    const b = fake({ listarParametros: ok([param()]) });
    const s = servico(b);
    const chave = "contato_janela_repeticao_minutos";
    expect((await s.definirParametro({ chave, valor: 0, motivo: "m" })).ok).toBe(false);
    expect((await s.definirParametro({ chave, valor: 1441, motivo: "m" })).ok).toBe(false);
    expect((await s.definirParametro({ chave, valor: 2.5, motivo: "m" })).ok).toBe(false);
    expect((await s.definirParametro({ chave, valor: "5", motivo: "m" })).ok).toBe(false);
    expect((await s.definirParametro({ chave, valor: 5 })).ok).toBe(false);
    expect((await s.definirParametro({ chave: "DROP TABLE", valor: 5, motivo: "m" })).ok).toBe(
      false,
    );
    expect(b.definirParametro).not.toHaveBeenCalled();
    const ok1 = await s.definirParametro({ chave, valor: 1, motivo: "mínimo" });
    const ok2 = await s.definirParametro({ chave, valor: 1440, motivo: "máximo" });
    expect(ok1.ok && ok2.ok).toBe(true);
    expect(b.definirParametro).toHaveBeenCalledTimes(2);
  });

  it("chave desconhecida para administrador: não encontrado", async () => {
    const b = fake({ listarParametros: ok([param()]) });
    const r = await servico(b).definirParametro({ chave: "inexistente", valor: 5, motivo: "m" });
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
  });
});
