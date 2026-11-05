import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoComissoes } from "@/modules/comissoes";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptador supabase-js do módulo comissoes (Fase 7, IM-061 a IM-073). Usa a SESSÃO do usuário: as RPCs conferem
 * administrador/responsável e as visões filtram por auth.uid(). Nunca recebe service_role. Colunas SEMPRE nomeadas
 * (sem "*"); nenhuma coluna de conta, nome, telefone ou e-mail de cliente (IM-029, IM-041, IM-050). Erros viram
 * `ErroBanco` (só o código é usado; o texto ao usuário é sempre do módulo).
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_COMISSOES = {
  minhasComissoes:
    "id, negocio_id, oferta_nome, competencia, base_centavos, percentual_bp, valor_centavos, cliente_ref, estado, revertida, reversao_causa, criada_em",
  meuSaldo:
    "total_gerado_centavos, liquido_centavos, gerada_centavos, pendente_repasse_centavos, paga_centavos, revertida_apos_paga_centavos, quantidade",
  minhaSituacao:
    "negocio_id, modulo_ativo, clientes_ativos, clientes_encerrados, em_dia, inadimplente_desde, encerra_em, prazo_dias",
  meusNegocios: "negocio_id, modulo_ativo, habilitado_desde",
  minhasOfertas: "id, negocio_id, item_id, nome, periodicidade, percentual_bp, ativa, criada_em",
  negocioComissoes:
    "id, negocio_id, oferta_nome, competencia, base_centavos, percentual_bp, valor_centavos, indicador_ref, cliente_ref, estado, revertida, reversao_causa, criada_em",
  negocioVinculos:
    "id, negocio_id, indicador_ref, cliente_ref, situacao, indicador_em_dia, inadimplente_desde, encerra_em, criado_em, encerrado_em",
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

export function criarBancoComissoes(supabase: Cliente): ClienteBancoComissoes {
  return {
    // ------------------------------------------------------------------------------ Administrador
    definirParametro: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("comissoes_definir_parametro", {
          p_chave: a.chave,
          p_valor: a.valor,
          p_motivo: a.motivo,
        });
        return { dados: null, erro: paraErro(error) };
      }),

    definirHabilitacao: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_definir_habilitacao", {
          p_perfil: a.perfilId,
          p_ativa: a.ativa,
          p_origem: a.origem,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    registrarVinculo: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_registrar_vinculo", {
          p_perfil: a.perfilId,
          p_indicador: a.indicadorId,
          p_cliente: a.clienteId,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    registrarAssinatura: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_registrar_assinatura", {
          p_oferta: a.ofertaId,
          p_cliente: a.clienteId,
          p_valor_centavos: a.valorCentavos,
          p_inicio: a.inicio,
          // O banco aceita nulo (sem fim); os tipos gerados o exigem como texto.
          p_fim: a.fim as string,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    cancelarAssinatura: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("comissoes_cancelar_assinatura", {
          p_assinatura: a.assinaturaId,
          p_motivo: a.motivo,
        });
        return { dados: null, erro: paraErro(error) };
      }),

    confirmarPagamento: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_confirmar_pagamento", {
          p_assinatura: a.assinaturaId,
          p_competencia: a.competencia,
          p_valor_centavos: a.valorCentavos,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    estornarPagamento: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_estornar_pagamento", {
          p_pagamento: a.pagamentoId,
          p_motivo: a.motivo,
          p_confirmar_ja_paga: a.confirmarJaPaga,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    reverterComissao: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_reverter_comissao", {
          p_comissao: a.comissaoId,
          p_causa: a.causa,
          p_motivo: a.motivo,
          p_confirmar_ja_paga: a.confirmarJaPaga,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    avancarRepasse: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_avancar_repasse", {
          p_comissao: a.comissaoId,
          p_estado: a.estado,
          p_motivo: a.motivo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarVinculosVencidos: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc(
          "comissoes_listar_vinculos_vencidos",
          a.perfilId ? { p_perfil: a.perfilId } : {},
        );
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    encerrarVinculo: (a) =>
      protegido(async () => {
        const { error } = await supabase.rpc("comissoes_encerrar_vinculo", {
          p_vinculo: a.vinculoId,
          p_motivo: a.motivo,
        });
        return { dados: null, erro: paraErro(error) };
      }),

    // ------------------------------------------------------------------------------ Anunciante
    criarOferta: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_criar_oferta", {
          p_perfil: a.perfilId,
          p_item_id: a.itemId,
          p_nome: a.nome,
          p_percentual_bp: a.percentualBp,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    alterarPercentualOferta: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_alterar_percentual_oferta", {
          p_oferta: a.ofertaId,
          p_percentual_bp: a.percentualBp,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    definirOfertaAtiva: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_definir_oferta_ativa", {
          p_oferta: a.ofertaId,
          p_ativa: a.ativa,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    // ------------------------------------------------------------------------------ Leituras do administrador
    // Paginadas no banco (limite 1..100); só o administrador as recebe (42501 para os demais).
    listarNegociosAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_listar_negocios", {
          ...(a.estado ? { p_estado: a.estado } : {}),
          ...(a.busca ? { p_busca: a.busca } : {}),
          p_limite: a.limite,
          p_deslocamento: a.deslocamento,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarAssinaturasAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_listar_assinaturas", {
          ...(a.perfilId ? { p_perfil: a.perfilId } : {}),
          ...(a.situacao ? { p_situacao: a.situacao } : {}),
          p_limite: a.limite,
          p_deslocamento: a.deslocamento,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarPagamentosAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_listar_pagamentos", {
          ...(a.perfilId ? { p_perfil: a.perfilId } : {}),
          ...(a.estado ? { p_estado: a.estado } : {}),
          p_limite: a.limite,
          p_deslocamento: a.deslocamento,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarComissoesAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_listar_comissoes", {
          ...(a.perfilId ? { p_perfil: a.perfilId } : {}),
          ...(a.estado ? { p_estado: a.estado } : {}),
          p_limite: a.limite,
          p_deslocamento: a.deslocamento,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarVinculosAdmin: (a) =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_listar_vinculos", {
          ...(a.perfilId ? { p_perfil: a.perfilId } : {}),
          ...(a.situacao ? { p_situacao: a.situacao } : {}),
          p_limite: a.limite,
          p_deslocamento: a.deslocamento,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    lerPrazoInadimplencia: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_admin_prazo_inadimplencia");
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    // ------------------------------------------------------------------------------ Leituras
    listarNegociosVinculados: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_meus_negocios_vinculados");
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasComissoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_minhas_comissoes")
          .select(COLUNAS_COMISSOES.minhasComissoes);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    lerMeuSaldo: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_meu_saldo")
          .select(COLUNAS_COMISSOES.meuSaldo);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasSituacoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_minha_situacao")
          .select(COLUNAS_COMISSOES.minhaSituacao);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMeusNegocios: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_meus_negocios")
          .select(COLUNAS_COMISSOES.meusNegocios);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasOfertas: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_minhas_ofertas")
          .select(COLUNAS_COMISSOES.minhasOfertas);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarNegocioComissoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_negocio_comissoes")
          .select(COLUNAS_COMISSOES.negocioComissoes);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarNegocioVinculos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("comissoes_negocio_vinculos")
          .select(COLUNAS_COMISSOES.negocioVinculos);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarSituacoesComoIndicador: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_situacoes_como_indicador");
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarSituacoesComoResponsavel: () =>
      protegido(async () => {
        const { data, error } = await supabase.rpc("comissoes_situacoes_como_responsavel");
        return { dados: data ?? [], erro: paraErro(error) };
      }),
  };
}
