import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoPontos } from "@/modules/pontos";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js do módulo pontos (Fase 4). Usa a SESSÃO do usuário (anon na vitrine): RLS e as visões do
 * banco decidem o que cada um vê. Nunca recebe service_role. Colunas SEMPRE nomeadas. Erros viram `ErroBanco`
 * (código para classificação); o texto ao usuário é sempre do módulo.
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_PONTOS = {
  meuSaldo: "saldo, total_creditado, total_revertido, ultimo_lancamento_em",
  meusLancamentos:
    "id, tipo, pontos, situacao, destino_tipo, destino_id, destino_nome, categoria, original_id, criado_em",
  lancamentosAdmin:
    "id, indicador_ref, tipo, pontos, situacao, destino_tipo, destino_id, destino_nome, categoria, motivo, original_id, pedido_id, confirmou_saldo_negativo, criado_em",
  saldosAdmin: "indicador_ref, saldo, total_creditado, total_revertido, ultimo_lancamento_em",
  decisoesAdmin:
    "id, pedido_id, pedido_criado_em, destino_tipo, destino_id, indicador_ref, pontuado, motivo, pontos, intervalo_dias, decidido_em",
  falhasAdmin: "pedido_id, falhas, ultima_falha_em, ultimo_erro, pendente",
  beneficioPublico:
    "id, perfil_id, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias, criado_em",
  beneficio: "id, perfil_id, ativo, versao_aprovada_id, criado_em",
  beneficioVersao:
    "id, beneficio_id, situacao, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias, origem, criado_em, enviada_em",
  beneficioRevisao: "versao_id, decisao, motivo, decidida_em",
  filaBeneficios: "versao_id, beneficio_id, perfil_id, nome, enviada_em, eh_edicao",
  aguardandoAceite: "versao_id, beneficio_id, perfil_id, nome, enviada_em",
} as const;

const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };

function paraErro(e: ErroPostgrest): ErroBanco | null {
  return e ? { code: e.code, message: e.message, details: e.details } : null;
}

async function protegido<T>(f: () => PromiseLike<{ dados: T | null; erro: ErroBanco | null }>) {
  try {
    return await f();
  } catch {
    return { dados: null, erro: ERRO_DESCONHECIDO };
  }
}

async function protegidoErro(f: () => PromiseLike<ErroBanco | null>) {
  try {
    return { erro: await f() };
  } catch {
    return { erro: ERRO_DESCONHECIDO };
  }
}

// Os tipos gerados exigem string nos opcionais; o banco aceita nulo (default null).
const nulo = null as unknown as string;
const naoNulo = (v: number | null) => v as unknown as number;

export function criarBancoPontos(supabase: Cliente): ClienteBancoPontos {
  const argsBeneficio = (a: {
    nome: string;
    descricao: string;
    pontosNecessarios: number;
    condicoes: string | null;
    limiteTotal: number | null;
    limitePorPessoa: number | null;
    prazoResgateAte: string | null;
    prazoUsoDias: number | null;
  }) => ({
    p_nome: a.nome,
    p_descricao: a.descricao,
    p_pontos_necessarios: a.pontosNecessarios,
    p_condicoes: a.condicoes ?? nulo,
    p_limite_total: naoNulo(a.limiteTotal),
    p_limite_por_pessoa: naoNulo(a.limitePorPessoa),
    p_prazo_resgate_ate: a.prazoResgateAte ?? nulo,
    p_prazo_uso_dias: naoNulo(a.prazoUsoDias),
  });

  return {
    lerMeuSaldo: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("pontos_meu_saldo")
          .select(COLUNAS_PONTOS.meuSaldo);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMeusLancamentos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("pontos_meus_lancamentos")
          .select(COLUNAS_PONTOS.meusLancamentos);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    lerParametrosAtuais: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_parametros_atuais");
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    definirParametro: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_definir_parametro", {
          p_chave: a.chave,
          p_valor: a.valor,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),

    reverterCredito: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_reverter_credito", {
          p_lancamento_id: a.lancamentoId,
          p_categoria: a.categoria,
          p_motivo: a.observacao,
          p_confirmar_saldo_negativo: a.confirmarSaldoNegativo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    reprocessarPedido: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_reprocessar_pedido", {
          p_pedido_id: a.pedidoId,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarLancamentosAdmin: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_pontos_lancamentos")
          .select(COLUNAS_PONTOS.lancamentosAdmin);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarSaldosAdmin: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_pontos_saldos")
          .select(COLUNAS_PONTOS.saldosAdmin);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarDecisoesAdmin: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_pontos_decisoes")
          .select(COLUNAS_PONTOS.decisoesAdmin);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarFalhasAdmin: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_pontos_falhas")
          .select(COLUNAS_PONTOS.falhasAdmin);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarBeneficiosPublicos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("pontos_beneficio_publico")
          .select(COLUNAS_PONTOS.beneficioPublico);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarBeneficiosDoPerfil: (perfilId) =>
      protegido(async () => {
        const b = await supabase
          .from("pontos_beneficio")
          .select(COLUNAS_PONTOS.beneficio)
          .eq("perfil_id", perfilId);
        if (b.error) return { dados: null, erro: paraErro(b.error) };
        const beneficios = b.data ?? [];
        if (beneficios.length === 0) {
          return { dados: { beneficios, versoes: [], revisoes: [] }, erro: null };
        }
        const ids = beneficios.map((x) => x.id);
        const v = await supabase
          .from("pontos_beneficio_versao")
          .select(COLUNAS_PONTOS.beneficioVersao)
          .in("beneficio_id", ids);
        if (v.error) return { dados: null, erro: paraErro(v.error) };
        const versoes = v.data ?? [];
        const r = await supabase
          .from("pontos_beneficio_revisao")
          .select(COLUNAS_PONTOS.beneficioRevisao)
          .in("beneficio_id", ids);
        if (r.error) return { dados: null, erro: paraErro(r.error) };
        return { dados: { beneficios, versoes, revisoes: r.data ?? [] }, erro: null };
      }),

    listarFilaBeneficios: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_fila_beneficios")
          .select(COLUNAS_PONTOS.filaBeneficios);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    criarBeneficio: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_criar_beneficio", {
          p_perfil_id: a.perfilId,
          ...argsBeneficio(a),
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    salvarBeneficio: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_salvar_beneficio", {
          p_beneficio_id: a.beneficioId,
          ...argsBeneficio(a),
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    enviarVersao: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_enviar_beneficio_versao", {
          p_versao_id: a.versaoId,
        });
        return paraErro(error);
      }),

    definirBeneficioAtivo: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_definir_beneficio_ativo", {
          p_beneficio_id: a.beneficioId,
          p_ativo: a.ativo,
        });
        return paraErro(error);
      }),

    decidirVersao: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_decidir_beneficio_versao", {
          p_versao_id: a.versaoId,
          p_aprovar: a.aprovar,
          p_motivo: a.motivo ?? nulo,
        });
        return paraErro(error);
      }),

    adminCadastrarBeneficio: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_admin_cadastrar_beneficio", {
          p_perfil_id: a.perfilId,
          p_motivo: a.motivo,
          ...argsBeneficio(a),
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarAguardandoAceite: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_beneficios_aguardando_aceite")
          .select(COLUNAS_PONTOS.aguardandoAceite);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    responderProposta: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_responder_proposta_beneficio", {
          p_versao_id: a.versaoId,
          p_aceitar: a.aceitar,
          p_motivo: a.motivo ?? nulo,
        });
        return paraErro(error);
      }),

    adminEditarProposta: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("pontos_admin_editar_proposta_beneficio", {
          p_versao_id: a.versaoId,
          p_motivo: a.motivo,
          ...argsBeneficio(a),
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    adminDefinirBeneficioAtivo: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("pontos_admin_definir_beneficio_ativo", {
          p_beneficio_id: a.beneficioId,
          p_ativo: a.ativo,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),
  };
}
