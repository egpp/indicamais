import {
  decidirEdicao,
  estadoDoConteudo,
  podePublicar,
  versaoAberta,
  type EstadoConteudo,
} from "@/shared/conteudo/ciclo-versao";
import { errosPorCampo, uuidSchema } from "@/shared/conteudo/zod-util";
import type {
  Resultado as ResultadoBase,
  RespostaBanco,
  ErroBanco,
} from "@/shared/conteudo/resultado";
import {
  erroCatalogo,
  mapearErroBancoCatalogo,
  MENSAGENS_CATALOGO,
  type ErroCatalogo,
} from "./erros";
import {
  CONTEUDO_ITEM_VAZIO,
  colunasDeConteudo,
  conteudoDeVersao,
  paraItemExibicao,
  dadosDeCriacao,
  type ColunasVersaoItem,
  type ConteudoItem,
  type DadosCriarItem,
  type ItemExibicao,
  type LinhaItem,
  type LinhaItemVersao,
} from "./modelos";
import { aplicarCamposItem, pendenciasDoItem, validarConteudoItem } from "./regras";
import { camposItemSchema, novoItemSchema, type TipoItem } from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroCatalogo>;

/**
 * Banco injetado para itens. A implementação usa a SESSÃO DO USUÁRIO (supabase-js com RLS), nunca
 * service_role. Ninguém lê `conta_id`: a posse é dada por a linha estar em `catalogo_meus_itens`.
 * O item nasce por RPC (sem INSERT direto). Convenção: `dados: null` sem erro = nenhuma linha.
 */
export interface ClienteBancoItens {
  /** rpc catalogo_criar_item: item + 1ª versão (rascunho, sem foto) numa transação; dono = auth.uid(). */
  criarItem(c: DadosCriarItem): Promise<RespostaBanco<{ item_id: string; versao_id: string }>>;
  /** select em catalogo_meus_itens filtrado por id. `dados: null` = não é meu (ou não existe). */
  buscarMeuItem(itemId: string): Promise<RespostaBanco<LinhaItem>>;
  /** select em catalogo_meus_itens, mais recentes primeiro. */
  listarMeusItens(): Promise<RespostaBanco<LinhaItem[]>>;
  /** Versões dos itens informados (todas as situações), qualquer ordem. */
  listarVersoes(itemIds: string[]): Promise<RespostaBanco<LinhaItemVersao[]>>;
  inserirVersao(
    c: ColunasVersaoItem & { item_id: string },
  ): Promise<RespostaBanco<LinhaItemVersao>>;
  atualizarVersao(
    versaoId: string,
    c: Partial<ColunasVersaoItem>,
  ): Promise<RespostaBanco<LinhaItemVersao>>;
  /** rpc catalogo_enviar_item_versao. */
  enviarVersao(versaoId: string): Promise<{ erro: ErroBanco | null }>;
  /** update catalogo_item set publicado. */
  definirPublicado(itemId: string, publicado: boolean): Promise<RespostaBanco<LinhaItem>>;
}

export type MeuItem = {
  id: string;
  tipo: TipoItem;
  perfilId: string | null;
  anuncioParticular: boolean;
  publicado: boolean;
  versaoAprovadaId: string | null;
  estado: EstadoConteudo;
  versaoAbertaId: string | null;
  /** Conteúdo para o formulário: versão aberta, ou a última decidida. */
  conteudoEdicao: ConteudoItem;
  /** Conteúdo que está (ou esteve) no ar: a versão aprovada. */
  conteudoNoAr: ConteudoItem | null;
  /** O que falta para enviar `conteudoEdicao` (IM-017). */
  pendencias: string[];
  criadoEm: string;
};

export type PreviaItem = {
  /** Mesmo formato da página pública (IM-017). */
  item: ItemExibicao;
  situacaoVersao: "rascunho" | "pendente" | "aprovada" | "rejeitada" | null;
  pendencias: string[];
  podeEnviar: boolean;
};

const M = MENSAGENS_CATALOGO;
const interno = (): ErroCatalogo => erroCatalogo("ERRO_INTERNO", M.generica);
const falha = (erro: ErroCatalogo): { ok: false; erro: ErroCatalogo } => ({ ok: false, erro });

function maisRecenteDecidida(versoes: LinhaItemVersao[]): LinhaItemVersao | null {
  return (
    [...versoes]
      .filter((v) => v.situacao === "aprovada" || v.situacao === "rejeitada")
      .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em))[0] ?? null
  );
}

export function montarMeuItem(item: LinhaItem, versoes: LinhaItemVersao[]): MeuItem {
  const aberta = versaoAberta(versoes);
  const base = aberta ?? maisRecenteDecidida(versoes);
  const aprovada = versoes.find((v) => v.id === item.versao_aprovada_id) ?? null;
  const conteudoEdicao = base ? conteudoDeVersao(base) : CONTEUDO_ITEM_VAZIO;
  return {
    id: item.id,
    tipo: item.tipo,
    perfilId: item.perfil_id,
    anuncioParticular: item.perfil_id === null,
    publicado: item.publicado,
    versaoAprovadaId: item.versao_aprovada_id,
    estado: estadoDoConteudo(item, versoes),
    versaoAbertaId: aberta?.id ?? null,
    conteudoEdicao,
    conteudoNoAr: aprovada ? conteudoDeVersao(aprovada) : null,
    pendencias: pendenciasDoItem(conteudoEdicao),
    criadoEm: item.criado_em,
  };
}

export function criarServicoItens(banco: ClienteBancoItens) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(interno());
    }
  }

  /** Carrega item e versões. Item fora da lista "meus" é tratado como inexistente. */
  async function carregar(
    itemId: string,
  ): Promise<Resultado<{ item: LinhaItem; versoes: LinhaItemVersao[] }>> {
    if (!uuidSchema.safeParse(itemId).success) {
      return falha(erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado));
    }
    const it = await banco.buscarMeuItem(itemId);
    if (it.erro) return falha(mapearErroBancoCatalogo(it.erro));
    if (!it.dados || it.dados.id.toLowerCase() !== itemId.toLowerCase()) {
      return falha(erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado));
    }
    const v = await banco.listarVersoes([itemId]);
    if (v.erro) return falha(mapearErroBancoCatalogo(v.erro));
    return { ok: true, valor: { item: it.dados, versoes: v.dados ?? [] } };
  }

  return {
    /** Cria o item e o primeiro rascunho. Sem `perfilId` = anúncio particular (IM-015). */
    criarRascunho: (entrada: unknown): Promise<Resultado<MeuItem>> =>
      seguro(async () => {
        const p = novoItemSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroCatalogo("VALIDACAO", Object.values(campos)[0] ?? M.textoInvalido, { campos }),
          );
        }
        const { tipo, perfilId, ...campos } = p.data;
        const conteudo = aplicarCamposItem(CONTEUDO_ITEM_VAZIO, campos);
        const incoerencias = validarConteudoItem(conteudo, null);
        if (Object.keys(incoerencias).length > 0) {
          return falha(
            erroCatalogo("VALIDACAO", Object.values(incoerencias)[0]!, { campos: incoerencias }),
          );
        }
        const criado = await banco.criarItem(dadosDeCriacao(conteudo, tipo, perfilId ?? null));
        if (criado.erro) return falha(mapearErroBancoCatalogo(criado.erro));
        if (!criado.dados) return falha(interno());
        const c = await carregar(criado.dados.item_id);
        if (!c.ok) return c;
        return { ok: true, valor: montarMeuItem(c.valor.item, c.valor.versoes) };
      }),

    /**
     * IM-022. Rascunho aberto: atualiza. Item já aprovado/rejeitado e sem versão aberta: cria NOVA versão
     * (a aprovada continua no ar) copiando a última decidida. Versão pendente: bloqueia.
     * Nunca altera `publicado`: editar um item despublicado não o republica.
     */
    editar: (
      itemId: string,
      entrada: unknown,
    ): Promise<Resultado<{ item: MeuItem; criouNovaVersao: boolean }>> =>
      seguro(async () => {
        const p = camposItemSchema.safeParse(entrada);
        if (!p.success) {
          const campos = errosPorCampo(p.error);
          return falha(
            erroCatalogo("VALIDACAO", Object.values(campos)[0] ?? M.textoInvalido, { campos }),
          );
        }
        const c = await carregar(itemId);
        if (!c.ok) return c;
        const { item, versoes } = c.valor;
        const acao = decidirEdicao(versoes);
        if (acao.tipo === "bloqueada_em_analise") {
          return falha(erroCatalogo("EM_ANALISE", M.emAnalise));
        }
        const baseLinha =
          acao.tipo === "atualizar_rascunho"
            ? versoes.find((v) => v.id === acao.versaoId)
            : acao.baseId
              ? versoes.find((v) => v.id === acao.baseId)
              : undefined;
        const base = baseLinha ? conteudoDeVersao(baseLinha) : CONTEUDO_ITEM_VAZIO;
        const novo = aplicarCamposItem(base, p.data);
        const incoerencias = validarConteudoItem(novo, itemId);
        if (Object.keys(incoerencias).length > 0) {
          return falha(
            erroCatalogo("VALIDACAO", Object.values(incoerencias)[0]!, { campos: incoerencias }),
          );
        }

        let atual: LinhaItemVersao | null;
        if (acao.tipo === "atualizar_rascunho") {
          const r = await banco.atualizarVersao(acao.versaoId, colunasDeConteudo(novo));
          if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
          if (!r.dados) return falha(erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado));
          atual = r.dados;
        } else {
          const r = await banco.inserirVersao({ item_id: item.id, ...colunasDeConteudo(novo) });
          if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
          if (!r.dados) return falha(interno());
          atual = r.dados;
        }
        const demais = versoes.filter((v) => v.id !== atual.id);
        return {
          ok: true,
          valor: {
            item: montarMeuItem(item, [atual, ...demais]),
            criouNovaVersao: acao.tipo === "nova_versao",
          },
        };
      }),

    obter: (itemId: string): Promise<Resultado<MeuItem>> =>
      seguro(async () => {
        const c = await carregar(itemId);
        return c.ok ? { ok: true, valor: montarMeuItem(c.valor.item, c.valor.versoes) } : c;
      }),

    listarMeus: (): Promise<Resultado<MeuItem[]>> =>
      seguro(async () => {
        const it = await banco.listarMeusItens();
        if (it.erro) return falha(mapearErroBancoCatalogo(it.erro));
        const itens = it.dados ?? [];
        if (itens.length === 0) return { ok: true, valor: [] };
        const v = await banco.listarVersoes(itens.map((i) => i.id));
        if (v.erro) return falha(mapearErroBancoCatalogo(v.erro));
        const todas = v.dados ?? [];
        return {
          ok: true,
          valor: itens.map((i) =>
            montarMeuItem(
              i,
              todas.filter((x) => x.item_id === i.id),
            ),
          ),
        };
      }),

    /** IM-017: o dono confere o conteúdo, no formato da página pública, sem torná-lo público. */
    previa: (itemId: string): Promise<Resultado<PreviaItem>> =>
      seguro(async () => {
        const c = await carregar(itemId);
        if (!c.ok) return c;
        const { item, versoes } = c.valor;
        const aberta = versaoAberta(versoes);
        const linha = aberta ?? maisRecenteDecidida(versoes);
        const conteudo = linha ? conteudoDeVersao(linha) : CONTEUDO_ITEM_VAZIO;
        const pendencias = pendenciasDoItem(conteudo);
        return {
          ok: true,
          valor: {
            item: paraItemExibicao(item, conteudo),
            situacaoVersao: linha?.situacao ?? null,
            pendencias,
            podeEnviar: aberta?.situacao === "rascunho" && pendencias.length === 0,
          },
        };
      }),

    /** Envia o rascunho para aprovação (IM-021). Exige campos obrigatórios. */
    enviarParaAprovacao: (itemId: string): Promise<Resultado<MeuItem>> =>
      seguro(async () => {
        const c = await carregar(itemId);
        if (!c.ok) return c;
        const { item, versoes } = c.valor;
        const aberta = versaoAberta(versoes);
        if (!aberta) return falha(erroCatalogo("ESTADO_INVALIDO", M.nenhumRascunho));
        if (aberta.situacao === "pendente") return falha(erroCatalogo("EM_ANALISE", M.emAnalise));
        const pendencias = pendenciasDoItem(conteudoDeVersao(aberta));
        if (pendencias.length > 0) {
          return falha(erroCatalogo("INCOMPLETO", M.incompleto, { pendencias }));
        }
        const r = await banco.enviarVersao(aberta.id);
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        const depois = versoes.map((v) =>
          v.id === aberta.id ? { ...v, situacao: "pendente" as const } : v,
        );
        return { ok: true, valor: montarMeuItem(item, depois) };
      }),

    /** Só publica o que foi aprovado. Não mexe em versões. */
    publicar: (itemId: string): Promise<Resultado<MeuItem>> =>
      seguro(async () => {
        const c = await carregar(itemId);
        if (!c.ok) return c;
        if (!podePublicar(c.valor.item)) return falha(erroCatalogo("NAO_APROVADO", M.naoAprovado));
        const r = await banco.definirPublicado(itemId, true);
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        if (!r.dados) return falha(erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado));
        return { ok: true, valor: montarMeuItem(r.dados, c.valor.versoes) };
      }),

    /** IM-079: imediato, sem passar por aprovação. */
    despublicar: (itemId: string): Promise<Resultado<MeuItem>> =>
      seguro(async () => {
        const c = await carregar(itemId);
        if (!c.ok) return c;
        const r = await banco.definirPublicado(itemId, false);
        if (r.erro) return falha(mapearErroBancoCatalogo(r.erro));
        if (!r.dados) return falha(erroCatalogo("NAO_ENCONTRADO", M.naoEncontrado));
        return { ok: true, valor: montarMeuItem(r.dados, c.valor.versoes) };
      }),
  };
}

export type ServicoItens = ReturnType<typeof criarServicoItens>;
