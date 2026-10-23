import {
  decidirEdicao,
  estadoDoConteudo,
  podePublicar,
  versaoAberta,
  type EstadoConteudo,
} from "@/shared/conteudo/ciclo-versao";
import { classificarErroBanco, alvoDoErro } from "@/shared/conteudo/erros-banco";
import type {
  ErroBanco,
  Resultado as ResultadoBase,
  RespostaBanco,
} from "@/shared/conteudo/resultado";
import { errosPorCampo, uuidSchema } from "@/shared/conteudo/zod-util";
import { erroPerfis, mapearErroBancoPerfis, MENSAGENS_PERFIS, type ErroPerfis } from "./erros";
import {
  CONTEUDO_PERFIL_VAZIO,
  colunasDeConteudo,
  conteudoDeVersao,
  paraPerfilExibicao,
  type ColunasVersaoPerfil,
  type ConteudoPerfil,
  type LinhaPerfil,
  type LinhaVersaoPerfil,
  type PerfilExibicao,
} from "./modelos";
import { aplicarCamposPerfil, pendenciasDoPerfil, validarConteudoPerfil } from "./regras";
import { camposPerfilSchema, novoPerfilSchema } from "./schemas";
import { candidatosDeSlug, gerarSlugDeNome, validarSlug } from "./slug";

export type Resultado<T> = ResultadoBase<T, ErroPerfis>;

/**
 * Banco injetado para perfis. A implementação usa a SESSÃO DO USUÁRIO (supabase-js com RLS), nunca
 * service_role. `contaId` é a conta autenticada (auth.uid()). `dados: null` sem erro = nenhuma linha.
 */
export interface ClienteBancoPerfis {
  readonly contaId: string;
  inserirPerfil(c: { responsavel_id: string; slug: string }): Promise<RespostaBanco<LinhaPerfil>>;
  buscarPerfil(perfilId: string): Promise<RespostaBanco<LinhaPerfil>>;
  /** Perfis da própria conta, mais recentes primeiro. */
  listarMeusPerfis(): Promise<RespostaBanco<LinhaPerfil[]>>;
  /** Versões dos perfis informados, com `whatsapp_comercial_e164` já juntado (tabela de contato). */
  listarVersoes(perfilIds: string[]): Promise<RespostaBanco<LinhaVersaoPerfil[]>>;
  /** Insere a versão (rascunho) em perfis_perfil_versao. O WhatsApp vai em `gravarContato`. */
  inserirVersao(
    c: ColunasVersaoPerfil & { perfil_id: string },
  ): Promise<RespostaBanco<LinhaVersaoPerfil>>;
  atualizarVersao(
    versaoId: string,
    c: Partial<ColunasVersaoPerfil>,
  ): Promise<RespostaBanco<LinhaVersaoPerfil>>;
  /** upsert em perfis_perfil_versao_contato; `null` apaga a linha. Só rascunho (gatilho do banco). */
  gravarContato(versaoId: string, whatsappE164: string | null): Promise<{ erro: ErroBanco | null }>;
  /** rpc perfis_enviar_versao. */
  enviarVersao(versaoId: string): Promise<{ erro: ErroBanco | null }>;
  /** update em perfis_perfil (só publicado e slug são graváveis pelo dono). */
  atualizarPerfil(
    perfilId: string,
    c: { publicado?: boolean; slug?: string },
  ): Promise<RespostaBanco<LinhaPerfil>>;
}

export type MeuPerfil = {
  id: string;
  slug: string;
  publicado: boolean;
  versaoAprovadaId: string | null;
  estado: EstadoConteudo;
  versaoAbertaId: string | null;
  /** Para o formulário: versão aberta, ou a última decidida. Inclui o WhatsApp (privado do dono). */
  conteudoEdicao: ConteudoPerfil;
  /** Conteúdo da versão que está (ou esteve) no ar. */
  conteudoNoAr: ConteudoPerfil | null;
  /** O que falta para enviar `conteudoEdicao`. */
  pendencias: string[];
  /** O slug ainda pode mudar (antes da primeira aprovação). */
  slugEditavel: boolean;
  criadoEm: string;
};

export type PreviaPerfil = {
  /** Mesmo formato da página pública (IM-017); sem WhatsApp e sem responsável. */
  perfil: PerfilExibicao;
  situacaoVersao: "rascunho" | "pendente" | "aprovada" | "rejeitada" | null;
  pendencias: string[];
  podeEnviar: boolean;
};

const M = MENSAGENS_PERFIS;
const interno = (): ErroPerfis => erroPerfis("ERRO_INTERNO", M.generica);
const falha = (erro: ErroPerfis): { ok: false; erro: ErroPerfis } => ({ ok: false, erro });

function maisRecenteDecidida(versoes: LinhaVersaoPerfil[]): LinhaVersaoPerfil | null {
  return (
    [...versoes]
      .filter((v) => v.situacao === "aprovada" || v.situacao === "rejeitada")
      .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em))[0] ?? null
  );
}

export function montarMeuPerfil(perfil: LinhaPerfil, versoes: LinhaVersaoPerfil[]): MeuPerfil {
  const aberta = versaoAberta(versoes);
  const base = aberta ?? maisRecenteDecidida(versoes);
  const aprovada = versoes.find((v) => v.id === perfil.versao_aprovada_id) ?? null;
  const conteudoEdicao = base ? conteudoDeVersao(base) : CONTEUDO_PERFIL_VAZIO;
  return {
    id: perfil.id,
    slug: perfil.slug,
    publicado: perfil.publicado,
    versaoAprovadaId: perfil.versao_aprovada_id,
    estado: estadoDoConteudo(perfil, versoes),
    versaoAbertaId: aberta?.id ?? null,
    conteudoEdicao,
    conteudoNoAr: aprovada ? conteudoDeVersao(aprovada) : null,
    pendencias: pendenciasDoPerfil(conteudoEdicao),
    slugEditavel: perfil.versao_aprovada_id === null,
    criadoEm: perfil.criado_em,
  };
}

function ehSlugDuplicado(e: ErroBanco): boolean {
  return classificarErroBanco(e) === "DUPLICADO" && /slug/i.test(alvoDoErro(e));
}

export function criarServicoPerfis(banco: ClienteBancoPerfis) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(interno());
    }
  }

  function falhaCampos(campos: Record<string, string>) {
    return falha(erroPerfis("VALIDACAO", Object.values(campos)[0] ?? M.textoInvalido, { campos }));
  }

  /** Perfil de outra conta é tratado como inexistente. */
  async function carregar(
    perfilId: string,
  ): Promise<Resultado<{ perfil: LinhaPerfil; versoes: LinhaVersaoPerfil[] }>> {
    if (!uuidSchema.safeParse(perfilId).success) {
      return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
    }
    const p = await banco.buscarPerfil(perfilId);
    if (p.erro) return falha(mapearErroBancoPerfis(p.erro));
    if (!p.dados || p.dados.responsavel_id !== banco.contaId) {
      return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
    }
    const v = await banco.listarVersoes([perfilId]);
    if (v.erro) return falha(mapearErroBancoPerfis(v.erro));
    return { ok: true, valor: { perfil: p.dados, versoes: v.dados ?? [] } };
  }

  return {
    /**
     * Cria o perfil (identidade + slug) e o primeiro rascunho. Slug informado: respeitado ou recusado
     * (reservado/duplicado). Slug gerado do nome: tenta "loja", "loja-2"... até achar livre.
     */
    criarRascunho: (entrada: unknown): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const p = novoPerfilSchema.safeParse(entrada);
        if (!p.success) return falhaCampos(errosPorCampo(p.error));
        const { slug: slugInformado, ...campos } = p.data;
        const conteudo = aplicarCamposPerfil(CONTEUDO_PERFIL_VAZIO, campos);
        const incoerencias = validarConteudoPerfil(conteudo, banco.contaId);
        if (Object.keys(incoerencias).length > 0) return falhaCampos(incoerencias);

        let candidatos: string[];
        if (slugInformado) {
          const v = validarSlug(slugInformado);
          if (!v.ok) {
            return falha(
              erroPerfis(
                v.codigo === "RESERVADO" ? "SLUG_RESERVADO" : "SLUG_INVALIDO",
                v.mensagem,
                {
                  campos: { slug: v.mensagem },
                },
              ),
            );
          }
          candidatos = [v.slug];
        } else {
          const base = gerarSlugDeNome(conteudo.nome ?? "");
          if (!base) {
            const m = "Não foi possível gerar o endereço a partir do nome. Informe um endereço.";
            return falha(erroPerfis("SLUG_INVALIDO", m, { campos: { slug: m } }));
          }
          candidatos = candidatosDeSlug(base);
        }

        let perfil: LinhaPerfil | null = null;
        for (const slug of candidatos) {
          const r = await banco.inserirPerfil({ responsavel_id: banco.contaId, slug });
          if (r.erro) {
            if (ehSlugDuplicado(r.erro)) continue;
            return falha(mapearErroBancoPerfis(r.erro));
          }
          if (!r.dados) return falha(interno());
          perfil = r.dados;
          break;
        }
        if (!perfil) {
          const m = M.slugIndisponivel;
          return falha(erroPerfis("SLUG_INDISPONIVEL", m, { campos: { slug: m } }));
        }

        const ver = await banco.inserirVersao({
          perfil_id: perfil.id,
          ...colunasDeConteudo(conteudo),
        });
        if (ver.erro) return falha(mapearErroBancoPerfis(ver.erro));
        if (!ver.dados) return falha(interno());
        let linha = ver.dados;
        if (conteudo.whatsappComercialE164) {
          const c = await banco.gravarContato(linha.id, conteudo.whatsappComercialE164);
          if (c.erro) return falha(mapearErroBancoPerfis(c.erro));
          linha = { ...linha, whatsapp_comercial_e164: conteudo.whatsappComercialE164 };
        }
        return { ok: true, valor: montarMeuPerfil(perfil, [linha]) };
      }),

    /**
     * IM-022. Rascunho aberto: atualiza. Sem versão aberta (perfil aprovado ou rejeitado): cria NOVA
     * versão copiando a última decidida; a aprovada continua no ar. Versão pendente: bloqueia.
     * Nunca altera `publicado`: editar um perfil despublicado não o republica.
     */
    editar: (
      perfilId: string,
      entrada: unknown,
    ): Promise<Resultado<{ perfil: MeuPerfil; criouNovaVersao: boolean }>> =>
      seguro(async () => {
        const p = camposPerfilSchema.safeParse(entrada);
        if (!p.success) return falhaCampos(errosPorCampo(p.error));
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        const { perfil, versoes } = c.valor;
        const acao = decidirEdicao(versoes);
        if (acao.tipo === "bloqueada_em_analise")
          return falha(erroPerfis("EM_ANALISE", M.emAnalise));

        const baseId = acao.tipo === "atualizar_rascunho" ? acao.versaoId : acao.baseId;
        const baseLinha = baseId ? versoes.find((v) => v.id === baseId) : undefined;
        const base = baseLinha ? conteudoDeVersao(baseLinha) : CONTEUDO_PERFIL_VAZIO;
        const novo = aplicarCamposPerfil(base, p.data);
        const incoerencias = validarConteudoPerfil(novo, banco.contaId);
        if (Object.keys(incoerencias).length > 0) return falhaCampos(incoerencias);

        let atual: LinhaVersaoPerfil;
        if (acao.tipo === "atualizar_rascunho") {
          const r = await banco.atualizarVersao(acao.versaoId, colunasDeConteudo(novo));
          if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
          if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
          atual = r.dados;
        } else {
          const r = await banco.inserirVersao({ perfil_id: perfil.id, ...colunasDeConteudo(novo) });
          if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
          if (!r.dados) return falha(interno());
          atual = r.dados;
        }
        // O contato é por versão: grava quando mudou ou quando a versão é nova (copia o da base).
        const contatoMudou = novo.whatsappComercialE164 !== base.whatsappComercialE164;
        if (acao.tipo === "nova_versao" ? novo.whatsappComercialE164 !== null : contatoMudou) {
          const g = await banco.gravarContato(atual.id, novo.whatsappComercialE164);
          if (g.erro) return falha(mapearErroBancoPerfis(g.erro));
        }
        atual = { ...atual, whatsapp_comercial_e164: novo.whatsappComercialE164 };
        const demais = versoes.filter((v) => v.id !== atual.id);
        return {
          ok: true,
          valor: {
            perfil: montarMeuPerfil(perfil, [atual, ...demais]),
            criouNovaVersao: acao.tipo === "nova_versao",
          },
        };
      }),

    /** O slug só muda antes da primeira aprovação (depois é endereço público). */
    alterarSlug: (perfilId: string, slugNovo: unknown): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const v = validarSlug(typeof slugNovo === "string" ? slugNovo : "");
        if (!v.ok) {
          return falha(
            erroPerfis(v.codigo === "RESERVADO" ? "SLUG_RESERVADO" : "SLUG_INVALIDO", v.mensagem, {
              campos: { slug: v.mensagem },
            }),
          );
        }
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        if (c.valor.perfil.versao_aprovada_id !== null) {
          return falha(erroPerfis("SLUG_CONGELADO", M.slugCongelado));
        }
        const r = await banco.atualizarPerfil(perfilId, { slug: v.slug });
        if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
        if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
        return { ok: true, valor: montarMeuPerfil(r.dados, c.valor.versoes) };
      }),

    obter: (perfilId: string): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const c = await carregar(perfilId);
        return c.ok ? { ok: true, valor: montarMeuPerfil(c.valor.perfil, c.valor.versoes) } : c;
      }),

    listarMeus: (): Promise<Resultado<MeuPerfil[]>> =>
      seguro(async () => {
        const r = await banco.listarMeusPerfis();
        if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
        const perfis = (r.dados ?? []).filter((p) => p.responsavel_id === banco.contaId);
        if (perfis.length === 0) return { ok: true, valor: [] };
        const v = await banco.listarVersoes(perfis.map((p) => p.id));
        if (v.erro) return falha(mapearErroBancoPerfis(v.erro));
        const todas = v.dados ?? [];
        return {
          ok: true,
          valor: perfis.map((p) =>
            montarMeuPerfil(
              p,
              todas.filter((x) => x.perfil_id === p.id),
            ),
          ),
        };
      }),

    /** IM-017: o dono confere o perfil no formato da página pública, sem torná-lo público. */
    previa: (perfilId: string): Promise<Resultado<PreviaPerfil>> =>
      seguro(async () => {
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        const { perfil, versoes } = c.valor;
        const aberta = versaoAberta(versoes);
        const linha = aberta ?? maisRecenteDecidida(versoes);
        const conteudo = linha ? conteudoDeVersao(linha) : CONTEUDO_PERFIL_VAZIO;
        const pendencias = pendenciasDoPerfil(conteudo);
        return {
          ok: true,
          valor: {
            perfil: paraPerfilExibicao(perfil, conteudo),
            situacaoVersao: linha?.situacao ?? null,
            pendencias,
            podeEnviar: aberta?.situacao === "rascunho" && pendencias.length === 0,
          },
        };
      }),

    /** Envia o rascunho para aprovação (IM-021). Exige os campos obrigatórios. */
    enviarParaAprovacao: (perfilId: string): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        const { perfil, versoes } = c.valor;
        const aberta = versaoAberta(versoes);
        if (!aberta) return falha(erroPerfis("ESTADO_INVALIDO", M.nenhumRascunho));
        if (aberta.situacao === "pendente") return falha(erroPerfis("EM_ANALISE", M.emAnalise));
        const pendencias = pendenciasDoPerfil(conteudoDeVersao(aberta));
        if (pendencias.length > 0) {
          return falha(erroPerfis("INCOMPLETO", M.incompleto, { pendencias }));
        }
        const r = await banco.enviarVersao(aberta.id);
        if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
        const depois = versoes.map((v) =>
          v.id === aberta.id ? { ...v, situacao: "pendente" as const } : v,
        );
        return { ok: true, valor: montarMeuPerfil(perfil, depois) };
      }),

    /** IM-079: só publica o que foi aprovado. */
    publicar: (perfilId: string): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        if (!podePublicar(c.valor.perfil)) return falha(erroPerfis("NAO_APROVADO", M.naoAprovado));
        const r = await banco.atualizarPerfil(perfilId, { publicado: true });
        if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
        if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
        return { ok: true, valor: montarMeuPerfil(r.dados, c.valor.versoes) };
      }),

    /** IM-079: imediato, sem aprovação. O perfil sai do ar e seus itens/benefícios ficam indisponíveis. */
    despublicar: (perfilId: string): Promise<Resultado<MeuPerfil>> =>
      seguro(async () => {
        const c = await carregar(perfilId);
        if (!c.ok) return c;
        const r = await banco.atualizarPerfil(perfilId, { publicado: false });
        if (r.erro) return falha(mapearErroBancoPerfis(r.erro));
        if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", M.naoEncontrado));
        return { ok: true, valor: montarMeuPerfil(r.dados, c.valor.versoes) };
      }),
  };
}

export type ServicoPerfis = ReturnType<typeof criarServicoPerfis>;
