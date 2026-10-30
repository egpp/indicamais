import { describe, expect, it, vi } from "vitest";
import {
  criarServicoNotificacoes,
  MENSAGENS_NOTIFICACOES,
  TIPOS_AVISO,
  textoDoAviso,
  type ClienteBancoNotificacoesApp,
  type LinhaAviso,
  type LinhaMinhaIndicacaoAba,
  type LinhaQuemMeIndicou,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
// id determinístico de curtida (md5): não respeita os bits de versão do RFC 4122
const ID_MD5 = "d41d8cd9-8f00-b204-e980-0998ecf8427e";

const ok =
  <T>(dados: T) =>
  async () => ({ dados, erro: null });
const comErro = (code: string) => async () => ({
  dados: null,
  erro: { code, message: "texto interno do banco: segredo" },
});

function fake(sobrescrever: Partial<ClienteBancoNotificacoesApp> = {}) {
  const banco = {
    listarMeusAvisos: vi.fn(ok<LinhaAviso[]>([])),
    contarNaoLidas: vi.fn(ok(0)),
    marcarLida: vi.fn(ok(true)),
    marcarTodasLidas: vi.fn(ok(0)),
    listarQuemMeIndicou: vi.fn(ok<LinhaQuemMeIndicou[]>([])),
    listarMinhasIndicacoes: vi.fn(ok<LinhaMinhaIndicacaoAba[]>([])),
    ...sobrescrever,
  };
  return { banco, servico: criarServicoNotificacoes(banco as ClienteBancoNotificacoesApp) };
}

const aviso = (o: Partial<LinhaAviso> = {}): LinhaAviso => ({
  origem: "curtida",
  origem_id: ID_MD5,
  tipo: "curtida",
  destino_tipo: "perfil",
  destino_id: ID,
  destino_nome: "Padaria Boa",
  ator_nome: "Maria S.",
  criado_em: "2026-10-30T10:00:00Z",
  lida: false,
  lida_em: null,
  ...o,
});

describe("avisos (IM-047, IM-051, IM-052)", () => {
  it("lista avisos mais recentes primeiro com texto em pt-BR e destino para abrir", async () => {
    const { servico } = fake({
      listarMeusAvisos: ok([
        aviso({ origem_id: ID, criado_em: "2026-10-01T00:00:00Z" }),
        aviso({ criado_em: "2026-10-29T00:00:00Z" }),
      ]),
    });
    const r = await servico.meusAvisos();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.map((a) => a.origemId)).toEqual([ID_MD5, ID]);
      expect(r.valor[0]).toMatchObject({
        titulo: "Nova curtida",
        texto: "Maria S. curtiu Padaria Boa.",
        destino: { tipo: "perfil", id: ID, nome: "Padaria Boa" },
        lida: false,
      });
    }
  });

  it("descarta tipos desconhecidos (por exemplo, qualquer 'link gerado' ou 'compartilhado')", async () => {
    const { servico } = fake({
      listarMeusAvisos: ok([
        aviso({ tipo: "link_compartilhado" }),
        aviso({ tipo: "link_gerado", origem_id: ID }),
        aviso({ origem: "outra" }),
        aviso({ tipo: null }),
      ]),
    });
    const r = await servico.meusAvisos();
    expect(r.ok && r.valor).toEqual([]);
  });

  it("nenhum texto de aviso afirma compartilhamento externo", () => {
    const proibidos = /compartilh|divulg|whatsapp|enviou o link|postou|publicou/i;
    for (const tipo of TIPOS_AVISO) {
      for (const ator of ["Maria S.", null]) {
        const { titulo, texto } = textoDoAviso(tipo, "Padaria Boa", ator);
        expect(titulo).not.toMatch(proibidos);
        expect(texto).not.toMatch(proibidos);
      }
    }
  });

  it("sem ator, o texto usa 'Uma pessoa' e nunca expõe dado pessoal", () => {
    const { texto } = textoDoAviso("contato_valido", "Padaria Boa", null);
    expect(texto).toContain("Uma pessoa");
    expect(texto).not.toMatch(/@|\+55|\d{8}/);
  });

  it("o modelo do aviso não traz conta_id nem dado do visitante, mesmo se a linha trouxer", async () => {
    const suja = {
      ...aviso(),
      conta_id: "conta-secreta",
      visitante_nome: "João Completo da Silva",
      whatsapp_e164: "+5511999999999",
    } as LinhaAviso;
    const { servico } = fake({ listarMeusAvisos: ok([suja]) });
    const r = await servico.meusAvisos();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.valor[0]!).sort()).toEqual(
        [
          "atorNome",
          "criadoEm",
          "destino",
          "lida",
          "lidaEm",
          "origem",
          "origemId",
          "texto",
          "tipo",
          "titulo",
        ].sort(),
      );
      const texto = JSON.stringify(r.valor);
      for (const x of ["conta-secreta", "João Completo", "+5511"]) expect(texto).not.toContain(x);
    }
  });

  it("sem login a lista devolve erro neutro", async () => {
    const { servico } = fake({ listarMeusAvisos: comErro("42501") });
    const r = await servico.meusAvisos();
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "NAO_AUTENTICADO", mensagem: MENSAGENS_NOTIFICACOES.semLogin },
    });
  });
});

describe("contador e leitura (IM-052)", () => {
  it("contador devolve o número de não lidas; nulo ou negativo vira zero", async () => {
    expect(await fake({ contarNaoLidas: ok(3) }).servico.contarNaoLidas()).toEqual({
      ok: true,
      valor: 3,
    });
    expect(await fake({ contarNaoLidas: ok(-1) }).servico.contarNaoLidas()).toEqual({
      ok: true,
      valor: 0,
    });
  });

  it("marcar como lida valida a chave e aceita o id de curtida (md5)", async () => {
    const { banco, servico } = fake();
    const r = await servico.marcarLida({ origem: "curtida", origemId: ID_MD5 });
    expect(r).toEqual({ ok: true, valor: { alterou: true } });
    expect(banco.marcarLida).toHaveBeenCalledWith({ origem: "curtida", origemId: ID_MD5 });
  });

  it("marcar de novo é idempotente (alterou: false)", async () => {
    const { servico } = fake({ marcarLida: ok(false) });
    expect(await servico.marcarLida({ origem: "curtida", origemId: ID })).toEqual({
      ok: true,
      valor: { alterou: false },
    });
  });

  it("entrada inválida não chega ao banco", async () => {
    const { banco, servico } = fake();
    for (const e of [
      null,
      {},
      { origem: "link_compartilhado", origemId: ID },
      { origem: "curtida", origemId: "abc" },
    ]) {
      const r = await servico.marcarLida(e);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("VALIDACAO");
    }
    expect(banco.marcarLida).not.toHaveBeenCalled();
  });

  it("aviso alheio ou inexistente (P0002) responde com mensagem neutra, sem texto do banco", async () => {
    const { servico } = fake({ marcarLida: comErro("P0002") });
    const r = await servico.marcarLida({ origem: "contato_valido", origemId: ID });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "NAO_ENCONTRADO", mensagem: MENSAGENS_NOTIFICACOES.avisoNaoEncontrado },
    });
    expect(JSON.stringify(r)).not.toContain("segredo");
  });

  it("sem login, marcar uma ou todas falha com mensagem neutra", async () => {
    const a = fake({ marcarLida: comErro("42501"), marcarTodasLidas: comErro("42501") });
    const r1 = await a.servico.marcarLida({ origem: "curtida", origemId: ID });
    const r2 = await a.servico.marcarTodasLidas();
    for (const r of [r1, r2]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro.codigo).toBe("NAO_AUTENTICADO");
    }
  });

  it("marcar todas devolve quantas mudaram", async () => {
    const { servico } = fake({ marcarTodasLidas: ok(4) });
    expect(await servico.marcarTodasLidas()).toEqual({ ok: true, valor: { marcadas: 4 } });
  });

  it("exceção do banco vira erro genérico", async () => {
    const { servico } = fake({
      contarNaoLidas: async () => {
        throw new Error("segredo");
      },
    });
    const r = await servico.contarNaoLidas();
    expect(r).toEqual({
      ok: false,
      erro: { codigo: "ERRO_INTERNO", mensagem: MENSAGENS_NOTIFICACOES.generica },
    });
  });
});

describe("abas (IM-048, IM-049, IM-050, IM-029)", () => {
  const quem = (o: Partial<LinhaQuemMeIndicou> = {}): LinhaQuemMeIndicou => ({
    id: ID,
    destino_tipo: "item",
    destino_id: ID,
    destino_nome: "Bolo de pote",
    perfil_destino_id: ID,
    perfil_destino_nome: "Padaria Boa",
    indicador_nome: "Maria S.",
    indicador_ref: "ref-opaca",
    indicador_saiu_da_base: false,
    criado_em: "2026-10-30T10:00:00Z",
    ...o,
  });

  it("'Quem me indicou' traz total, destino, perfil e indicador só pelo nome público", async () => {
    const { servico } = fake({ listarQuemMeIndicou: ok([quem()]) });
    const r = await servico.quemMeIndicou();
    expect(r.ok && r.valor.total).toBe(1);
    expect(r.ok && r.valor.itens[0]).toMatchObject({
      destinoNome: "Bolo de pote",
      perfilDestinoNome: "Padaria Boa",
      indicadorNome: "Maria S.",
    });
  });

  it("quem saiu da base não aparece pelo nome nem pela referência", async () => {
    const { servico } = fake({
      listarQuemMeIndicou: ok([quem({ indicador_saiu_da_base: true })]),
    });
    const r = await servico.quemMeIndicou();
    expect(r.ok && r.valor.itens[0]).toMatchObject({
      indicadorNome: null,
      indicadorRef: null,
      indicadorSaiuDaBase: true,
    });
  });

  it("'Quem me indicou' não expõe dado privado", async () => {
    const suja = {
      ...quem(),
      conta_id: "conta-secreta",
      email: "x@y.com",
      whatsapp_e164: "+5511999999999",
    } as LinhaQuemMeIndicou;
    const { servico } = fake({ listarQuemMeIndicou: ok([suja]) });
    const r = await servico.quemMeIndicou();
    const texto = JSON.stringify(r);
    for (const x of ["conta-secreta", "x@y.com", "+5511"]) expect(texto).not.toContain(x);
    expect(r.ok && Object.keys(r.valor.itens[0]!).sort()).toEqual(
      [
        "criadoEm",
        "destinoId",
        "destinoNome",
        "destinoTipo",
        "id",
        "indicadorNome",
        "indicadorRef",
        "indicadorSaiuDaBase",
        "perfilDestinoId",
        "perfilDestinoNome",
      ].sort(),
    );
  });

  it("'Minhas indicações' traz contagem, histórico e nada do visitante", async () => {
    const suja = {
      id: ID,
      destino_tipo: "perfil",
      destino_id: ID,
      destino_nome: "Padaria Boa",
      criado_em: "2026-10-30T10:00:00Z",
      status: "recebido",
      nome: "João Visitante",
      whatsapp_e164: "+5511999999999",
    } as LinhaMinhaIndicacaoAba;
    const { servico } = fake({
      listarMinhasIndicacoes: ok([
        suja,
        { ...suja, id: "22222222-2222-4222-8222-222222222222", criado_em: "2026-10-31T10:00:00Z" },
      ]),
    });
    const r = await servico.minhasIndicacoes();
    expect(r.ok && r.valor.total).toBe(2);
    expect(r.ok && r.valor.itens[0]!.criadoEm).toBe("2026-10-31T10:00:00Z");
    expect(r.ok && Object.keys(r.valor.itens[0]!).sort()).toEqual(
      ["criadoEm", "destinoId", "destinoNome", "destinoTipo", "id", "status"].sort(),
    );
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("João Visitante");
    expect(texto).not.toContain("+5511");
  });

  it("aba vazia tem total zero; sem login falha com mensagem neutra", async () => {
    const a = await fake().servico.minhasIndicacoes();
    expect(a).toEqual({ ok: true, valor: { total: 0, itens: [] } });
    const b = await fake({ listarMinhasIndicacoes: comErro("42501") }).servico.minhasIndicacoes();
    expect(b.ok).toBe(false);
  });
});
