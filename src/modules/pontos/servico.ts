import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import type { z } from "zod";
import {
  erroPontos,
  mapearErroBancoPontos,
  MENSAGENS_PONTOS,
  type ErroPontos,
  type OperacaoPontos,
} from "./erros";
import {
  montarBeneficiosDoPerfil,
  ordenarPorMaisRecente,
  paraBeneficioPendente,
  paraBeneficioPublico,
  paraDecisaoAdmin,
  paraFalhaCredito,
  paraLancamentoAdmin,
  paraMeuLancamento,
  paraMeuSaldo,
  paraParametros,
  paraSaldoAdmin,
  type BeneficioDoPerfil,
  type BeneficioPendente,
  type BeneficioPublico,
  type DecisaoAdmin,
  type FalhaCredito,
  type LancamentoAdmin,
  type LinhaBeneficioPublico,
  type LinhaDecisaoAdmin,
  type LinhaFalhaAdmin,
  type LinhaFilaBeneficio,
  type LinhaLancamentoAdmin,
  type LinhaMeuLancamento,
  type LinhaMeuSaldo,
  type LinhaParametrosAtuais,
  type LinhaSaldoAdmin,
  type LinhasBeneficiosDoPerfil,
  type MeuLancamento,
  type MeuSaldo,
  type ParametrosPontos,
  type SaldoAdmin,
} from "./modelos";
import {
  adminCadastrarBeneficioSchema,
  adminDefinirBeneficioAtivoSchema,
  criarBeneficioSchema,
  decidirBeneficioSchema,
  definirBeneficioAtivoSchema,
  definirParametroSchema,
  enviarVersaoSchema,
  perfilIdSchema,
  reprocessarPedidoSchema,
  reverterCreditoSchema,
  salvarBeneficioSchema,
  type CategoriaReversao,
  type ChaveParametroPontos,
} from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroPontos>;

/** Campos de benefício já validados, no formato das colunas (nulos onde não se aplica). */
export type CamposBeneficioBanco = {
  nome: string;
  descricao: string;
  pontosNecessarios: number;
  condicoes: string | null;
  limiteTotal: number | null;
  limitePorPessoa: number | null;
  prazoResgateAte: string | null;
  prazoUsoAte: string | null;
};

/**
 * Banco injetado. Sessão do usuário (anon na vitrine); NUNCA service_role. Cada método é uma chamada 1:1 a uma
 * visão ou RPC das migrações 20261031*; o adaptador real fica em src/app/_lib/banco-pontos.ts.
 */
export interface ClienteBancoPontos {
  /** select das colunas nomeadas de pontos_meu_saldo (uma linha, filtro fixo por auth.uid()). */
  lerMeuSaldo(): Promise<RespostaBanco<LinhaMeuSaldo[]>>;
  /** select das colunas nomeadas de pontos_meus_lancamentos. */
  listarMeusLancamentos(): Promise<RespostaBanco<LinhaMeuLancamento[]>>;
  /** rpc pontos_parametros_atuais(). */
  lerParametrosAtuais(): Promise<RespostaBanco<LinhaParametrosAtuais[]>>;
  /** rpc pontos_definir_parametro(p_chave, p_valor, p_motivo). */
  definirParametro(a: {
    chave: ChaveParametroPontos;
    valor: number;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc pontos_reverter_credito(...) -> id do lançamento de reversão. Categoria: ver adaptador. */
  reverterCredito(a: {
    lancamentoId: string;
    categoria: CategoriaReversao;
    observacao: string | null;
    confirmarSaldoNegativo: boolean;
  }): Promise<RespostaBanco<string>>;
  /** rpc pontos_reprocessar_pedido(p_pedido_id, p_motivo) -> id da decisão. */
  reprocessarPedido(a: { pedidoId: string; motivo: string }): Promise<RespostaBanco<number>>;
  /** select de administracao_pontos_lancamentos / _saldos / _decisoes / _falhas (vazias para não administrador). */
  listarLancamentosAdmin(): Promise<RespostaBanco<LinhaLancamentoAdmin[]>>;
  listarSaldosAdmin(): Promise<RespostaBanco<LinhaSaldoAdmin[]>>;
  listarDecisoesAdmin(): Promise<RespostaBanco<LinhaDecisaoAdmin[]>>;
  listarFalhasAdmin(): Promise<RespostaBanco<LinhaFalhaAdmin[]>>;

  // Benefícios
  /** select de pontos_beneficio_publico (anon pode ler). */
  listarBeneficiosPublicos(): Promise<RespostaBanco<LinhaBeneficioPublico[]>>;
  /** selects de pontos_beneficio, pontos_beneficio_versao e pontos_beneficio_revisao do perfil (RLS decide). */
  listarBeneficiosDoPerfil(perfilId: string): Promise<RespostaBanco<LinhasBeneficiosDoPerfil>>;
  /** select de administracao_fila_beneficios. */
  listarFilaBeneficios(): Promise<RespostaBanco<LinhaFilaBeneficio[]>>;
  /** rpc pontos_criar_beneficio -> { o_beneficio_id, o_versao_id }. */
  criarBeneficio(
    a: { perfilId: string } & CamposBeneficioBanco,
  ): Promise<RespostaBanco<{ o_beneficio_id: string; o_versao_id: string }[]>>;
  /** rpc pontos_salvar_beneficio -> id da versão em rascunho. */
  salvarBeneficio(
    a: { beneficioId: string } & CamposBeneficioBanco,
  ): Promise<RespostaBanco<string>>;
  /** rpc pontos_enviar_beneficio_versao(p_versao_id). */
  enviarVersao(a: { versaoId: string }): Promise<{ erro: ErroBanco | null }>;
  /** rpc pontos_definir_beneficio_ativo(p_beneficio_id, p_ativo). */
  definirBeneficioAtivo(a: {
    beneficioId: string;
    ativo: boolean;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc pontos_decidir_beneficio_versao(p_versao_id, p_aprovar, p_motivo). */
  decidirVersao(a: {
    versaoId: string;
    aprovar: boolean;
    motivo: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc pontos_admin_cadastrar_beneficio -> { o_beneficio_id, o_versao_id }. */
  adminCadastrarBeneficio(
    a: { perfilId: string; motivo: string } & CamposBeneficioBanco,
  ): Promise<RespostaBanco<{ o_beneficio_id: string; o_versao_id: string }[]>>;
  /** rpc pontos_admin_definir_beneficio_ativo(p_beneficio_id, p_ativo, p_motivo). */
  adminDefinirBeneficioAtivo(a: {
    beneficioId: string;
    ativo: boolean;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
}

export type OpcoesServicoPontos = {
  /** Relógio injetável (testes). Usado para tirar da vitrine o benefício com prazo de resgate vencido. */
  agora?: () => Date;
};

const M = MENSAGENS_PONTOS;
const falha = (erro: ErroPontos): { ok: false; erro: ErroPontos } => ({ ok: false, erro });

function falhaValidacao(erro: z.ZodError): { ok: false; erro: ErroPontos } {
  const campos = errosPorCampo(erro);
  return falha(erroPontos("VALIDACAO", Object.values(campos)[0] ?? M.dadosInvalidos, campos));
}

function camposBanco(d: CamposBeneficioBanco): CamposBeneficioBanco {
  return {
    nome: d.nome,
    descricao: d.descricao,
    pontosNecessarios: d.pontosNecessarios,
    condicoes: d.condicoes,
    limiteTotal: d.limiteTotal,
    limitePorPessoa: d.limitePorPessoa,
    prazoResgateAte: d.prazoResgateAte,
    prazoUsoAte: d.prazoUsoAte,
  };
}

export function criarServicoPontos(banco: ClienteBancoPontos, opcoes: OpcoesServicoPontos = {}) {
  const agora = opcoes.agora ?? (() => new Date());

  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroPontos("ERRO_INTERNO", M.generica));
    }
  }

  async function lista<L, T>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
    ordenar: (xs: T[]) => T[] = (xs) => xs,
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoPontos(r.erro, "leitura"));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: ordenar(itens) };
  }

  async function simples(
    chamar: () => Promise<{ erro: ErroBanco | null }>,
    op: OperacaoPontos,
  ): Promise<Resultado<null>> {
    const r = await chamar();
    return r.erro ? falha(mapearErroBancoPontos(r.erro, op)) : { ok: true, valor: null };
  }

  return {
    // Indicador ------------------------------------------------------------------------------------------------

    /** IM-035: saldo único e sem expiração do indicador logado (soma dos lançamentos). Sem lançamentos = zero. */
    meuSaldo: (): Promise<Resultado<MeuSaldo>> =>
      seguro(async () => {
        const r = await banco.lerMeuSaldo();
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "leitura"));
        return { ok: true, valor: paraMeuSaldo(r.dados?.[0]) };
      }),

    /** IM-035, IM-078: histórico do indicador (créditos e reversões), mais recente primeiro. Sem dado do visitante. */
    meusLancamentos: (): Promise<Resultado<MeuLancamento[]>> =>
      seguro(() =>
        lista(() => banco.listarMeusLancamentos(), paraMeuLancamento, ordenarPorMaisRecente),
      ),

    /** IM-030: parâmetros vigentes (quem está logado pode ler). */
    parametrosAtuais: (): Promise<Resultado<ParametrosPontos>> =>
      seguro(async () => {
        const r = await banco.lerParametrosAtuais();
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "leitura"));
        const p = paraParametros(r.dados?.[0]);
        return p ? { ok: true, valor: p } : falha(erroPontos("PERMISSAO", M.semPermissao));
      }),

    // Administrador --------------------------------------------------------------------------------------------

    /** IM-030, D-012: altera um parâmetro com motivo obrigatório (faixa e auditoria no banco). */
    definirParametro: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = definirParametroSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.definirParametro(p.data), "parametro");
      }),

    /**
     * IM-078, IM-077: reverte um crédito (novo lançamento negativo; o original não muda), categoria fixa obrigatória.
     * P0409 já revertido; P0410 pede confirmação explícita (`confirmarSaldoNegativo: true`) depois da análise.
     */
    reverterCredito: (entrada: unknown): Promise<Resultado<{ reversaoId: string }>> =>
      seguro(async () => {
        const p = reverterCreditoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.reverterCredito(p.data);
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "reversao"));
        if (!r.dados) return falha(erroPontos("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { reversaoId: r.dados } };
      }),

    /** IM-028: reavalia um pedido sem decisão (idempotente). Devolve o id da decisão. */
    reprocessarPedido: (entrada: unknown): Promise<Resultado<{ decisaoId: number }>> =>
      seguro(async () => {
        const p = reprocessarPedidoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.reprocessarPedido(p.data);
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "reprocessar"));
        if (r.dados === null) return falha(erroPontos("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { decisaoId: r.dados } };
      }),

    /** Lançamentos de todos os indicadores (indicador por referência opaca). Vazio para não administrador. */
    lancamentosAdmin: (): Promise<Resultado<LancamentoAdmin[]>> =>
      seguro(() =>
        lista(() => banco.listarLancamentosAdmin(), paraLancamentoAdmin, ordenarPorMaisRecente),
      ),

    saldosAdmin: (): Promise<Resultado<SaldoAdmin[]>> =>
      seguro(() =>
        lista(
          () => banco.listarSaldosAdmin(),
          paraSaldoAdmin,
          (xs) => [...xs].sort((a, b) => b.saldo - a.saldo),
        ),
      ),

    /** Decisões por pedido (pontuou ou não e por quê): auditoria do administrador, nunca do indicador. */
    decisoesAdmin: (
      opcao: { somenteNaoPontuadas?: boolean } = {},
    ): Promise<Resultado<DecisaoAdmin[]>> =>
      seguro(async () => {
        const r = await lista(
          () => banco.listarDecisoesAdmin(),
          paraDecisaoAdmin,
          (xs) => [...xs].sort((a, b) => Date.parse(b.decididoEm) - Date.parse(a.decididoEm)),
        );
        if (!r.ok || !opcao.somenteNaoPontuadas) return r;
        return { ok: true, valor: r.valor.filter((d) => !d.pontuado) };
      }),

    /** IM-028: falhas de crédito. `somentePendentes` = pedidos ainda sem decisão (reprocessáveis). */
    falhasAdmin: (opcao: { somentePendentes?: boolean } = {}): Promise<Resultado<FalhaCredito[]>> =>
      seguro(async () => {
        const r = await lista(
          () => banco.listarFalhasAdmin(),
          paraFalhaCredito,
          (xs) => [...xs].sort((a, b) => Date.parse(b.ultimaFalhaEm) - Date.parse(a.ultimaFalhaEm)),
        );
        if (!r.ok || !opcao.somentePendentes) return r;
        return { ok: true, valor: r.valor.filter((f) => f.pendente) };
      }),

    // Benefícios (cadastro; sem resgate, cupom ou sorteio: IM-037 e IM-038 são futuros) -----------------------------

    /** IM-036, IM-079: vitrine pública. Prazo de resgate vencido sai da vitrine (D-012). */
    listarBeneficiosPublicos: (): Promise<Resultado<BeneficioPublico[]>> =>
      seguro(() => {
        const t = agora();
        return lista(
          () => banco.listarBeneficiosPublicos(),
          (l) => paraBeneficioPublico(l, t),
          (xs) => [...xs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        );
      }),

    /** Benefícios do perfil com versões e motivo de rejeição (o responsável vê os seus; o RLS decide). */
    listarBeneficiosDoPerfil: (entrada: unknown): Promise<Resultado<BeneficioDoPerfil[]>> =>
      seguro(async () => {
        const p = perfilIdSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.listarBeneficiosDoPerfil(p.data.perfilId);
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "leitura"));
        if (!r.dados) return { ok: true, valor: [] };
        return { ok: true, valor: montarBeneficiosDoPerfil(r.dados) };
      }),

    /** O responsável propõe um benefício (rascunho). Quem decide é o administrador. */
    criarBeneficio: (
      entrada: unknown,
    ): Promise<Resultado<{ beneficioId: string; versaoId: string }>> =>
      seguro(async () => {
        const p = criarBeneficioSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.criarBeneficio({ perfilId: p.data.perfilId, ...camposBanco(p.data) });
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "beneficio"));
        const l = r.dados?.[0];
        if (!l) return falha(erroPontos("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { beneficioId: l.o_beneficio_id, versaoId: l.o_versao_id } };
      }),

    /** Salva o rascunho; em benefício aprovado cria nova versão e mantém a aprovada no ar. */
    salvarBeneficio: (entrada: unknown): Promise<Resultado<{ versaoId: string }>> =>
      seguro(async () => {
        const p = salvarBeneficioSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.salvarBeneficio({
          beneficioId: p.data.beneficioId,
          ...camposBanco(p.data),
        });
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "beneficio"));
        if (!r.dados) return falha(erroPontos("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { versaoId: r.dados } };
      }),

    /** Envia o rascunho para análise do administrador. */
    enviarVersao: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = enviarVersaoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.enviarVersao(p.data), "beneficio");
      }),

    /** O responsável liga/desliga o benefício. Ligar exige versão aprovada. */
    definirBeneficioAtivo: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = definirBeneficioAtivoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.definirBeneficioAtivo(p.data), "beneficio_ativar");
      }),

    /** Administrador: fila de versões pendentes. */
    filaBeneficios: (): Promise<Resultado<BeneficioPendente[]>> =>
      seguro(() =>
        lista(
          () => banco.listarFilaBeneficios(),
          paraBeneficioPendente,
          (xs) => [...xs].sort((a, b) => Date.parse(a.enviadaEm) - Date.parse(b.enviadaEm)),
        ),
      ),

    /** Administrador aprova ou rejeita (rejeição exige motivo). O dono nunca decide o próprio benefício. */
    decidirBeneficio: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = decidirBeneficioSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.decidirVersao(p.data), "beneficio_admin");
      }),

    /**
     * Administrador cadastra benefício já aprovado (motivo obrigatório). PENDENTE: a migração em andamento exige
     * aceite do responsável do perfil; este método segue a assinatura atual e será ajustado.
     */
    adminCadastrarBeneficio: (
      entrada: unknown,
    ): Promise<Resultado<{ beneficioId: string; versaoId: string }>> =>
      seguro(async () => {
        const p = adminCadastrarBeneficioSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const r = await banco.adminCadastrarBeneficio({
          perfilId: p.data.perfilId,
          motivo: p.data.motivo,
          ...camposBanco(p.data),
        });
        if (r.erro) return falha(mapearErroBancoPontos(r.erro, "beneficio_admin"));
        const l = r.dados?.[0];
        if (!l) return falha(erroPontos("ERRO_INTERNO", M.generica));
        return { ok: true, valor: { beneficioId: l.o_beneficio_id, versaoId: l.o_versao_id } };
      }),

    /** Administrador liga/desliga qualquer benefício, com motivo (auditado). */
    adminDefinirBeneficioAtivo: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const p = adminDefinirBeneficioAtivoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        return simples(() => banco.adminDefinirBeneficioAtivo(p.data), "beneficio_ativar");
      }),
  };
}

export type ServicoPontos = ReturnType<typeof criarServicoPontos>;
