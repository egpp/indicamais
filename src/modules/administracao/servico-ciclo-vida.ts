import type { ZodType } from "zod";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import { erroAdm, type ErroAdministracao } from "./erros";
import { MENSAGENS_CICLO, mapearErroBancoCiclo, type OperacaoCiclo } from "./erros-ciclo";
import {
  maisRecentesPorCriacao,
  ordenarDenuncias,
  paraContaForaDoNormal,
  paraDecisaoDeDenuncia,
  paraDenunciaNaFila,
  paraIndicacaoInvalidada,
  paraMinhasPermissoes,
  paraPermissaoConcedida,
  type ContaForaDoNormal,
  type DecisaoDeDenuncia,
  type DenunciaNaFila,
  type IndicacaoInvalidada,
  type LinhaContaCicloVida,
  type LinhaDenunciaDecisao,
  type LinhaDenunciaFila,
  type LinhaIndicacaoInvalidada,
  type LinhaMinhaPermissao,
  type LinhaPermissaoConcedida,
  type PermissaoConcedida,
} from "./ciclo-modelos";
import {
  contaMotivoSchema,
  decidirDenunciaSchema,
  denunciarSchema,
  invalidarIndicacaoSchema,
  permissaoContaSchema,
  type Permissao,
} from "./ciclo-schemas";

export type Resultado<T> = ResultadoBase<T, ErroAdministracao>;

/**
 * Banco injetado. Sessão do usuário (ou anônima, só em `denunciar`); NUNCA service_role. Cada método é uma chamada
 * 1:1 a RPC ou visão das migrações 20261102*; o adaptador real fica em src/app/_lib/banco-administracao-ciclo.ts.
 * As visões já filtram por permissão no banco: sem permissão devolvem zero linhas.
 */
export interface ClienteBancoCicloVida {
  /** select de administracao_minhas_permissoes. */
  listarMinhasPermissoes(): Promise<RespostaBanco<LinhaMinhaPermissao[]>>;
  /** select de administracao_permissoes_concedidas (só administrador geral). */
  listarPermissoesConcedidas(): Promise<RespostaBanco<LinhaPermissaoConcedida[]>>;
  /** rpc administracao_conceder_permissao(p_conta, p_permissao, p_motivo). */
  concederPermissao(a: {
    contaId: string;
    permissao: Permissao;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc administracao_revogar_permissao(p_conta, p_permissao, p_motivo). */
  revogarPermissao(a: {
    contaId: string;
    permissao: Permissao;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc administracao_denunciar(p_alvo_tipo, p_alvo_id, p_tipo, p_texto, p_origem, p_site). Anônimo pode chamar. */
  denunciar(a: {
    alvoTipo: string;
    alvoId: string;
    tipo: string;
    texto: string | null;
    origem: string | null;
    site: string | null;
  }): Promise<{ erro: ErroBanco | null }>;
  /** select de administracao_fila_denuncias (permissão analisar_denuncias). */
  listarFilaDenuncias(): Promise<RespostaBanco<LinhaDenunciaFila[]>>;
  /** select de administracao_denuncia_decisoes. */
  listarDecisoesDenuncia(): Promise<RespostaBanco<LinhaDenunciaDecisao[]>>;
  /** rpc administracao_decidir_denuncia(p_denuncia_id, p_decisao, p_motivo). */
  decidirDenuncia(a: {
    denunciaId: string;
    decisao: string;
    motivo: string;
  }): Promise<{ erro: ErroBanco | null }>;
  /** rpc administracao_suspender_conta(p_conta, p_motivo). */
  suspenderConta(a: { contaId: string; motivo: string }): Promise<{ erro: ErroBanco | null }>;
  /** rpc administracao_reativar_conta(p_conta, p_motivo). */
  reativarConta(a: { contaId: string; motivo: string }): Promise<{ erro: ErroBanco | null }>;
  /** select de administracao_contas_ciclo_vida (permissão suspender). */
  listarContasCicloVida(): Promise<RespostaBanco<LinhaContaCicloVida[]>>;
  /** rpc administracao_invalidar_indicacao(p_pedido_id, p_motivo, p_confirmar_saldo_negativo) -> id da reversão ou null. */
  invalidarIndicacao(a: {
    pedidoId: string;
    motivo: string;
    confirmarSaldoNegativo: boolean;
  }): Promise<RespostaBanco<string>>;
  /** select de administracao_indicacoes_invalidadas (permissão invalidar_indicacoes). */
  listarIndicacoesInvalidadas(): Promise<RespostaBanco<LinhaIndicacaoInvalidada[]>>;
}

/**
 * PONTO DE EXTENSÃO (D-014, IM-080): o bloqueio de acesso (banned_until na Admin API do Supabase) exige service_role e
 * por isso NÃO roda neste módulo. A camada de servidor injeta um aplicador que faz isso (ou a rotina do devops). Falha
 * aqui nunca desfaz a suspensão gravada no banco (o servidor também consulta contas_meu_estado a cada requisição).
 */
export interface AplicadorBloqueioAcesso {
  aoSuspender(contaId: string): Promise<void>;
  aoReativar(contaId: string): Promise<void>;
}
export const APLICADOR_BLOQUEIO_NULO: AplicadorBloqueioAcesso = {
  async aoSuspender() {},
  async aoReativar() {},
};

const M = MENSAGENS_CICLO;
const falha = (erro: ErroAdministracao): { ok: false; erro: ErroAdministracao } => ({
  ok: false,
  erro,
});

export function criarServicoCicloVida(
  banco: ClienteBancoCicloVida,
  opcoes: { aplicadorBloqueio?: AplicadorBloqueioAcesso } = {},
) {
  const aplicador = opcoes.aplicadorBloqueio ?? APLICADOR_BLOQUEIO_NULO;

  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroAdm("ERRO_INTERNO", M.generica));
    }
  }

  /** Valida a entrada no limite do módulo; erro de validação nunca chega ao banco. */
  function validar<S extends ZodType>(
    schema: S,
    entrada: unknown,
  ): { ok: true; dados: ReturnType<S["parse"]> } | { ok: false; erro: ErroAdministracao } {
    const p = schema.safeParse(entrada);
    if (p.success) return { ok: true, dados: p.data as ReturnType<S["parse"]> };
    const campos = errosPorCampo(p.error);
    const motivoFaltando = "motivo" in campos;
    return {
      ok: false,
      erro: erroAdm(
        motivoFaltando ? "MOTIVO_OBRIGATORIO" : "VALIDACAO",
        Object.values(campos)[0] ?? M.dadosInvalidos,
        campos,
      ),
    };
  }

  async function lista<L, T>(
    ler: () => Promise<RespostaBanco<L[]>>,
    mapear: (l: L) => T | null,
    op: OperacaoCiclo = "leitura",
  ): Promise<Resultado<T[]>> {
    const r = await ler();
    if (r.erro) return falha(mapearErroBancoCiclo(r.erro, op));
    const itens: T[] = [];
    for (const l of r.dados ?? []) {
      const m = mapear(l);
      if (m) itens.push(m);
    }
    return { ok: true, valor: itens };
  }

  async function executar(
    op: OperacaoCiclo,
    chamar: () => Promise<{ erro: ErroBanco | null }>,
  ): Promise<Resultado<null>> {
    const r = await chamar();
    if (r.erro) return falha(mapearErroBancoCiclo(r.erro, op));
    return { ok: true, valor: null };
  }

  return {
    // Permissões (IM-077) -----------------------------------------------------------------------------------------

    /** Permissões da conta logada (o administrador geral recebe as seis). Sem login ou sem nenhuma: lista vazia. */
    listarMinhasPermissoes: (): Promise<Resultado<Permissao[]>> =>
      seguro(async () => {
        const r = await banco.listarMinhasPermissoes();
        if (r.erro) return falha(mapearErroBancoCiclo(r.erro, "leitura"));
        return { ok: true, valor: paraMinhasPermissoes(r.dados ?? []) };
      }),

    /** Quem tem o quê. Só o administrador geral vê (para os demais o banco devolve zero linhas). */
    listarPermissoesConcedidas: (): Promise<Resultado<PermissaoConcedida[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarPermissoesConcedidas(), paraPermissaoConcedida);
        return r.ok ? { ok: true, valor: maisRecentesPorCriacao(r.valor) } : r;
      }),

    /** Só o administrador geral. Motivo obrigatório; idempotente; auditada no banco. */
    concederPermissao: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const v = validar(permissaoContaSchema, entrada);
        if (!v.ok) return falha(v.erro);
        return executar("permissao", () => banco.concederPermissao(v.dados));
      }),

    revogarPermissao: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const v = validar(permissaoContaSchema, entrada);
        if (!v.ok) return falha(v.erro);
        return executar("permissao", () => banco.revogarPermissao(v.dados));
      }),

    // Denúncias (IM-076) ------------------------------------------------------------------------------------------

    /**
     * Qualquer pessoa, logada ou não. A resposta de sucesso é SEMPRE a mesma mensagem neutra, seja a denúncia nova,
     * repetida, de alvo inexistente ou do robô (campo-armadilha `site` preenchido: nem chega ao banco). Só entrada
     * malformada e limite de tentativas (P0429) têm resposta diferente.
     */
    denunciar: (entrada: unknown): Promise<Resultado<{ mensagem: string }>> =>
      seguro(async () => {
        const v = validar(denunciarSchema, entrada);
        if (!v.ok) {
          return falha(erroAdm("VALIDACAO", M.denunciaInvalida, v.erro.campos));
        }
        const d = v.dados;
        const aceita: Resultado<{ mensagem: string }> = {
          ok: true,
          valor: { mensagem: M.denunciaRecebida },
        };
        if (d.site && d.site.trim().length > 0) return aceita;
        const r = await banco.denunciar({
          alvoTipo: d.alvoTipo,
          alvoId: d.alvoId,
          tipo: d.tipo,
          texto: d.texto ?? null,
          origem: d.origem ?? null,
          site: null,
        });
        if (r.erro) return falha(mapearErroBancoCiclo(r.erro, "denunciar"));
        return aceita;
      }),

    /** Fila para quem tem `analisar_denuncias`. Abertas primeiro; denunciante só como tipo e chave opaca. */
    listarFilaDenuncias: (): Promise<Resultado<DenunciaNaFila[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarFilaDenuncias(), paraDenunciaNaFila);
        return r.ok ? { ok: true, valor: ordenarDenuncias(r.valor) } : r;
      }),

    listarDecisoesDenuncia: (): Promise<Resultado<DecisaoDeDenuncia[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarDecisoesDenuncia(), paraDecisaoDeDenuncia);
        return r.ok ? { ok: true, valor: maisRecentesPorCriacao(r.valor) } : r;
      }),

    /** em_analise, procedente ou improcedente; motivo obrigatório. Não executa nenhuma suspensão (D-014). */
    decidirDenuncia: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const v = validar(decidirDenunciaSchema, entrada);
        if (!v.ok) return falha(v.erro);
        return executar("decidir_denuncia", () => banco.decidirDenuncia(v.dados));
      }),

    // Suspensão e reativação (IM-080) ----------------------------------------------------------------------------

    /** Permissão `suspender`. Nada é automático: só roda por ação explícita com motivo. */
    suspenderConta: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const v = validar(contaMotivoSchema, entrada);
        if (!v.ok) return falha(v.erro);
        const r = await executar("suspender", () => banco.suspenderConta(v.dados));
        if (r.ok) {
          try {
            await aplicador.aoSuspender(v.dados.contaId);
          } catch {
            // O banco já bloqueia o acesso (contas_meu_estado); o banimento no Auth é reforço.
          }
        }
        return r;
      }),

    /** Reativada, os perfis voltam despublicados (o responsável republica). */
    reativarConta: (entrada: unknown): Promise<Resultado<null>> =>
      seguro(async () => {
        const v = validar(contaMotivoSchema, entrada);
        if (!v.ok) return falha(v.erro);
        const r = await executar("reativar", () => banco.reativarConta(v.dados));
        if (r.ok) {
          try {
            await aplicador.aoReativar(v.dados.contaId);
          } catch {
            // Falha ao desfazer o banimento não desfaz a reativação; o devops/servidor reaplica.
          }
        }
        return r;
      }),

    /** Contas suspensas, em carência de encerramento ou anonimizadas. Sem nome, telefone nem e-mail. */
    listarContasCicloVida: (): Promise<Resultado<ContaForaDoNormal[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarContasCicloVida(), paraContaForaDoNormal);
        return r.ok
          ? {
              ok: true,
              valor: [...r.valor].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
            }
          : r;
      }),

    // Invalidar indicação (IM-077, IM-035, IM-078) ---------------------------------------------------------------

    /**
     * Permissão `invalidar_indicacoes`. Reverte só os pontos do pedido (não mexe na base de relacionamento nem no
     * pedido, IM-042). P0410 (saldo ficaria negativo) volta como SALDO_NEGATIVO; repetir com
     * `confirmarSaldoNegativo: true` depois da análise. Idempotente. `reversaoId` é null se não havia crédito.
     */
    invalidarIndicacao: (entrada: unknown): Promise<Resultado<{ reversaoId: string | null }>> =>
      seguro(async () => {
        const v = validar(invalidarIndicacaoSchema, entrada);
        if (!v.ok) return falha(v.erro);
        const r = await banco.invalidarIndicacao({
          pedidoId: v.dados.pedidoId,
          motivo: v.dados.motivo,
          confirmarSaldoNegativo: v.dados.confirmarSaldoNegativo === true,
        });
        if (r.erro) return falha(mapearErroBancoCiclo(r.erro, "invalidar"));
        return { ok: true, valor: { reversaoId: r.dados ?? null } };
      }),

    listarIndicacoesInvalidadas: (): Promise<Resultado<IndicacaoInvalidada[]>> =>
      seguro(async () => {
        const r = await lista(() => banco.listarIndicacoesInvalidadas(), paraIndicacaoInvalidada);
        return r.ok ? { ok: true, valor: maisRecentesPorCriacao(r.valor) } : r;
      }),
  };
}

export type ServicoCicloVida = ReturnType<typeof criarServicoCicloVida>;
