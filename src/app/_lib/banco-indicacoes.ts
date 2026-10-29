import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteBancoIndicacoes, ClienteBancoNotificacoes } from "@/modules/indicacoes";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import type { Database } from "@/shared/db/database.types";

/**
 * Adaptadores supabase-js do módulo indicacoes (Fase 3). `criarBancoIndicacoes` usa a SESSÃO do usuário (ou a
 * anônima, em enviarContato): RLS decide. `criarBancoNotificacoes` recebe o cliente de serviço do servidor e
 * só é montado em src/app/_lib/notificacoes-contato.ts. Colunas SEMPRE nomeadas (nunca select de tudo).
 * Erros viram `ErroBanco` (código para classificação); o texto ao usuário é sempre do módulo.
 */
type Cliente = SupabaseClient<Database>;
type ErroPostgrest = { code?: string; message?: string; details?: string } | null;

export const COLUNAS_INDICACOES = {
  meusPedidos:
    "id, destino_tipo, destino_id, destino_nome, nome, whatsapp_e164, email, mensagem, criado_em, veio_por_indicacao, notificacao_estado",
  minhasIndicacoes: "id, destino_tipo, destino_id, destino_nome, criado_em, status",
  meusLinks: "id, codigo, destino_tipo, destino_id, destino_nome, disponivel, criado_em",
  filaContatos:
    "id, destino_tipo, destino_id, destino_nome, nome, whatsapp_e164, email, mensagem, criado_em, veio_por_indicacao, notificacao_estado, autoindicacao_suspeita, tentativas, ultima_tentativa_em, ultimo_erro, reenvio_solicitado_em, alerta_estado",
  parametro: "chave, valor, minimo, maximo, descricao, atualizado_em",
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

export function criarBancoIndicacoes(supabase: Cliente): ClienteBancoIndicacoes {
  return {
    gerarLink: (a) =>
      protegido(async () => {
        const args: { p_perfil_id?: string; p_item_id?: string } = {};
        if (a.perfilId) args.p_perfil_id = a.perfilId;
        if (a.itemId) args.p_item_id = a.itemId;
        const { data, error } = await supabase.rpc("indicacoes_gerar_link", args);
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    registrarCompartilhamento: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("indicacoes_registrar_compartilhamento", {
          p_codigo: a.codigo,
          p_canal: a.canal,
        });
        return paraErro(error);
      }),

    enviarContato: (a) =>
      protegido(async () => {
        // Os tipos gerados exigem string; o banco aceita nulo no destino que não se aplica e nos opcionais.
        const nulo = null as unknown as string;
        const { data, error } = await supabase.rpc("indicacoes_enviar_contato", {
          p_perfil_id: a.perfilId ?? nulo,
          p_item_id: a.itemId ?? nulo,
          p_nome: a.nome,
          p_whatsapp: a.whatsapp,
          p_chave: a.chave,
          p_email: a.email ?? nulo,
          p_mensagem: a.mensagem ?? nulo,
          p_codigo: a.codigo ?? nulo,
        });
        return { dados: data ?? null, erro: paraErro(error) };
      }),

    listarMeusPedidos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("indicacoes_meus_pedidos")
          .select(COLUNAS_INDICACOES.meusPedidos);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMinhasIndicacoes: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("indicacoes_minhas_indicacoes")
          .select(COLUNAS_INDICACOES.minhasIndicacoes);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarMeusLinks: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("indicacoes_meus_links")
          .select(COLUNAS_INDICACOES.meusLinks);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    listarFilaContatos: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("administracao_fila_contatos")
          .select(COLUNAS_INDICACOES.filaContatos);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    solicitarReenvio: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("indicacoes_solicitar_reenvio", {
          p_pedido_id: a.pedidoId,
          ...(a.motivo ? { p_motivo: a.motivo } : {}),
        });
        return paraErro(error);
      }),

    tratarAlerta: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("indicacoes_tratar_alerta", {
          p_pedido_id: a.pedidoId,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),

    listarParametros: () =>
      protegido(async () => {
        const { data, error } = await supabase
          .from("indicacoes_parametro")
          .select(COLUNAS_INDICACOES.parametro);
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    definirParametro: (a) =>
      protegidoErro(async () => {
        const { error } = await supabase.rpc("indicacoes_definir_parametro", {
          p_chave: a.chave,
          p_valor: a.valor,
          p_motivo: a.motivo,
        });
        return paraErro(error);
      }),
  };
}

/** Banco do servidor (cliente de serviço) para a fila de notificações. Nunca em código de cliente. */
export function criarBancoNotificacoes(servico: Cliente): ClienteBancoNotificacoes {
  return {
    listarPendentes: (limite) =>
      protegido(async () => {
        const { data, error } = await servico.rpc("indicacoes_notificacoes_pendentes", {
          p_limite: limite,
        });
        return { dados: data ?? [], erro: paraErro(error) };
      }),

    registrar: (a) =>
      protegidoErro(async () => {
        const { error } = await servico.rpc("indicacoes_notificacao_registrar", {
          p_pedido_id: a.pedidoId,
          p_sucesso: a.sucesso,
          ...(a.erro ? { p_erro: a.erro } : {}),
        });
        return paraErro(error);
      }),
  };
}
