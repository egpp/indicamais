import { describe, expect, it, vi } from "vitest";
import {
  criarPatrocinadorSchema,
  criarServicoPatrocinadores,
  mapearErroBancoPatrocinador,
  montarCarrossel,
  situacaoDoPatrocinador,
  type ClienteBancoPatrocinadores,
  type LinhaPatrocinadorAdmin,
  type LinhaPatrocinadorPublico,
} from "./index";

const ID = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";
const ARQ = "33333333-3333-4333-8333-333333333333";
const PERFIL = "99999999-9999-4999-8999-999999999999";
const IMG = `patrocinador/${ID}/${ARQ}.png`;

const valido = {
  id: ID,
  titulo: "Padaria do Zé",
  imagemPath: IMG,
  textoDestino: "Pão quentinho toda manhã",
  motivo: "Campanha de novembro",
};

const pub = (p: Partial<LinhaPatrocinadorPublico> & Record<string, unknown> = {}) =>
  ({
    id: ID,
    identificacao: "Patrocinado",
    titulo: "Padaria do Zé",
    imagem_path: IMG,
    destino_tipo: "texto",
    destino_perfil_id: null,
    destino_perfil_slug: null,
    destino_texto: "Pão quentinho",
    ordem: 0,
    ...p,
  }) as LinhaPatrocinadorPublico;

function fake(over: Partial<ClienteBancoPatrocinadores> = {}) {
  const banco = {
    listarPublicos: vi.fn(async () => ({ dados: [pub()], erro: null })),
    ehAdministrador: vi.fn(async () => true),
    listarTodos: vi.fn(async () => ({ dados: [] as LinhaPatrocinadorAdmin[], erro: null })),
    criar: vi.fn(async () => ({ id: ID as string | null, erro: null })),
    alterar: vi.fn(async () => ({ erro: null })),
    definirAtivo: vi.fn(async () => ({ erro: null })),
    ...over,
  } satisfies ClienteBancoPatrocinadores;
  return banco;
}

/** Cópia do objeto sem as chaves informadas. */
const sem = <T extends Record<string, unknown>>(o: T, ...chaves: string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !chaves.includes(k)));

describe("patrocinadores: leitura pública (IM-020, IM-079)", () => {
  it("devolve o modelo público com identificação 'Patrocinado' e destino texto", async () => {
    const r = await criarServicoPatrocinadores(fake()).listarPatrocinadoresPublicos();
    expect(r).toEqual({
      ok: true,
      valor: [
        {
          id: ID,
          identificacao: "Patrocinado",
          titulo: "Padaria do Zé",
          imagemPath: IMG,
          destino: { tipo: "texto", texto: "Pão quentinho" },
          ordem: 0,
        },
      ],
    });
  });

  it("identificação é sempre 'Patrocinado', mesmo se a linha trouxer outra coisa", () => {
    const [p] = montarCarrossel([pub({ identificacao: "Anúncio premium" })]);
    expect(p?.identificacao).toBe("Patrocinado");
  });

  it("destino perfil vira link interno /perfil/<slug>, sem id do perfil", () => {
    const [p] = montarCarrossel([
      pub({
        destino_tipo: "perfil",
        destino_perfil_id: PERFIL,
        destino_perfil_slug: "studio-ana",
        destino_texto: null,
      }),
    ]);
    expect(p?.destino).toEqual({ tipo: "perfil", slug: "studio-ana", link: "/perfil/studio-ana" });
    expect(JSON.stringify(p)).not.toContain(PERFIL);
  });

  it("ordena por `ordem` e limita a 20", () => {
    const linhas = Array.from({ length: 25 }, (_, i) =>
      pub({ id: `id-${i}`, ordem: 25 - i, titulo: `T${i}` }),
    );
    const r = montarCarrossel(linhas);
    expect(r).toHaveLength(20);
    expect(r.map((p) => p.ordem)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("linhas inutilizáveis somem: sem título, sem imagem, perfil sem slug, tipo desconhecido", () => {
    const r = montarCarrossel([
      pub({ titulo: " " }),
      pub({ imagem_path: null }),
      pub({ destino_tipo: "perfil", destino_perfil_slug: null }),
      pub({ destino_tipo: "url", destino_texto: "x" }),
      pub({ destino_tipo: null }),
      pub({ id: OUTRO }),
    ]);
    expect(r.map((p) => p.id)).toEqual([OUTRO]);
  });

  it("texto de destino que pareça link externo nunca é exibido (defesa em profundidade)", () => {
    for (const t of ["https://x.com", "www.site.com.br", "loja.com", "//evil", "@usuario"]) {
      expect(montarCarrossel([pub({ destino_texto: t })])).toEqual([]);
    }
  });

  it("colunas extras (owner, conta) na linha não saem", async () => {
    const f = fake({
      listarPublicos: async () => ({
        dados: [pub({ conta_id: "conta-secreta", criado_por: "adm-1", valor_pago: 900 })],
        erro: null,
      }),
    });
    const r = await criarServicoPatrocinadores(f).listarPatrocinadoresPublicos();
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/conta-secreta|adm-1|valor_pago|900/);
    expect(Object.keys(r.ok ? r.valor[0]! : {}).sort()).toEqual([
      "destino",
      "id",
      "identificacao",
      "imagemPath",
      "ordem",
      "titulo",
    ]);
  });

  it("não exige administrador e não consulta a checagem de papel", async () => {
    const f = fake();
    await criarServicoPatrocinadores(f).listarPatrocinadoresPublicos();
    expect(f.ehAdministrador).not.toHaveBeenCalled();
  });

  it("erro do banco vira mensagem genérica, sem texto interno", async () => {
    const f = fake({
      listarPublicos: async () => ({
        dados: null,
        erro: { code: "42P01", message: 'relation "x" does not exist' },
      }),
    });
    const r = await criarServicoPatrocinadores(f).listarPatrocinadoresPublicos();
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("relation");
  });
});

describe("patrocinadores: só administrador escreve (IM-020, IM-086)", () => {
  const acoes: [string, (s: ReturnType<typeof criarServicoPatrocinadores>) => Promise<unknown>][] =
    [
      ["listarPatrocinadoresAdmin", (s) => s.listarPatrocinadoresAdmin()],
      ["criarPatrocinador", (s) => s.criarPatrocinador(valido)],
      ["alterarPatrocinador", (s) => s.alterarPatrocinador(valido)],
      [
        "definirPatrocinadorAtivo",
        (s) => s.definirPatrocinadorAtivo({ id: ID, ativo: true, motivo: "x" }),
      ],
    ];
  const nenhumaEscrita = (f: ClienteBancoPatrocinadores) => {
    for (const k of ["listarTodos", "criar", "alterar", "definirAtivo"] as const) {
      expect(f[k]).not.toHaveBeenCalled();
    }
  };

  it.each(acoes)(
    "%s: não-admin recebe SEM_PERMISSAO e nenhuma função de dados é chamada",
    async (_n, agir) => {
      const f = fake({ ehAdministrador: vi.fn(async () => false) });
      const r = (await agir(criarServicoPatrocinadores(f))) as {
        ok: boolean;
        erro: { codigo: string };
      };
      expect(r.ok).toBe(false);
      expect(r.erro.codigo).toBe("SEM_PERMISSAO");
      nenhumaEscrita(f);
    },
  );

  it.each(acoes)("%s: sem a checagem de papel, falha fechado", async (_n, agir) => {
    const f = fake();
    delete (f as ClienteBancoPatrocinadores).ehAdministrador;
    const r = (await agir(criarServicoPatrocinadores(f))) as { erro: { codigo: string } };
    expect(r.erro.codigo).toBe("SEM_PERMISSAO");
    nenhumaEscrita(f);
  });

  it.each(acoes)("%s: erro ao checar o papel = não é admin", async (_n, agir) => {
    const f = fake({
      ehAdministrador: vi.fn(async () => {
        throw new Error("rede");
      }),
    });
    const r = (await agir(criarServicoPatrocinadores(f))) as { erro: { codigo: string } };
    expect(r.erro.codigo).toBe("SEM_PERMISSAO");
    nenhumaEscrita(f);
  });

  it.each(acoes)("%s: papel 'truthy' que não é true não concede", async (_n, agir) => {
    const f = fake({ ehAdministrador: vi.fn(async () => "true" as unknown as boolean) });
    const r = (await agir(criarServicoPatrocinadores(f))) as { erro: { codigo: string } };
    expect(r.erro.codigo).toBe("SEM_PERMISSAO");
    nenhumaEscrita(f);
  });

  it("não-admin com entrada inválida também recebe SEM_PERMISSAO (não revela validação)", async () => {
    const f = fake({ ehAdministrador: vi.fn(async () => false) });
    const r = await criarServicoPatrocinadores(f).criarPatrocinador({});
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
  });
});

describe("patrocinadores: criar", () => {
  it("cria com destino texto e envia os parâmetros p_* certos", async () => {
    const f = fake();
    const r = await criarServicoPatrocinadores(f).criarPatrocinador({
      ...valido,
      ordem: "5",
      ativo: true,
      inicioEm: "2026-11-01T03:00:00.000Z",
      fimEm: "2026-11-30T23:00:00-03:00",
    });
    expect(r).toEqual({ ok: true, valor: { id: ID } });
    expect(f.criar).toHaveBeenCalledWith({
      p_titulo: "Padaria do Zé",
      p_imagem_path: IMG,
      p_perfil_destino_id: null,
      p_texto_destino: "Pão quentinho toda manhã",
      p_ordem: 5,
      p_ativo: true,
      p_inicio_em: "2026-11-01T03:00:00.000Z",
      p_fim_em: "2026-12-01T02:00:00.000Z",
      p_motivo: "Campanha de novembro",
      p_id: ID,
    });
  });

  it("destino perfil; padrões: ordem 0, inativo, sem período, sem motivo", async () => {
    const f = fake();
    const base = sem(valido, "textoDestino", "motivo");
    await criarServicoPatrocinadores(f).criarPatrocinador({ ...base, perfilDestinoId: PERFIL });
    expect(f.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        p_perfil_destino_id: PERFIL,
        p_texto_destino: null,
        p_ordem: 0,
        p_ativo: false,
        p_inicio_em: null,
        p_fim_em: null,
        p_motivo: null,
      }),
    );
  });

  it("texto com URL, domínio, www ou @usuario é recusado", async () => {
    for (const t of [
      "Visite https://exemplo.com",
      "http://x",
      "www.loja.com.br",
      "acesse loja.com.br",
      "padaria.net",
      "veja //site",
      "siga @padaria",
      "HTTPS://X",
    ]) {
      const f = fake();
      const r = await criarServicoPatrocinadores(f).criarPatrocinador({
        ...valido,
        textoDestino: t,
      });
      expect(r.ok, t).toBe(false);
      expect(!r.ok && r.erro.campos).toHaveProperty("textoDestino");
      expect(f.criar).not.toHaveBeenCalled();
    }
  });

  it("dois destinos (perfil e texto) são recusados; nenhum destino também", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    const dois = await svc.criarPatrocinador({ ...valido, perfilDestinoId: PERFIL });
    expect(!dois.ok && dois.erro.codigo).toBe("VALIDACAO");
    const semTexto = sem(valido, "textoDestino");
    const nenhum = await svc.criarPatrocinador(semTexto);
    expect(nenhum.ok).toBe(false);
    const vazios = await svc.criarPatrocinador({
      ...semTexto,
      textoDestino: "  ",
      perfilDestinoId: "",
    });
    expect(vazios.ok).toBe(false);
    expect(f.criar).not.toHaveBeenCalled();
  });

  it("texto de destino com mais de 200 caracteres é recusado; com 200 passa", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    expect((await svc.criarPatrocinador({ ...valido, textoDestino: "a".repeat(201) })).ok).toBe(
      false,
    );
    expect((await svc.criarPatrocinador({ ...valido, textoDestino: "a".repeat(200) })).ok).toBe(
      true,
    );
  });

  it("título de 1 ou 61 caracteres é recusado; 2 e 60 passam; só espaços é recusado", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    for (const t of ["A", "a".repeat(61), "   ", ""]) {
      const r = await svc.criarPatrocinador({ ...valido, titulo: t });
      expect(!r.ok && r.erro.campos).toHaveProperty("titulo");
    }
    for (const t of ["AB", "a".repeat(60)]) {
      expect((await svc.criarPatrocinador({ ...valido, titulo: t })).ok).toBe(true);
    }
  });

  it("período: fim igual ou antes do início é recusado; fim depois passa; datas inválidas recusadas", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    const ini = "2026-11-01T10:00:00Z";
    for (const fim of [ini, "2026-11-01T09:59:59Z", "2026-10-01T00:00:00Z"]) {
      const r = await svc.criarPatrocinador({ ...valido, inicioEm: ini, fimEm: fim });
      expect(!r.ok && r.erro.campos).toHaveProperty("fimEm");
    }
    expect(
      (await svc.criarPatrocinador({ ...valido, inicioEm: ini, fimEm: "2026-11-01T10:00:01Z" })).ok,
    ).toBe(true);
    for (const x of ["amanhã", "2026-13-40T00:00:00Z", "2026-11-01", "2026-11-01T10:00:00"]) {
      expect((await svc.criarPatrocinador({ ...valido, inicioEm: x })).ok, x).toBe(false);
    }
  });

  it("imagem: só patrocinador/<id do patrocinador>/<uuid>.<jpg|png|webp>", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    const ruins = [
      `patrocinador/${OUTRO}/${ARQ}.png`, // pasta de outro patrocinador
      `item/${ID}/${ARQ}.png`, // pasta de item
      `perfil/${ID}/${ARQ}.png`,
      `patrocinador/${ID}/${ARQ}.gif`,
      `patrocinador/${ID}/${ARQ}.svg`,
      `patrocinador/${ID}/foto.png`, // arquivo não é uuid
      `patrocinador/${ID}/../${OUTRO}/${ARQ}.png`,
      `/patrocinador/${ID}/${ARQ}.png`,
      "https://exemplo.com/a.png",
      "",
    ];
    for (const imagemPath of ruins) {
      const r = await svc.criarPatrocinador({ ...valido, imagemPath });
      expect(r.ok, imagemPath).toBe(false);
    }
    for (const ext of ["jpg", "png", "webp"]) {
      expect(
        (await svc.criarPatrocinador({ ...valido, imagemPath: `patrocinador/${ID}/${ARQ}.${ext}` }))
          .ok,
      ).toBe(true);
    }
    expect(f.criar).toHaveBeenCalledTimes(3);
  });

  it("id que não é uuid é recusado", async () => {
    const r = await criarServicoPatrocinadores(fake()).criarPatrocinador({ ...valido, id: "abc" });
    expect(!r.ok && r.erro.campos).toHaveProperty("id");
  });

  it("ordem fora da faixa ou não inteira é recusada", async () => {
    const svc = criarServicoPatrocinadores(fake());
    for (const ordem of [-1001, 100001, 1.5, "x", Number.NaN]) {
      expect((await svc.criarPatrocinador({ ...valido, ordem })).ok, String(ordem)).toBe(false);
    }
    for (const ordem of [-1000, 100000, 0]) {
      expect((await svc.criarPatrocinador({ ...valido, ordem })).ok).toBe(true);
    }
  });

  it("campos de preço, cobrança e URL externa NÃO existem: são descartados e não chegam ao banco", async () => {
    const f = fake();
    await criarServicoPatrocinadores(f).criarPatrocinador({
      ...valido,
      preco: 500,
      valor: 100,
      plano: "ouro",
      cobranca: true,
      pagamento: "pix",
      url: "https://x.com",
      linkExterno: "https://x.com",
    });
    const enviado = JSON.stringify((f.criar as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(enviado).not.toMatch(/preco|valor|plano|cobranca|pagamento|https|url|linkExterno/i);
    expect(Object.keys(criarPatrocinadorSchema.parse(valido)).sort()).toEqual([
      "ativo",
      "fimEm",
      "id",
      "imagemPath",
      "inicioEm",
      "motivo",
      "ordem",
      "perfilDestinoId",
      "textoDestino",
      "titulo",
    ]);
  });

  it("título com caractere de controle é recusado", async () => {
    const r = await criarServicoPatrocinadores(fake()).criarPatrocinador({
      ...valido,
      titulo: "Oi\u0000x",
    });
    expect(r.ok).toBe(false);
  });

  it("perfil de destino inexistente (23503) vira erro de validação em pt-BR", async () => {
    const f = fake({
      criar: async () => ({
        id: null,
        erro: {
          code: "23503",
          constraint: "administracao_patrocinador_perfil_destino_id_fkey",
          message: "violates foreign key",
        },
      }),
    });
    const base = sem(valido, "textoDestino");
    const r = await criarServicoPatrocinadores(f).criarPatrocinador({
      ...base,
      perfilDestinoId: PERFIL,
    });
    expect(!r.ok && r.erro.codigo).toBe("VALIDACAO");
    expect(!r.ok && r.erro.mensagem).toMatch(/Perfil de destino/);
    expect(JSON.stringify(r)).not.toMatch(/foreign key|fkey/);
  });

  it("exceção do adaptador vira erro genérico", async () => {
    const f = fake({
      criar: async () => {
        throw new Error("segredo");
      },
    });
    const r = await criarServicoPatrocinadores(f).criarPatrocinador(valido);
    expect(!r.ok && r.erro.codigo).toBe("ERRO_INTERNO");
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});

describe("patrocinadores: alterar e ativar exigem motivo (auditoria, IM-086)", () => {
  it("alterar envia tudo com o motivo", async () => {
    const f = fake();
    const r = await criarServicoPatrocinadores(f).alterarPatrocinador({ ...valido, ordem: 3 });
    expect(r).toEqual({ ok: true, valor: { id: ID } });
    expect(f.alterar).toHaveBeenCalledWith(
      expect.objectContaining({
        p_id: ID,
        p_ordem: 3,
        p_motivo: "Campanha de novembro",
        p_texto_destino: "Pão quentinho toda manhã",
      }),
    );
  });

  it("alterar sem motivo (ausente, vazio, só espaços) é recusado: MOTIVO_OBRIGATORIO", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    const semMotivo = sem(valido, "motivo");
    for (const e of [semMotivo, { ...valido, motivo: "" }, { ...valido, motivo: "   " }]) {
      const r = await svc.alterarPatrocinador(e);
      expect(!r.ok && r.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    }
    expect(f.alterar).not.toHaveBeenCalled();
  });

  it("alterar: motivo com mais de 500 caracteres é recusado; texto com URL também", async () => {
    const svc = criarServicoPatrocinadores(fake());
    expect((await svc.alterarPatrocinador({ ...valido, motivo: "m".repeat(501) })).ok).toBe(false);
    expect((await svc.alterarPatrocinador({ ...valido, textoDestino: "http://x.com" })).ok).toBe(
      false,
    );
  });

  it("alterar: dois destinos recusados", async () => {
    const f = fake();
    const r = await criarServicoPatrocinadores(f).alterarPatrocinador({
      ...valido,
      perfilDestinoId: PERFIL,
    });
    expect(r.ok).toBe(false);
    expect(f.alterar).not.toHaveBeenCalled();
  });

  it("alterar inexistente (P0002) vira NAO_ENCONTRADO", async () => {
    const f = fake({
      alterar: async () => ({ erro: { code: "P0002", message: "patrocinador não encontrado" } }),
    });
    const r = await criarServicoPatrocinadores(f).alterarPatrocinador({ ...valido, ordem: 0 });
    expect(!r.ok && r.erro.codigo).toBe("NAO_ENCONTRADO");
  });

  it("ativar/desativar com motivo", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    expect(
      await svc.definirPatrocinadorAtivo({ id: ID, ativo: true, motivo: "Início da campanha" }),
    ).toEqual({ ok: true, valor: { ativo: true } });
    expect(f.definirAtivo).toHaveBeenCalledWith({
      p_id: ID,
      p_ativo: true,
      p_motivo: "Início da campanha",
    });
    expect(
      (await svc.definirPatrocinadorAtivo({ id: ID, ativo: false, motivo: "Contrato encerrado" }))
        .ok,
    ).toBe(true);
  });

  it("ativar/desativar sem motivo, com id ruim ou ativo não booleano é recusado", async () => {
    const f = fake();
    const svc = criarServicoPatrocinadores(f);
    for (const e of [
      { id: ID, ativo: true },
      { id: ID, ativo: true, motivo: " " },
      { id: "x", ativo: true, motivo: "m" },
      { id: ID, ativo: "sim", motivo: "m" },
      { id: ID, motivo: "m" },
    ]) {
      expect((await svc.definirPatrocinadorAtivo(e)).ok, JSON.stringify(e)).toBe(false);
    }
    const semMotivo = await svc.definirPatrocinadorAtivo({ id: ID, ativo: true });
    expect(!semMotivo.ok && semMotivo.erro.codigo).toBe("MOTIVO_OBRIGATORIO");
    expect(f.definirAtivo).not.toHaveBeenCalled();
  });

  it("22023 do banco (motivo) vira MOTIVO_OBRIGATORIO sem vazar texto", () => {
    const e = mapearErroBancoPatrocinador({ code: "22023", message: "motivo obrigatório" });
    expect(e.codigo).toBe("MOTIVO_OBRIGATORIO");
  });

  it("42501 do banco vira SEM_PERMISSAO", () => {
    expect(mapearErroBancoPatrocinador({ code: "42501", message: "x" }).codigo).toBe(
      "SEM_PERMISSAO",
    );
  });
});

describe("patrocinadores: lista do administrador", () => {
  const linha = (p: Partial<LinhaPatrocinadorAdmin>): LinhaPatrocinadorAdmin => ({
    id: ID,
    titulo: "T",
    imagem_path: IMG,
    perfil_destino_id: null,
    texto_destino: "x",
    ordem: 0,
    ativo: true,
    inicio_em: null,
    fim_em: null,
    criado_em: "2026-10-01T00:00:00Z",
    atualizado_em: "2026-10-01T00:00:00Z",
    ...p,
  });
  const AGORA = new Date("2026-11-10T12:00:00Z");

  it("calcula a situação pelo calendário", () => {
    expect(situacaoDoPatrocinador(linha({ ativo: false }), AGORA)).toBe("inativo");
    expect(situacaoDoPatrocinador(linha({ inicio_em: "2026-12-01T00:00:00Z" }), AGORA)).toBe(
      "agendado",
    );
    expect(situacaoDoPatrocinador(linha({ fim_em: "2026-11-10T12:00:00Z" }), AGORA)).toBe(
      "encerrado",
    );
    expect(
      situacaoDoPatrocinador(
        linha({ inicio_em: "2026-11-01T00:00:00Z", fim_em: "2026-12-01T00:00:00Z" }),
        AGORA,
      ),
    ).toBe("no_ar");
    expect(situacaoDoPatrocinador(linha({}), AGORA)).toBe("no_ar");
  });

  it("admin lista tudo, ordenado por ordem e criação", async () => {
    const f = fake({
      listarTodos: async () => ({
        dados: [linha({ id: "b", ordem: 2 }), linha({ id: "a", ordem: 1, ativo: false })],
        erro: null,
      }),
    });
    const r = await criarServicoPatrocinadores(f, {
      agora: () => AGORA,
    }).listarPatrocinadoresAdmin();
    expect(r.ok && r.valor.map((p) => [p.id, p.situacao])).toEqual([
      ["a", "inativo"],
      ["b", "no_ar"],
    ]);
  });
});

describe("patrocinadores: alterar substitui o conteúdo inteiro", () => {
  it("sem `ordem` é recusado (não zera a ordem em silêncio)", async () => {
    const f = fake();
    const r = await criarServicoPatrocinadores(f).alterarPatrocinador(valido);
    expect(!r.ok && r.erro.campos).toHaveProperty("ordem");
    expect(f.alterar).not.toHaveBeenCalled();
  });
});
