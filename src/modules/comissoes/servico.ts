import type { ZodType } from "zod";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type { RespostaBanco, Resultado as ResultadoBase } from "@/shared/conteudo/resultado";
import {
  erroComissoes,
  mapearErroBancoComissoes,
  MENSAGENS_COMISSOES,
  type ErroComissoes,
} from "./erros";
import {
  paraComissaoDoNegocio,
  paraMeuNegocio,
  paraMeuSaldo,
  paraMinhaComissao,
  paraMinhaOferta,
  paraMinhaSituacao,
  paraSituacaoVinculo,
  paraVinculoDoNegocio,
  paraVinculoVencido,
  type ComissaoDoNegocio,
  type LinhaMeuNegocio,
  type LinhaMeuSaldo,
  type LinhaMinhaComissao,
  type LinhaMinhaOferta,
  type LinhaMinhaSituacao,
  type LinhaNegocioComissao,
  type LinhaNegocioVinculo,
  type LinhaSituacaoVinculo,
  type LinhaVinculoVencido,
  type MeuNegocio,
  type MeuSaldoComissoes,
  type MinhaComissao,
  type MinhaOferta,
  type MinhaSituacao,
  type SituacaoVinculo,
  type VinculoDoNegocio,
  type VinculoVencido,
} from "./modelos";
import {
  paraAssinaturaAdmin,
  paraComissaoAdmin,
  paraNegocioAdmin,
  paraNegocioVinculado,
  paraPagamentoAdmin,
  paraPrazoInadimplencia,
  paraVinculoAdmin,
  totalDe,
  type AssinaturaAdmin,
  type ComissaoAdmin,
  type LinhaAssinaturaAdmin,
  type LinhaComissaoAdmin,
  type LinhaNegocioAdmin,
  type LinhaNegocioVinculado,
  type LinhaPagamentoAdmin,
  type LinhaPrazoAdmin,
  type LinhaVinculoAdmin,
  type NegocioAdmin,
  type NegocioVinculado,
  type PagamentoAdmin,
  type Pagina,
  type PrazoInadimplencia,
  type VinculoAdmin,
} from "./modelos-admin";
import {
  filtroAssinaturasAdminSchema,
  filtroComissoesAdminSchema,
  filtroNegociosAdminSchema,
  filtroPagamentosAdminSchema,
  filtroVinculosAdminSchema,
} from "./schemas-admin";
import {
  alterarPercentualSchema,
  avancarRepasseSchema,
  cancelarAssinaturaSchema,
  confirmarPagamentoSchema,
  criarOfertaSchema,
  definirHabilitacaoSchema,
  definirOfertaAtivaSchema,
  definirParametroSchema,
  encerrarVinculoSchema,
  estornarPagamentoSchema,
  listarVencidosSchema,
  registrarAssinaturaSchema,
  registrarVinculoSchema,
  reverterComissaoSchema,
} from "./schemas";

export type Resultado<T> = ResultadoBase<T, ErroComissoes>;

/**
 * Banco injetado. Sessão do usuário (administrador ou responsável); NUNCA service_role. Cada método é uma chamada 1:1
 * a RPC ou visão das migrações 20261105*; as autorizações (admin, responsável, módulo habilitado) são do banco, que
 * é a fonte da verdade (IM-086). O adaptador real chama `supabase.rpc(...)`/`from(...)` e fica fora deste módulo.
 */
export interface ClienteBancoComissoes {
  // Administrador
  definirParametro(a: {
    chave: string;
    valor: number;
    motivo: string;
  }): Promise<RespostaBanco<null>>;
  definirHabilitacao(a: {
    perfilId: string;
    ativa: boolean;
    origem: "espontanea" | "solicitacao";
    motivo: string;
  }): Promise<RespostaBanco<number | string>>;
  registrarVinculo(a: {
    perfilId: string;
    indicadorId: string;
    clienteId: string;
    motivo: string;
  }): Promise<RespostaBanco<string>>;
  registrarAssinatura(a: {
    ofertaId: string;
    clienteId: string;
    valorCentavos: number;
    inicio: string;
    fim: string | null;
    motivo: string;
  }): Promise<RespostaBanco<string>>;
  cancelarAssinatura(a: { assinaturaId: string; motivo: string }): Promise<RespostaBanco<null>>;
  confirmarPagamento(a: {
    assinaturaId: string;
    competencia: string;
    valorCentavos: number;
    motivo: string;
  }): Promise<RespostaBanco<string>>;
  estornarPagamento(a: {
    pagamentoId: string;
    motivo: string;
    confirmarJaPaga: boolean;
  }): Promise<RespostaBanco<string | null>>;
  reverterComissao(a: {
    comissaoId: string;
    causa: string;
    motivo: string;
    confirmarJaPaga: boolean;
  }): Promise<RespostaBanco<string>>;
  avancarRepasse(a: {
    comissaoId: string;
    estado: string;
    motivo: string;
  }): Promise<RespostaBanco<number | string>>;
  listarVinculosVencidos(a: {
    perfilId: string | null;
  }): Promise<RespostaBanco<LinhaVinculoVencido[]>>;
  encerrarVinculo(a: { vinculoId: string; motivo: string }): Promise<RespostaBanco<null>>;
  // Anunciante (responsável pelo negócio)
  criarOferta(a: {
    perfilId: string;
    itemId: string;
    nome: string;
    percentualBp: number;
  }): Promise<RespostaBanco<string>>;
  alterarPercentualOferta(a: {
    ofertaId: string;
    percentualBp: number;
  }): Promise<RespostaBanco<number | string>>;
  definirOfertaAtiva(a: {
    ofertaId: string;
    ativa: boolean;
  }): Promise<RespostaBanco<number | string>>;
  // Leituras do administrador (rpc comissoes_admin_*; o banco confere o administrador, 42501 para os demais)
  listarNegociosAdmin(a: {
    estado: string | null;
    busca: string | null;
    limite: number;
    deslocamento: number;
  }): Promise<RespostaBanco<LinhaNegocioAdmin[]>>;
  listarAssinaturasAdmin(a: {
    perfilId: string | null;
    situacao: string | null;
    limite: number;
    deslocamento: number;
  }): Promise<RespostaBanco<LinhaAssinaturaAdmin[]>>;
  listarPagamentosAdmin(a: {
    perfilId: string | null;
    estado: string | null;
    limite: number;
    deslocamento: number;
  }): Promise<RespostaBanco<LinhaPagamentoAdmin[]>>;
  listarComissoesAdmin(a: {
    perfilId: string | null;
    estado: string | null;
    limite: number;
    deslocamento: number;
  }): Promise<RespostaBanco<LinhaComissaoAdmin[]>>;
  listarVinculosAdmin(a: {
    perfilId: string | null;
    situacao: string | null;
    limite: number;
    deslocamento: number;
  }): Promise<RespostaBanco<LinhaVinculoAdmin[]>>;
  lerPrazoInadimplencia(): Promise<RespostaBanco<LinhaPrazoAdmin[]>>;
  /** rpc comissoes_meus_negocios_vinculados(): nome público dos negócios onde o indicador tem vínculo */
  listarNegociosVinculados(): Promise<RespostaBanco<LinhaNegocioVinculado[]>>;
  // Leituras (visões com filtro fixo por auth.uid() no banco)
  listarMinhasComissoes(): Promise<RespostaBanco<LinhaMinhaComissao[]>>;
  lerMeuSaldo(): Promise<RespostaBanco<LinhaMeuSaldo[]>>;
  listarMinhasSituacoes(): Promise<RespostaBanco<LinhaMinhaSituacao[]>>;
  listarMeusNegocios(): Promise<RespostaBanco<LinhaMeuNegocio[]>>;
  listarMinhasOfertas(): Promise<RespostaBanco<LinhaMinhaOferta[]>>;
  listarNegocioComissoes(): Promise<RespostaBanco<LinhaNegocioComissao[]>>;
  listarNegocioVinculos(): Promise<RespostaBanco<LinhaNegocioVinculo[]>>;
  /** rpc comissoes_situacoes_como_indicador() */
  listarSituacoesComoIndicador(): Promise<RespostaBanco<LinhaSituacaoVinculo[]>>;
  /** rpc comissoes_situacoes_como_responsavel() */
  listarSituacoesComoResponsavel(): Promise<RespostaBanco<LinhaSituacaoVinculo[]>>;
}

export type OpcoesServicoComissoes = {
  /** Relógio injetável (testes). Padrão: agora. A data comparada é UTC, como no banco. */
  agora?: () => Date;
};

const M = MENSAGENS_COMISSOES;
const falha = (erro: ErroComissoes): { ok: false; erro: ErroComissoes } => ({ ok: false, erro });
const MAIS_RECENTES = <T extends { criadaEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));

export function criarServicoComissoes(
  banco: ClienteBancoComissoes,
  opcoes: OpcoesServicoComissoes = {},
) {
  const agora = opcoes.agora ?? (() => new Date());

  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroComissoes("ERRO_INTERNO", M.generica));
    }
  }

  /** Valida a entrada no limite do módulo; só depois toca o banco. */
  function acao<S, T>(
    schema: ZodType<S>,
    entrada: unknown,
    chamar: (a: S) => Promise<Resultado<T>>,
  ): Promise<Resultado<T>> {
    return seguro(async () => {
      const p = schema.safeParse(entrada);
      if (!p.success) {
        const campos = errosPorCampo(p.error);
        return falha(
          erroComissoes("VALIDACAO", Object.values(campos)[0] ?? M.dadosInvalidos, campos),
        );
      }
      return chamar(p.data);
    });
  }

  /** Ação sem retorno de dados. */
  const semRetorno = async (r: RespostaBanco<unknown>): Promise<Resultado<{ feito: true }>> =>
    r.erro ? falha(mapearErroBancoComissoes(r.erro)) : { ok: true, valor: { feito: true } };

  /** Ação que devolve o id do registro criado. */
  const comId = async (r: RespostaBanco<string | null>): Promise<Resultado<{ id: string }>> => {
    if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
    if (!r.dados) return falha(erroComissoes("ERRO_INTERNO", M.generica));
    return { ok: true, valor: { id: r.dados } };
  };

  async function lista<L, T>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: itens };
  }

  /** Lista paginada do administrador: o total vem do banco (`o_total`); linhas inválidas são descartadas. */
  async function paginaAdmin<L extends { o_total: number }, T>(
    ler: (limite: number, deslocamento: number) => Promise<RespostaBanco<L[]>>,
    limite: number,
    pagina: number,
    mapear: (l: L) => T | null,
  ): Promise<Resultado<Pagina<T>>> {
    const deslocamento = (pagina - 1) * limite;
    const r = await ler(limite, deslocamento);
    if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
    const linhas = r.dados ?? [];
    const itens: T[] = [];
    for (const l of linhas) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: { itens, total: totalDe(linhas), limite, deslocamento } };
  }

  return {
    // ---------------------------------------------------------------- Administrador (IM-064, IM-068, IM-070, IM-072, IM-073)

    /** IM-068: só o administrador muda o prazo de inadimplência; faixa validada pelo banco; motivo auditado. */
    definirParametro: (entrada: unknown) =>
      acao(definirParametroSchema, entrada, async (a) =>
        semRetorno(await banco.definirParametro(a)),
      ),

    /** IM-061, IM-063: habilita ou desabilita o módulo no negócio. Desabilitar preserva saldos e histórico (IM-073). */
    definirHabilitacao: (entrada: unknown) =>
      acao(definirHabilitacaoSchema, entrada, async (a) =>
        semRetorno(await banco.definirHabilitacao(a)),
      ),

    /** IM-066, D-026: vínculo indicador -> cliente (com conta) registrado manualmente. */
    registrarVinculo: (entrada: unknown) =>
      acao(registrarVinculoSchema, entrada, async (a) => comId(await banco.registrarVinculo(a))),

    /** IM-062, IM-064, IM-071: assinatura recorrente mensal registrada manualmente (valor em centavos). */
    registrarAssinatura: (entrada: unknown) =>
      acao(registrarAssinaturaSchema, entrada, async (a) =>
        comId(await banco.registrarAssinatura({ ...a, fim: a.fim ?? null })),
      ),

    /** D-026: cancelar bloqueia só comissões futuras; não reverte o último mês. */
    cancelarAssinatura: (entrada: unknown) =>
      acao(cancelarAssinaturaSchema, entrada, async (a) =>
        semRetorno(await banco.cancelarAssinatura(a)),
      ),

    /**
     * IM-064, IM-069, IM-070: confirma o pagamento mensal (competência AAAA-MM). Idempotente: repetir devolve o mesmo
     * pagamento. A comissão nasce no banco, na mesma transação, se o indicador estiver em dia (IM-066, IM-071).
     */
    confirmarPagamento: (entrada: unknown) =>
      acao(confirmarPagamentoSchema, entrada, async (a) =>
        comId(await banco.confirmarPagamento(a)),
      ),

    /**
     * IM-073: estorna o pagamento; a comissão gerada é revertida por lançamento novo. Comissão já paga exige
     * `confirmarJaPaga: true`; sem isso o banco recusa (CONFIRMACAO_NECESSARIA) e nada é gravado. `reversaoId` é
     * nulo se o pagamento não gerou comissão.
     */
    estornarPagamento: (entrada: unknown) =>
      acao(
        estornarPagamentoSchema,
        entrada,
        async (a): Promise<Resultado<{ reversaoId: string | null }>> => {
          const r = await banco.estornarPagamento(a);
          if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
          return { ok: true, valor: { reversaoId: r.dados ?? null } };
        },
      ),

    /** IM-073: reversão (cancelamento, estorno ou correção) por lançamento novo; histórico nunca é apagado. */
    reverterComissao: (entrada: unknown) =>
      acao(reverterComissaoSchema, entrada, async (a) => {
        const r = await comId(await banco.reverterComissao(a));
        return r.ok ? { ok: true as const, valor: { reversaoId: r.valor.id } } : r;
      }),

    /** IM-064, IM-070: repasse manual (gerada -> pendente_repasse -> paga). Nada é pago automaticamente (IM-090). */
    avancarRepasse: (entrada: unknown) =>
      acao(avancarRepasseSchema, entrada, async (a) => semRetorno(await banco.avancarRepasse(a))),

    /** IM-068, IM-072: vínculos com prazo de inadimplência vencido. Só lista; encerrar é decisão do administrador. */
    listarVinculosVencidos: (entrada: unknown = {}): Promise<Resultado<VinculoVencido[]>> =>
      acao(listarVencidosSchema, entrada, (a) =>
        lista(
          () => banco.listarVinculosVencidos({ perfilId: a.perfilId ?? null }),
          paraVinculoVencido,
        ),
      ),

    /** IM-072: encerra UM vínculo vencido, sem transferir indicados nem restaurar sozinho. Nunca em lote automático. */
    encerrarVinculo: (entrada: unknown) =>
      acao(encerrarVinculoSchema, entrada, async (a) => semRetorno(await banco.encerrarVinculo(a))),

    // ---------------------------------------------------------------- Leituras do administrador (IM-061 a IM-073)
    // Ids de conta só para o administrador agir; nunca nome, telefone ou e-mail (IM-029, IM-041, IM-050).

    /** IM-061: negócios com o estado do módulo (habilitado ou não), com busca por nome público ou slug. */
    adminNegocios: (entrada: unknown = {}): Promise<Resultado<Pagina<NegocioAdmin>>> =>
      acao(filtroNegociosAdminSchema, entrada, (f) =>
        paginaAdmin(
          (limite, deslocamento) =>
            banco.listarNegociosAdmin({
              estado: f.estado ?? null,
              busca: f.busca ?? null,
              limite,
              deslocamento,
            }),
          f.limite,
          f.pagina,
          paraNegocioAdmin,
        ),
      ),

    /** IM-062, IM-064: assinaturas registradas (situação derivada no banco: ativa, encerrada, cancelada). */
    adminAssinaturas: (entrada: unknown = {}): Promise<Resultado<Pagina<AssinaturaAdmin>>> =>
      acao(filtroAssinaturasAdminSchema, entrada, (f) =>
        paginaAdmin(
          (limite, deslocamento) =>
            banco.listarAssinaturasAdmin({
              perfilId: f.perfilId ?? null,
              situacao: f.situacao ?? null,
              limite,
              deslocamento,
            }),
          f.limite,
          f.pagina,
          paraAssinaturaAdmin,
        ),
      ),

    /** IM-064, IM-070, IM-073: pagamentos confirmados e estornados, por competência. */
    adminPagamentos: (entrada: unknown = {}): Promise<Resultado<Pagina<PagamentoAdmin>>> =>
      acao(filtroPagamentosAdminSchema, entrada, (f) =>
        paginaAdmin(
          (limite, deslocamento) =>
            banco.listarPagamentosAdmin({
              perfilId: f.perfilId ?? null,
              estado: f.estado ?? null,
              limite,
              deslocamento,
            }),
          f.limite,
          f.pagina,
          paraPagamentoAdmin,
        ),
      ),

    /** IM-064, IM-069, IM-073: comissões com percentual e base congelados, repasse e reversão. */
    adminComissoes: (entrada: unknown = {}): Promise<Resultado<Pagina<ComissaoAdmin>>> =>
      acao(filtroComissoesAdminSchema, entrada, (f) =>
        paginaAdmin(
          (limite, deslocamento) =>
            banco.listarComissoesAdmin({
              perfilId: f.perfilId ?? null,
              estado: f.estado ?? null,
              limite,
              deslocamento,
            }),
          f.limite,
          f.pagina,
          paraComissaoAdmin,
        ),
      ),

    /** IM-066, IM-072: vínculos com a data prevista de encerramento; `vencido` é derivado (relógio injetável). */
    adminVinculos: (entrada: unknown = {}): Promise<Resultado<Pagina<VinculoAdmin>>> =>
      acao(filtroVinculosAdminSchema, entrada, (f) => {
        const hoje = agora().toISOString().slice(0, 10);
        return paginaAdmin(
          (limite, deslocamento) =>
            banco.listarVinculosAdmin({
              perfilId: f.perfilId ?? null,
              situacao: f.situacao ?? null,
              limite,
              deslocamento,
            }),
          f.limite,
          f.pagina,
          (l) => paraVinculoAdmin(l, hoje),
        );
      }),

    /** IM-068, IM-072: prazo de inadimplência vigente, lido do banco (nunca fixo na tela). */
    adminPrazoInadimplencia: (): Promise<Resultado<PrazoInadimplencia>> =>
      seguro(async () => {
        const r = await banco.lerPrazoInadimplencia();
        if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
        const prazo = paraPrazoInadimplencia(r.dados?.[0]);
        return prazo ? { ok: true, valor: prazo } : falha(erroComissoes("ERRO_INTERNO", M.generica));
      }),

    // ---------------------------------------------------------------- Anunciante (IM-062, IM-063, IM-067, IM-069, IM-073)

    /** IM-062, IM-067: oferta recorrente com percentual próprio (1 a 10000 bp). Exige módulo habilitado. */
    criarOferta: (entrada: unknown) =>
      acao(criarOfertaSchema, entrada, async (a) => comId(await banco.criarOferta(a))),

    /** IM-069, IM-073: o novo percentual vale só para pagamentos confirmados depois; nada é recalculado. */
    alterarPercentualOferta: (entrada: unknown) =>
      acao(alterarPercentualSchema, entrada, async (a) =>
        semRetorno(await banco.alterarPercentualOferta(a)),
      ),

    /** IM-073: ativar/desativar oferta bloqueia só comissões futuras. */
    definirOfertaAtiva: (entrada: unknown) =>
      acao(definirOfertaAtivaSchema, entrada, async (a) =>
        semRetorno(await banco.definirOfertaAtiva(a)),
      ),

    // ---------------------------------------------------------------- Leitura do indicador (IM-029, IM-065, IM-066, IM-072)

    /** Comissões próprias, mais recentes primeiro. Cliente só como referência opaca. */
    minhasComissoes: (): Promise<Resultado<MinhaComissao[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarMinhasComissoes(), paraMinhaComissao);
        return r.ok ? { ok: true, valor: MAIS_RECENTES(r.valor) } : r;
      }),

    /** Saldo de comissões em centavos, separado do saldo de pontos (IM-065). */
    meuSaldo: (): Promise<Resultado<MeuSaldoComissoes>> =>
      seguro(async () => {
        const r = await banco.lerMeuSaldo();
        if (r.erro) return falha(mapearErroBancoComissoes(r.erro));
        return { ok: true, valor: paraMeuSaldo(r.dados?.[0]) };
      }),

    /** Situação por negócio com aviso de inadimplência (IM-072); `emAviso` é derivado, nunca copiado. */
    minhaSituacao: (): Promise<Resultado<MinhaSituacao[]>> =>
      seguro(() => {
        const hoje = agora().toISOString().slice(0, 10);
        return lista(
          () => banco.listarMinhasSituacoes(),
          (l) => paraMinhaSituacao(l, hoje),
        );
      }),

    /**
     * IM-072: nome PÚBLICO dos negócios onde o indicador tem vínculo, para os avisos de inadimplência. Nome e slug
     * são nulos se o perfil não é público (a tela usa um texto neutro).
     */
    meusNegociosVinculados: (): Promise<Resultado<NegocioVinculado[]>> =>
      seguro(() => lista(() => banco.listarNegociosVinculados(), paraNegocioVinculado)),

    situacoesComoIndicador: (): Promise<Resultado<SituacaoVinculo[]>> =>
      seguro(() => lista(() => banco.listarSituacoesComoIndicador(), paraSituacaoVinculo)),

    // ---------------------------------------------------------------- Leitura do anunciante (IM-029, IM-072, IM-073)

    meusNegocios: (): Promise<Resultado<MeuNegocio[]>> =>
      seguro(() => lista(() => banco.listarMeusNegocios(), paraMeuNegocio)),

    minhasOfertas: (): Promise<Resultado<MinhaOferta[]>> =>
      seguro(() => lista(() => banco.listarMinhasOfertas(), paraMinhaOferta)),

    /** Comissões do negócio; indicador e cliente só como referência opaca. */
    negocioComissoes: (): Promise<Resultado<ComissaoDoNegocio[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarNegocioComissoes(), paraComissaoDoNegocio);
        return r.ok ? { ok: true, valor: MAIS_RECENTES(r.valor) } : r;
      }),

    negocioVinculos: (): Promise<Resultado<VinculoDoNegocio[]>> =>
      seguro(() => lista(() => banco.listarNegocioVinculos(), paraVinculoDoNegocio)),

    situacoesComoResponsavel: (): Promise<Resultado<SituacaoVinculo[]>> =>
      seguro(() => lista(() => banco.listarSituacoesComoResponsavel(), paraSituacaoVinculo)),
  };
}

export type ServicoComissoes = ReturnType<typeof criarServicoComissoes>;
