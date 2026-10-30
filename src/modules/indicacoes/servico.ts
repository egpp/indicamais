import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import { z } from "zod";
import {
  erroIndicacoes,
  mapearErroBancoIndicacoes,
  MENSAGENS_INDICACOES,
  type ErroIndicacoes,
  type OperacaoIndicacoes,
} from "./erros";
import {
  ordenarPorMaisRecente,
  paraContatoAdmin,
  paraMeuLink,
  paraMinhaIndicacao,
  paraParametro,
  paraPedidoContato,
  type ContatoAdmin,
  type LinhaFilaContato,
  type LinhaMeuLink,
  type LinhaMeuPedido,
  type LinhaMinhaIndicacao,
  type LinhaParametro,
  type MeuLink,
  type MinhaIndicacao,
  type Parametro,
  type PedidoContato,
} from "./modelos";
import {
  compartilhamentoSchema,
  definirParametroSchema,
  enviarContatoSchema,
  gerarLinkSchema,
  reenvioAdminSchema,
  reenvioResponsavelSchema,
  tratarAlertaSchema,
  type CanalCompartilhamento,
} from "./schemas";
import {
  montarUrlIndicacao,
  origemDe,
  textoCompartilhamento,
  textoContatoVisitante,
  urlWhatsappCompartilhar,
  urlWhatsappResponsavel,
} from "./textos";

export type Resultado<T> = ResultadoBase<T, ErroIndicacoes>;

/**
 * Banco injetado. Sessão do usuário (ou anon, em enviarContato); NUNCA service_role. Cada método é uma chamada
 * 1:1 a um RPC ou visão da Fase 3; o adaptador real fica em src/app/_lib.
 */
export interface ClienteBancoIndicacoes {
  /** rpc indicacoes_gerar_link(p_perfil_id, p_item_id) -> linhas { o_codigo, o_novo }. */
  gerarLink(a: {
    perfilId: string | null;
    itemId: string | null;
  }): Promise<RespostaBanco<{ o_codigo: string; o_novo: boolean }[]>>;
  /** rpc indicacoes_registrar_compartilhamento(p_codigo, p_canal). */
  registrarCompartilhamento(a: {
    codigo: string;
    canal: CanalCompartilhamento;
  }): Promise<{ erro: ErroBanco | null }>;
  /**
   * rpc indicacoes_enviar_contato(p_perfil_id, p_item_id, p_nome, p_whatsapp, p_chave, p_email, p_mensagem,
   * p_codigo) -> linhas { o_pedido_id, o_whatsapp_responsavel, o_repetido }. Pode usar a sessão anon.
   */
  enviarContato(a: {
    perfilId: string | null;
    itemId: string | null;
    nome: string;
    whatsapp: string;
    chave: string;
    email: string | null;
    mensagem: string | null;
    codigo: string | null;
  }): Promise<
    RespostaBanco<{ o_pedido_id: string; o_whatsapp_responsavel: string; o_repetido: boolean }[]>
  >;
  /** select das colunas nomeadas de indicacoes_meus_pedidos. */
  listarMeusPedidos(): Promise<RespostaBanco<LinhaMeuPedido[]>>;
  /** select das colunas nomeadas de indicacoes_minhas_indicacoes. */
  listarMinhasIndicacoes(): Promise<RespostaBanco<LinhaMinhaIndicacao[]>>;
  /** select das colunas nomeadas de indicacoes_meus_links. */
  listarMeusLinks(): Promise<RespostaBanco<LinhaMeuLink[]>>;
  /** select das colunas nomeadas de administracao_fila_contatos (vazia para não administrador). */
  listarFilaContatos(): Promise<RespostaBanco<LinhaFilaContato[]>>;
  /** rpc indicacoes_solicitar_reenvio(p_pedido_id, p_motivo). */
  solicitarReenvio(a: {
    pedidoId: string;
    motivo: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc indicacoes_tratar_alerta(p_pedido_id, p_motivo). */
  tratarAlerta(a: { pedidoId: string; motivo: string }): Promise<{ erro: ErroBanco | null }>;
  /** select de indicacoes_parametro (RLS: só administrador enxerga linhas). */
  listarParametros(): Promise<RespostaBanco<LinhaParametro[]>>;
  /** rpc indicacoes_definir_parametro(p_chave, p_valor, p_motivo). */
  definirParametro(a: {
    chave: string;
    valor: number;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
}

export type OpcoesServicoIndicacoes = {
  /** NEXT_PUBLIC_APP_URL. Inválida/ausente: gerarLink devolve ERRO_INTERNO (nunca monta URL com host do pedido). */
  urlBase: string | null | undefined;
};

export type LinkGerado = {
  codigo: string;
  novo: boolean;
  /** Endereço público do destino com ?ind=<codigo>. Valor da opção "copiar". */
  url: string;
  /** Texto pronto (inclui a URL). */
  texto: string;
  /** https://wa.me/?text=<texto> */
  urlWhatsapp: string;
};

export type ContatoEnviado = {
  pedidoId: string;
  /** true quando a chave ou a janela anti-repetição devolveu o pedido já existente (nada duplicado). */
  repetido: boolean;
  /** https://wa.me/<número do responsável sem +>?text=<mensagem curta>. */
  urlWhatsappResponsavel: string;
};

const M = MENSAGENS_INDICACOES;
const falha = (erro: ErroIndicacoes): { ok: false; erro: ErroIndicacoes } => ({ ok: false, erro });

function falhaValidacao(erro: z.ZodError): { ok: false; erro: ErroIndicacoes } {
  const campos = errosPorCampo(erro);
  return falha(erroIndicacoes("VALIDACAO", Object.values(campos)[0] ?? M.dadosInvalidos, campos));
}

export function criarServicoIndicacoes(
  banco: ClienteBancoIndicacoes,
  opcoes: OpcoesServicoIndicacoes,
) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroIndicacoes("ERRO_INTERNO", M.generica));
    }
  }

  async function lista<L, T>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
    ordenar: (xs: T[]) => T[],
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoIndicacoes(r.erro, "leitura"));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: ordenar(itens) };
  }

  async function simples(
    chamar: () => Promise<{ erro: ErroBanco | null }>,
    op: OperacaoIndicacoes,
  ): Promise<Resultado<null>> {
    const r = await chamar();
    return r.erro ? falha(mapearErroBancoIndicacoes(r.erro, op)) : { ok: true, valor: null };
  }

  return {
    /**
     * IM-024: gera (ou devolve) o link do indicador para o destino. Autoindicação, destino indisponível,
     * indicador sem WhatsApp e não autenticado voltam como erros tipados.
     */
    gerarLink: (entrada: unknown): Promise<Resultado<LinkGerado>> =>
      seguro(async () => {
        const p = gerarLinkSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const origem = origemDe(opcoes.urlBase);
        if (!origem) return falha(erroIndicacoes("ERRO_INTERNO", M.linkIndisponivel));
        const d = p.data;
        const r = await banco.gerarLink({
          perfilId: d.tipo === "perfil" ? d.id : null,
          itemId: d.tipo === "item" ? d.id : null,
        });
        if (r.erro) return falha(mapearErroBancoIndicacoes(r.erro, "gerar_link"));
        const linha = r.dados?.[0];
        if (!linha || !/^[0-9a-f]{32}$/.test(linha.o_codigo)) {
          return falha(erroIndicacoes("ERRO_INTERNO", M.generica));
        }
        const url = montarUrlIndicacao(origem, d, linha.o_codigo);
        const texto = textoCompartilhamento(d.nome, url);
        return {
          ok: true,
          valor: {
            codigo: linha.o_codigo,
            novo: linha.o_novo,
            url,
            texto,
            urlWhatsapp: urlWhatsappCompartilhar(texto),
          },
        };
      }),

    /** IM-024/IM-025: registra que o indicador compartilhou (informado pelo cliente; não pontua). */
    registrarCompartilhamento: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = compartilhamentoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.registrarCompartilhamento(p.data), "compartilhar");
      }),

    /**
     * IM-026/IM-028: pedido de contato do visitante. A chave de idempotência vem do formulário e é reenviada
     * igual em nova tentativa. Devolve o endereço do WhatsApp do responsável para o redirecionamento.
     */
    enviarContato: (entrada: unknown): Promise<Resultado<ContatoEnviado>> =>
      seguro(async () => {
        const p = enviarContatoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const d = p.data;
        const r = await banco.enviarContato({
          perfilId: d.perfilId ?? null,
          itemId: d.itemId ?? null,
          nome: d.nome,
          whatsapp: d.whatsapp,
          chave: d.chave,
          email: d.email ?? null,
          mensagem: d.mensagem ?? null,
          codigo: d.codigo ?? null,
        });
        if (r.erro) return falha(mapearErroBancoIndicacoes(r.erro, "contato"));
        const linha = r.dados?.[0];
        if (!linha) return falha(erroIndicacoes("ERRO_INTERNO", M.generica));
        const url = urlWhatsappResponsavel(
          linha.o_whatsapp_responsavel,
          textoContatoVisitante(d.nome, d.nomeDestino),
        );
        // O pedido já está registrado e o responsável será notificado; só o redirecionamento falhou.
        if (!url) return falha(erroIndicacoes("ERRO_INTERNO", M.generica));
        return {
          ok: true,
          valor: {
            pedidoId: linha.o_pedido_id,
            repetido: linha.o_repetido,
            urlWhatsappResponsavel: url,
          },
        };
      }),

    /** IM-027: pedidos dos destinos do responsável (mais recentes primeiro). */
    listarMeusPedidos: (): Promise<Resultado<PedidoContato[]>> =>
      seguro(() =>
        lista(() => banco.listarMeusPedidos(), paraPedidoContato, ordenarPorMaisRecente),
      ),

    /** IM-029: indicações do indicador, SEM dados do visitante. */
    listarMinhasIndicacoes: (): Promise<Resultado<MinhaIndicacao[]>> =>
      seguro(() =>
        lista(() => banco.listarMinhasIndicacoes(), paraMinhaIndicacao, ordenarPorMaisRecente),
      ),

    listarMeusLinks: (): Promise<Resultado<MeuLink[]>> =>
      seguro(() => lista(() => banco.listarMeusLinks(), paraMeuLink, ordenarPorMaisRecente)),

    /** Fila do administrador. `somenteAlertasAbertos` filtra alerta_estado = 'aberto'. */
    filaContatosAdmin: (
      opcao: { somenteAlertasAbertos?: boolean } = {},
    ): Promise<Resultado<ContatoAdmin[]>> =>
      seguro(async () => {
        const r = await lista(
          () => banco.listarFilaContatos(),
          paraContatoAdmin,
          ordenarPorMaisRecente,
        );
        if (!r.ok || !opcao.somenteAlertasAbertos) return r;
        return { ok: true, valor: r.valor.filter((c) => c.alertaEstado === "aberto") };
      }),

    /** IM-028: responsável pede novo envio depois de falha. */
    solicitarReenvio: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = reenvioResponsavelSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(
          () => banco.solicitarReenvio({ pedidoId: p.data.pedidoId, motivo: null }),
          "reenvio",
        );
      }),

    /** IM-028: administrador força o reenvio, com motivo (auditado no banco). */
    reenviarComoAdmin: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = reenvioAdminSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.solicitarReenvio(p.data), "reenvio");
      }),

    /** IM-028: administrador marca o alerta como tratado, com motivo obrigatório. */
    tratarAlerta: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = tratarAlertaSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.tratarAlerta(p.data), "alerta");
      }),

    /** Parâmetros centrais. A RLS devolve vazio a quem não é administrador. */
    listarParametros: (): Promise<Resultado<Parametro[]>> =>
      seguro(async () => {
        const r = await banco.listarParametros();
        if (r.erro) return falha(mapearErroBancoIndicacoes(r.erro, "leitura"));
        return {
          ok: true,
          valor: (r.dados ?? []).map(paraParametro).sort((a, b) => a.chave.localeCompare(b.chave)),
        };
      }),

    /** Administrador altera um parâmetro (motivo obrigatório; faixa conferida aqui e no banco). */
    definirParametro: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = definirParametroSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const atuais = await banco.listarParametros();
        if (atuais.erro) return falha(mapearErroBancoIndicacoes(atuais.erro, "parametro"));
        const alvo = (atuais.dados ?? []).find((x) => x.chave === p.data.chave);
        if (!alvo) {
          // Não administrador vê lista vazia: trata como sem permissão, sem revelar quais chaves existem.
          return falha(
            (atuais.dados ?? []).length === 0
              ? erroIndicacoes("PERMISSAO", M.semPermissao)
              : erroIndicacoes("NAO_ENCONTRADO", M.parametroNaoEncontrado),
          );
        }
        if (p.data.valor < alvo.minimo || p.data.valor > alvo.maximo) {
          return falha(
            erroIndicacoes(
              "VALIDACAO",
              `O valor deve estar entre ${alvo.minimo} e ${alvo.maximo}.`,
              { valor: `Informe um valor entre ${alvo.minimo} e ${alvo.maximo}.` },
            ),
          );
        }
        return simples(() => banco.definirParametro(p.data), "parametro");
      }),
  };
}

export type ServicoIndicacoes = ReturnType<typeof criarServicoIndicacoes>;

/** Chave de idempotência do formulário de contato (IM-028). Gerar UMA vez por formulário e reaproveitar no reenvio. */
export function novaChaveContato(): string {
  return globalThis.crypto.randomUUID();
}
