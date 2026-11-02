import { z } from "zod";
import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type {
  ErroBanco,
  Resultado as ResultadoBase,
  RespostaBanco,
} from "@/shared/conteudo/resultado";
import { errosPorCampo, semControle, uuidSchema } from "@/shared/conteudo/zod-util";
import { erroPerfis, MENSAGENS_PERFIS, type ErroPerfis } from "./erros";

/**
 * Aparência da página do negócio (D-016): estilo (IM-091, IM-094 pendente) e banner rotativo (IM-093).
 * Sem link externo nem rede social (IM-012): o destino do banner é só uma seção da própria página (IM-092).
 * Nada aqui toca em pontos, comissões ou relacionamento (IM-042, IM-059, IM-065). Nenhum modelo tem id de conta.
 * IM-094: o estilo NÃO passa por revisão; se o Emerson decidir o contrário, só o banco e `definirEstilo` mudam.
 */

export const ESTILO_PADRAO = "minimalista";

export const DESTINOS_SECAO_BANNER = [
  "inicio",
  "sobre",
  "produtos_servicos",
  "beneficios",
  "localizacao",
  "contato",
] as const;
export type DestinoSecaoBanner = (typeof DESTINOS_SECAO_BANNER)[number];

export const LIMITE_BANNERS = 6;
export const TEXTO_ALTERNATIVO_MAX = 200;
export const MOTIVO_MAX = 500;

export const MENSAGENS_APARENCIA = {
  estiloIndisponivel: "Este estilo não está disponível. Escolha outro.",
  limiteBanners: "O banner aceita no máximo 6 imagens.",
  bannerIndisponivel: "Este banner não está mais disponível para esta ação.",
  motivoObrigatorio: "Informe o motivo.",
  perfilIndisponivel: "Este perfil não está disponível para receber banner agora.",
  dadosInvalidos: "Confira os dados informados.",
} as const;

// ---------------------------------------------------------------- Zod

const estiloIdSchema = z
  .string({ error: "Estilo inválido." })
  .regex(/^[a-z][a-z0-9_]{1,39}$/, { error: "Estilo inválido." });

export const motivoSchema = z
  .string({ error: MENSAGENS_APARENCIA.motivoObrigatorio })
  .trim()
  .min(1, { error: MENSAGENS_APARENCIA.motivoObrigatorio })
  .max(MOTIVO_MAX, { error: `O motivo aceita até ${MOTIVO_MAX} caracteres.` })
  .refine(semControle, { error: "O motivo tem caracteres inválidos." });

const textoAlternativoSchema = z
  .string({ error: "Descreva a imagem para quem não a enxerga." })
  .trim()
  .min(1, { error: "Descreva a imagem para quem não a enxerga." })
  .max(TEXTO_ALTERNATIVO_MAX, {
    error: `A descrição da imagem aceita até ${TEXTO_ALTERNATIVO_MAX} caracteres.`,
  })
  .refine(semControle, { error: "A descrição tem caracteres inválidos." });

const destinoSecaoSchema = z
  .enum(DESTINOS_SECAO_BANNER, { error: "Escolha uma seção da própria página." })
  .nullable()
  .optional();

const imagemPathSchema = (perfilId?: string) =>
  z
    .string({ error: "Imagem inválida." })
    .regex(/^perfil\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,100}$/i, { error: "Imagem inválida." })
    .regex(/\.(jpe?g|png|webp)$/i, { error: "Imagem inválida." })
    .refine(
      (p) =>
        perfilId === undefined || p.toLowerCase().startsWith(`perfil/${perfilId.toLowerCase()}/`),
      {
        error: "Imagem inválida.",
      },
    );

const ordemSchema = z
  .number({ error: "Ordem inválida." })
  .int({ error: "Ordem inválida." })
  .min(1, { error: "Ordem inválida." })
  .max(99, { error: "Ordem inválida." });

/** Um banner do conjunto do responsável. Chaves em snake_case = contrato do jsonb de perfis_gravar_banners. */
const bannerEntradaSchema = (perfilId: string) =>
  z.strictObject({
    imagem_path: imagemPathSchema(perfilId),
    texto_alternativo: textoAlternativoSchema,
    destino_secao: destinoSecaoSchema,
    ordem: ordemSchema.optional(),
    ativo: z.boolean({ error: "Valor inválido." }).optional(),
  });

export const gravarBannersSchema = (perfilId: string) =>
  z
    .array(bannerEntradaSchema(perfilId), { error: "Lista de banners inválida." })
    .max(LIMITE_BANNERS, { error: MENSAGENS_APARENCIA.limiteBanners })
    .refine((l) => new Set(l.map((b) => b.imagem_path.toLowerCase())).size === l.length, {
      error: "Há imagens repetidas no banner.",
    });

export const definirEstiloSchema = z.strictObject({ perfilId: uuidSchema, estilo: estiloIdSchema });
export const definirEstiloHabilitadoSchema = z.strictObject({
  estilo: estiloIdSchema,
  habilitado: z.boolean({ error: "Informe habilitar ou desabilitar." }),
  motivo: motivoSchema,
});
export const responderBannerSchema = z
  .strictObject({
    bannerId: uuidSchema,
    aceitar: z.boolean({ error: "Informe aceitar ou recusar." }),
    motivo: z.string().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.aceitar) return;
    if (!motivoSchema.safeParse(v.motivo).success) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: MENSAGENS_APARENCIA.motivoObrigatorio,
      });
    }
  });
export const definirBannerAtivoSchema = z.strictObject({
  bannerId: uuidSchema,
  ativo: z.boolean({ error: "Informe exibir ou ocultar." }),
});
export const adicionarBannerAdminSchema = z.strictObject({
  perfilId: uuidSchema,
  imagemPath: imagemPathSchema(),
  textoAlternativo: textoAlternativoSchema,
  motivo: motivoSchema,
  ordem: ordemSchema.optional(),
  destinoSecao: destinoSecaoSchema,
});
export const removerBannerAdminSchema = z.strictObject({
  bannerId: uuidSchema,
  motivo: motivoSchema,
});

// ---------------------------------------------------------------- Modelos

type LinhaEstilo = {
  id: string | null;
  rotulo: string | null;
  ordem: number | null;
  habilitado: boolean | null;
};
export type EstiloPagina = { id: string; rotulo: string; ordem: number; habilitado: boolean };

type LinhaBannerBase = {
  id: string | null;
  perfil_id: string | null;
  imagem_path: string | null;
  texto_alternativo: string | null;
  destino_secao: string | null;
  ordem: number | null;
};
export type LinhaBannerPublico = LinhaBannerBase;
export type LinhaBannerAguardando = LinhaBannerBase & {
  ativo: boolean | null;
  criado_em: string | null;
};
export type LinhaBannerAdmin = LinhaBannerBase & {
  versao_id: string | null;
  origem: string | null;
  situacao: string | null;
  ativo: boolean | null;
  motivo_resposta: string | null;
  respondido_em: string | null;
  criado_em: string | null;
};

export type BannerPublico = {
  id: string;
  perfilId: string;
  imagemPath: string;
  textoAlternativo: string;
  destinoSecao: DestinoSecaoBanner | null;
  ordem: number;
};
export type BannerAguardando = BannerPublico & { ativo: boolean; criadoEm: string | null };
export type BannerAdmin = BannerPublico & {
  versaoId: string | null;
  origem: "responsavel" | "administrador";
  situacao: "na_versao" | "aguardando_aceite" | "aceito" | "recusado" | "removido";
  ativo: boolean;
  motivoResposta: string | null;
  respondidoEm: string | null;
  criadoEm: string | null;
};

const ehDestino = (v: string | null): v is DestinoSecaoBanner =>
  v !== null && (DESTINOS_SECAO_BANNER as readonly string[]).includes(v);
const ORIGENS = ["responsavel", "administrador"] as const;
const SITUACOES = ["na_versao", "aguardando_aceite", "aceito", "recusado", "removido"] as const;

/** Copia campo a campo (nunca espalha a linha). Linha incompleta é descartada. */
export function paraBannerPublico(l: LinhaBannerBase): BannerPublico | null {
  if (!l.id || !l.perfil_id || !l.imagem_path || l.texto_alternativo === null) return null;
  return {
    id: l.id,
    perfilId: l.perfil_id,
    imagemPath: l.imagem_path,
    textoAlternativo: l.texto_alternativo,
    // Destino só é aceito se for seção da página; qualquer outra coisa (URL) vira "sem destino".
    destinoSecao: ehDestino(l.destino_secao) ? l.destino_secao : null,
    ordem: l.ordem ?? 1,
  };
}

export function paraBannerAguardando(l: LinhaBannerAguardando): BannerAguardando | null {
  const b = paraBannerPublico(l);
  return b ? { ...b, ativo: l.ativo ?? true, criadoEm: l.criado_em } : null;
}

export function paraBannerAdmin(l: LinhaBannerAdmin): BannerAdmin | null {
  const b = paraBannerPublico(l);
  const origem = ORIGENS.find((o) => o === l.origem);
  const situacao = SITUACOES.find((s) => s === l.situacao);
  if (!b || !origem || !situacao) return null;
  return {
    ...b,
    versaoId: l.versao_id,
    origem,
    situacao,
    ativo: l.ativo ?? false,
    motivoResposta: l.motivo_resposta,
    respondidoEm: l.respondido_em,
    criadoEm: l.criado_em,
  };
}

/** Queda segura: id vazio, nulo ou fora dos habilitados vira o padrão. Sem lista, só aceita id bem formado. */
export function estiloEfetivo(
  estilo: string | null | undefined,
  habilitados?: readonly string[],
): string {
  if (!estilo || !estiloIdSchema.safeParse(estilo).success) return ESTILO_PADRAO;
  if (habilitados && !habilitados.includes(estilo)) return ESTILO_PADRAO;
  return estilo;
}

// ---------------------------------------------------------------- Erros

type Operacao = "estilo" | "habilitar" | "gravar" | "responder" | "ativo" | "admin";

/** Mensagens neutras: 42501 cobre sem login, perfil alheio, conta suspensa e sem permissão, sem distinguir. */
export function mapearErroBancoAparencia(e: ErroBanco, operacao: Operacao): ErroPerfis {
  const M = MENSAGENS_PERFIS;
  const A = MENSAGENS_APARENCIA;
  switch (classificarErroBanco(e)) {
    case "PERMISSAO":
      return erroPerfis("SEM_PERMISSAO", M.semPermissao);
    case "DADO_INVALIDO":
      if (operacao === "estilo" || operacao === "habilitar") {
        return erroPerfis("ESTILO_INDISPONIVEL", A.estiloIndisponivel);
      }
      return erroPerfis("VALIDACAO", A.dadosInvalidos);
    case "CHECK":
      if (/limite/i.test(`${e.message ?? ""} ${e.constraint ?? ""}`)) {
        return erroPerfis("LIMITE_BANNERS", A.limiteBanners);
      }
      return erroPerfis("VALIDACAO", A.dadosInvalidos);
    case "DUPLICADO":
      return erroPerfis("VALIDACAO", "Há imagens repetidas no banner.");
    case "NAO_ENCONTRADO":
      return erroPerfis(
        "NAO_ENCONTRADO",
        operacao === "admin" ? A.perfilIndisponivel : M.naoEncontrado,
      );
    case "ESTADO_INVALIDO":
      return operacao === "gravar"
        ? erroPerfis("EM_ANALISE", M.emAnalise)
        : erroPerfis("ESTADO_INVALIDO", A.bannerIndisponivel);
    case "REFERENCIA":
      return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
    default:
      return erroPerfis("ERRO_INTERNO", M.generica);
  }
}

// ---------------------------------------------------------------- Serviço

export type Resultado<T> = ResultadoBase<T, ErroPerfis>;

/**
 * Banco injetado (sessão do usuário; NUNCA service_role). Cada método é 1:1 a uma RPC ou visão das migrações
 * 20261102160000 e 20261102170000. Adaptador: src/app/_lib/banco-aparencia.ts.
 */
export interface ClienteBancoAparencia {
  /** select de perfis_estilo_pagina (id, rotulo, ordem, habilitado). */
  listarEstilos(): Promise<RespostaBanco<LinhaEstilo[]>>;
  /** select de perfis_meus_perfis (estilo_pagina) do perfil do dono; null = não é meu. */
  lerEstiloMeuPerfil(perfilId: string): Promise<RespostaBanco<{ estilo_pagina: string | null }>>;
  /** select de perfis_perfil_publico (estilo_pagina) por slug; null = não está no ar. */
  lerEstiloPublico(slug: string): Promise<RespostaBanco<{ estilo_pagina: string | null }>>;
  definirEstilo(a: { perfilId: string; estilo: string }): Promise<{ erro: ErroBanco | null }>;
  definirEstiloHabilitado(a: {
    estilo: string;
    habilitado: boolean;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  gravarBanners(a: { perfilId: string; banners: unknown[] }): Promise<RespostaBanco<string>>;
  responderBanner(a: {
    bannerId: string;
    aceitar: boolean;
    motivo: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  definirBannerAtivo(a: { bannerId: string; ativo: boolean }): Promise<{ erro: ErroBanco | null }>;
  adicionarBannerAdmin(a: {
    perfilId: string;
    imagemPath: string;
    textoAlternativo: string;
    motivo: string;
    ordem: number;
    destinoSecao: string | null;
  }): Promise<RespostaBanco<string>>;
  removerBannerAdmin(a: { bannerId: string; motivo: string }): Promise<{ erro: ErroBanco | null }>;
  /** select de perfis_banner_publico do perfil (vitrine). */
  listarBannersPublicos(perfilId: string): Promise<RespostaBanco<LinhaBannerPublico[]>>;
  /** select de perfis_banner_aguardando_aceite (já filtrado ao responsável). */
  listarBannersAguardandoAceite(): Promise<RespostaBanco<LinhaBannerAguardando[]>>;
  /** select de administracao_banners_empresa de um perfil (vazio sem permissão 'aprovar'). */
  listarBannersAdmin(perfilId: string): Promise<RespostaBanco<LinhaBannerAdmin[]>>;
  /** select de perfis_banner do próprio perfil (política "proprio": só o dono vê; perfil alheio volta vazio). */
  listarBannersDoPerfil(perfilId: string): Promise<RespostaBanco<LinhaBannerAdmin[]>>;
}

const falha = (erro: ErroPerfis): { ok: false; erro: ErroPerfis } => ({ ok: false, erro });

export function criarServicoAparencia(banco: ClienteBancoAparencia) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroPerfis("ERRO_INTERNO", MENSAGENS_PERFIS.generica));
    }
  }
  function invalido(erro: z.ZodError) {
    const campos = errosPorCampo(erro);
    return falha(
      erroPerfis("VALIDACAO", Object.values(campos)[0] ?? MENSAGENS_APARENCIA.dadosInvalidos, {
        campos,
      }),
    );
  }
  async function simples(
    p: Promise<{ erro: ErroBanco | null }>,
    op: Operacao,
  ): Promise<Resultado<{ ok: true }>> {
    const r = await p;
    return r.erro ? falha(mapearErroBancoAparencia(r.erro, op)) : { ok: true, valor: { ok: true } };
  }
  async function listar<L, T>(
    p: Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
    op: Operacao,
  ): Promise<Resultado<T[]>> {
    const r = await p;
    if (r.erro) return falha(mapearErroBancoAparencia(r.erro, op));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: itens };
  }

  return {
    /** IM-091: estilos em ordem (id, rótulo, habilitado). A interface mostra os habilitados para escolha. */
    listarEstilos: (): Promise<Resultado<EstiloPagina[]>> =>
      seguro(async () => {
        const r = await listar(
          banco.listarEstilos(),
          (l: LinhaEstilo): EstiloPagina | null =>
            l.id && l.rotulo !== null && l.ordem !== null
              ? { id: l.id, rotulo: l.rotulo, ordem: l.ordem, habilitado: l.habilitado === true }
              : null,
          "estilo",
        );
        return r.ok ? { ok: true, valor: [...r.valor].sort((a, b) => a.ordem - b.ordem) } : r;
      }),

    /** IM-091: estilo escolhido pelo dono (para a tela Aparência). Perfil alheio responde "não encontrado". */
    estiloDoMeuPerfil: (perfilId: unknown): Promise<Resultado<{ estilo: string }>> =>
      seguro(async () => {
        const p = uuidSchema.safeParse(perfilId);
        if (!p.success) return invalido(p.error);
        const r = await banco.lerEstiloMeuPerfil(p.data);
        if (r.erro) return falha(mapearErroBancoAparencia(r.erro, "estilo"));
        if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        return { ok: true, valor: { estilo: estiloEfetivo(r.dados.estilo_pagina) } };
      }),

    /** IM-091: estilo da página pública (o banco já devolve o padrão se o estilo foi desabilitado). */
    estiloPublico: (slug: string): Promise<Resultado<{ estilo: string }>> =>
      seguro(async () => {
        const r = await banco.lerEstiloPublico(slug);
        if (r.erro) return falha(mapearErroBancoAparencia(r.erro, "estilo"));
        return { ok: true, valor: { estilo: estiloEfetivo(r.dados?.estilo_pagina) } };
      }),

    /** IM-091, IM-094: o dono troca o estilo (sem revisão). 42501 = sem login/alheio/suspensa; 22023 = indisponível. */
    definirEstilo: (entrada: unknown): Promise<Resultado<{ ok: true }>> =>
      seguro(async () => {
        const p = definirEstiloSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        return simples(banco.definirEstilo(p.data), "estilo");
      }),

    /** IM-091: administrador geral libera/recolhe um estilo; motivo obrigatório (auditado no banco). */
    definirEstiloHabilitado: (entrada: unknown): Promise<Resultado<{ ok: true }>> =>
      seguro(async () => {
        const p = definirEstiloHabilitadoSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        return simples(banco.definirEstiloHabilitado(p.data), "habilitar");
      }),

    /** IM-093: o responsável grava o conjunto inteiro do banner (até 6) no rascunho; segue a revisão do perfil. */
    gravarBanners: (
      perfilId: unknown,
      banners: unknown,
    ): Promise<Resultado<{ versaoId: string }>> =>
      seguro(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return invalido(id.error);
        const p = gravarBannersSchema(id.data).safeParse(banners);
        if (!p.success) return invalido(p.error);
        const itens = p.data.map((b, i) => ({
          imagem_path: b.imagem_path,
          texto_alternativo: b.texto_alternativo,
          destino_secao: b.destino_secao ?? null,
          ordem: b.ordem ?? i + 1,
          ativo: b.ativo ?? true,
        }));
        const r = await banco.gravarBanners({ perfilId: id.data, banners: itens });
        if (r.erro) return falha(mapearErroBancoAparencia(r.erro, "gravar"));
        if (!r.dados) return falha(erroPerfis("ERRO_INTERNO", MENSAGENS_PERFIS.generica));
        return { ok: true, valor: { versaoId: r.dados } };
      }),

    /** IM-093: o responsável aceita ou recusa banner colocado pelo administrador; recusa exige motivo. */
    responderBanner: (entrada: unknown): Promise<Resultado<{ ok: true }>> =>
      seguro(async () => {
        const p = responderBannerSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        const motivo = p.data.aceitar ? null : motivoSchema.parse(p.data.motivo);
        return simples(
          banco.responderBanner({ bannerId: p.data.bannerId, aceitar: p.data.aceitar, motivo }),
          "responder",
        );
      }),

    /** IM-093: o responsável oculta ou volta a exibir um banner aceito. */
    definirBannerAtivo: (entrada: unknown): Promise<Resultado<{ ok: true }>> =>
      seguro(async () => {
        const p = definirBannerAtivoSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        return simples(banco.definirBannerAtivo(p.data), "ativo");
      }),

    /** IM-093: administrador (permissão 'aprovar') adiciona banner; nasce aguardando aceite e não publica sozinho. */
    adicionarBannerAdmin: (entrada: unknown): Promise<Resultado<{ bannerId: string }>> =>
      seguro(async () => {
        const p = adicionarBannerAdminSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        const r = await banco.adicionarBannerAdmin({
          perfilId: p.data.perfilId,
          imagemPath: p.data.imagemPath,
          textoAlternativo: p.data.textoAlternativo,
          motivo: p.data.motivo,
          ordem: p.data.ordem ?? 1,
          destinoSecao: p.data.destinoSecao ?? null,
        });
        if (r.erro) return falha(mapearErroBancoAparencia(r.erro, "admin"));
        if (!r.dados) return falha(erroPerfis("ERRO_INTERNO", MENSAGENS_PERFIS.generica));
        return { ok: true, valor: { bannerId: r.dados } };
      }),

    /** IM-093: administrador retira o banner que adicionou; motivo obrigatório. */
    removerBannerAdmin: (entrada: unknown): Promise<Resultado<{ ok: true }>> =>
      seguro(async () => {
        const p = removerBannerAdminSchema.safeParse(entrada);
        if (!p.success) return invalido(p.error);
        return simples(banco.removerBannerAdmin(p.data), "admin");
      }),

    /** IM-093: banners no ar da página, em ordem. Só campos de marca; nada de conta. */
    bannersPublicos: (perfilId: unknown): Promise<Resultado<BannerPublico[]>> =>
      seguro(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return invalido(id.error);
        const r = await listar(banco.listarBannersPublicos(id.data), paraBannerPublico, "ativo");
        return r.ok ? { ok: true, valor: [...r.valor].sort((a, b) => a.ordem - b.ordem) } : r;
      }),

    /** IM-093: banners que esperam o aceite do responsável (base do aviso no sino). */
    bannersAguardandoAceite: (): Promise<Resultado<BannerAguardando[]>> =>
      seguro(() =>
        listar(banco.listarBannersAguardandoAceite(), paraBannerAguardando, "responder"),
      ),

    /** IM-093: todos os banners do PRÓPRIO perfil (a tela do responsável filtra o conjunto vigente). Perfil alheio: vazio. */
    bannersDoMeuPerfil: (perfilId: unknown): Promise<Resultado<BannerAdmin[]>> =>
      seguro(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return invalido(id.error);
        return listar(banco.listarBannersDoPerfil(id.data), paraBannerAdmin, "responder");
      }),

    /** IM-093: todos os banners de uma empresa, para o administrador (lista vazia sem permissão). */
    bannersDaEmpresa: (perfilId: unknown): Promise<Resultado<BannerAdmin[]>> =>
      seguro(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return invalido(id.error);
        return listar(banco.listarBannersAdmin(id.data), paraBannerAdmin, "admin");
      }),
  };
}

export type ServicoAparencia = ReturnType<typeof criarServicoAparencia>;
