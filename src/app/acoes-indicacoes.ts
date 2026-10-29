"use server";

import { revalidatePath } from "next/cache";
import {
  obterContextoIndicacoes,
  obterContextoIndicacoesAberto,
  type ContextoIndicacoes,
} from "./_lib/contexto-indicacoes";
import type { EstadoContato, EstadoLink } from "./_lib/estado-indicacoes";
import { dispararNotificacoesDoServidor } from "./_lib/notificacoes-contato";
import {
  CAMPOS_CONTATO,
  definirParametroAdmin,
  enviarContatoVisitante,
  gerarLinkDeIndicacao,
  pedirReenvio,
  registrarCompartilhamentoDeLink,
  reenviarComoAdmin,
  tratarAlertaAdmin,
} from "./_lib/tratadores-indicacoes";
import { MENSAGENS_INDICACOES } from "@/modules/indicacoes";
import { valoresDe } from "./_lib/resposta";

/**
 * Server Actions da Fase 3. Só ligam o formulário ao tratador: sessão do usuário (ou a anônima no contato do
 * visitante), serviço do módulo, atualização da tela e, depois do envio, o disparo em segundo plano do aviso
 * ao responsável (só com provedor de e-mail configurado). Sem regra de negócio e sem dado privado em log.
 */

/** Falha inesperada nunca vaza texto interno: devolve a mensagem genérica do módulo. */
async function protegida<E extends { erro?: string; valores?: Record<string, string> }>(
  f: () => Promise<E>,
  valores?: Record<string, string>,
): Promise<E> {
  try {
    return await f();
  } catch (e) {
    // Redirecionamentos do Next (ex.: sessão expirada) precisam seguir adiante.
    if (
      e instanceof Error &&
      /NEXT_REDIRECT|NEXT_NOT_FOUND/.test(`${e.message}${(e as { digest?: string }).digest ?? ""}`)
    ) {
      throw e;
    }
    // Mantém o que a pessoa digitou: o formulário não se esvazia por uma falha passageira.
    return { erro: MENSAGENS_INDICACOES.generica, ...(valores ? { valores } : {}) } as E;
  }
}

function comContexto<E extends { erro?: string; valores?: Record<string, string> }>(
  obter: () => Promise<ContextoIndicacoes>,
  tratador: (ctx: ContextoIndicacoes, f: FormData) => Promise<E>,
  f: FormData,
  valores?: Record<string, string>,
): Promise<E> {
  return protegida(async () => tratador(await obter(), f), valores);
}

// Visitante (IM-026) -------------------------------------------------------------------------------------
export async function acaoEnviarContato(_: EstadoContato, f: FormData): Promise<EstadoContato> {
  const estado = await comContexto(
    obterContextoIndicacoesAberto,
    enviarContatoVisitante,
    f,
    valoresDe(f, CAMPOS_CONTATO),
  );
  if (estado.urlWhatsapp) {
    revalidatePath("/pedidos-de-contato");
    // Em segundo plano e só com provedor de e-mail configurado; falha aqui nunca chega ao visitante.
    try {
      dispararNotificacoesDoServidor();
    } catch {
      // O pedido já está salvo e visível no painel do responsável.
    }
  }
  return estado;
}

// Indicador (IM-024) -------------------------------------------------------------------------------------
export async function acaoGerarLink(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const estado = await comContexto(obterContextoIndicacoesAberto, gerarLinkDeIndicacao, f);
  if (estado.link) revalidatePath("/minhas-indicacoes");
  return estado;
}

/** Chamada pelo botão "Copiar link" / "Compartilhar no WhatsApp". Falhas são silenciosas para o usuário. */
export async function acaoRegistrarCompartilhamento(
  codigo: string,
  canal: string,
): Promise<boolean> {
  try {
    const ctx = await obterContextoIndicacoesAberto();
    return await registrarCompartilhamentoDeLink(ctx, String(codigo), String(canal));
  } catch {
    return false;
  }
}

// Responsável (IM-028) -----------------------------------------------------------------------------------
export async function acaoPedirReenvio(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const estado = await comContexto(
    () => obterContextoIndicacoes("/pedidos-de-contato"),
    pedirReenvio,
    f,
  );
  if (estado.sucesso) {
    revalidatePath("/pedidos-de-contato");
    try {
      dispararNotificacoesDoServidor();
    } catch {
      // Sem provedor ou falha de agenda: o pedido continua pendente no painel.
    }
  }
  return estado;
}

// Administração (IM-028, IM-034) -------------------------------------------------------------------------
export async function acaoReenviarComoAdmin(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const estado = await comContexto(
    () => obterContextoIndicacoes("/administracao/pedidos"),
    reenviarComoAdmin,
    f,
  );
  if (estado.sucesso) {
    revalidatePath("/administracao/pedidos");
    try {
      dispararNotificacoesDoServidor({ ignorarLimiteTentativas: true });
    } catch {
      // Idem.
    }
  }
  return estado;
}

export async function acaoTratarAlerta(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const estado = await comContexto(
    () => obterContextoIndicacoes("/administracao/pedidos"),
    tratarAlertaAdmin,
    f,
  );
  if (estado.sucesso) revalidatePath("/administracao/pedidos");
  return estado;
}

export async function acaoDefinirParametro(_: EstadoLink, f: FormData): Promise<EstadoLink> {
  const estado = await comContexto(
    () => obterContextoIndicacoes("/administracao/parametros"),
    definirParametroAdmin,
    f,
  );
  if (estado.sucesso) revalidatePath("/administracao/parametros");
  return estado;
}
