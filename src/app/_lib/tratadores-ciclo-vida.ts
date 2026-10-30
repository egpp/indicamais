import { MENSAGENS_CICLO } from "@/modules/administracao";
import { bloquearAcessoNoAuth, liberarAcessoNoAuth } from "@/shared/supabase/acesso-conta";
import type { ContextoCicloVida } from "./contexto-ciclo-vida";
import { lerDeFormData } from "./entrada-conteudo";
import type { EstadoCicloVida } from "./estado-ciclo-vida";
import { deErro, valoresDe } from "./resposta";

/**
 * Tratadores da Fase 6 (IM-076, IM-077, IM-080, IM-081). Só leem o formulário, chamam o serviço do módulo e
 * transformam o resultado em estado de tela. Nenhuma regra de negócio. Mensagens vêm dos módulos, nunca do banco.
 * Quem garante permissão é o banco (RLS e funções) a cada chamada.
 */
export const MENSAGENS_TELA_CICLO = {
  decidida: "Decisão registrada. Nenhuma conta foi suspensa por isso.",
  concedida: "Permissão concedida.",
  revogada: "Permissão revogada.",
  suspensa: "Conta suspensa. O acesso foi bloqueado.",
  suspensaSemBloqueio:
    "Conta suspensa, mas o bloqueio de acesso no login não pôde ser aplicado agora. Use Sincronizar acesso para repetir.",
  reativada: "Conta reativada. Os perfis voltam despublicados; o responsável republica.",
  reativadaSemLiberar:
    "Conta reativada, mas a liberação do login não pôde ser aplicada agora. Use Sincronizar acesso para repetir.",
  sincronizada: "Acesso sincronizado com a situação da conta.",
  sincronizarNegado: "Não foi possível sincronizar o acesso desta conta.",
  invalidada: "Indicação invalidada. Os pontos dela foram revertidos.",
  invalidadaSemCredito: "Indicação invalidada. Não havia pontos creditados para reverter.",
  encerramentoSolicitado: "Encerramento solicitado.",
  encerramentoCancelado: "Encerramento cancelado. Seus perfis continuam despublicados.",
} as const;

export async function enviarDenuncia(
  ctx: ContextoCicloVida,
  f: FormData,
  origem: string | undefined,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["tipo", "texto"]);
  const r = await ctx.admin.denunciar({
    alvoTipo: ler("alvoTipo"),
    alvoId: ler("alvoId"),
    tipo: ler("tipo"),
    // Texto vazio vira "ausente": o schema do módulo só aceita o campo opcional omitido, não "".
    texto: ler("texto").trim() || undefined,
    origem,
    site: ler("site"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  // Sempre a mensagem neutra do módulo: igual para nova, repetida, alvo inexistente e robô.
  return { sucesso: r.valor.mensagem, valores: { tipo: "", texto: "" } };
}

export async function decidirDenuncia(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.admin.decidirDenuncia({
    denunciaId: ler("denunciaId"),
    decisao: ler("decisao"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_CICLO.decidida };
}

export async function concederPermissao(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["contaId", "permissao", "motivo"]);
  const r = await ctx.admin.concederPermissao({
    contaId: ler("contaId").trim(),
    permissao: ler("permissao"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: MENSAGENS_TELA_CICLO.concedida,
    valores: { contaId: "", permissao: "", motivo: "" },
  };
}

export async function revogarPermissao(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.admin.revogarPermissao({
    contaId: ler("contaId").trim(),
    permissao: ler("permissao"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_CICLO.revogada };
}

export async function suspenderConta(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["contaId", "motivo"]);
  const r = await ctx.admin.suspenderConta({
    contaId: ler("contaId").trim(),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  // A suspensão já está gravada; o bloqueio no Auth é reforço e, se falhou, só avisa.
  return ctx.falhas.suspender
    ? { erro: MENSAGENS_TELA_CICLO.suspensaSemBloqueio }
    : { sucesso: MENSAGENS_TELA_CICLO.suspensa, valores: { contaId: "", motivo: "" } };
}

export async function reativarConta(ctx: ContextoCicloVida, f: FormData): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.admin.reativarConta({
    contaId: ler("contaId").trim(),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return ctx.falhas.reativar
    ? { erro: MENSAGENS_TELA_CICLO.reativadaSemLiberar }
    : { sucesso: MENSAGENS_TELA_CICLO.reativada };
}

/**
 * Repete o banimento ou a liberação no Auth conforme a situação gravada no banco (IM-080). Usa a chave de serviço
 * (só servidor), então a permissão `suspender` é conferida aqui antes. Conta suspensa: bloqueia. Ativa ou em
 * carência: libera. Conta anonimizada nunca é liberada.
 */
export async function sincronizarAcesso(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const contaId = lerDeFormData(f)("contaId").trim();
  if (!(await ctx.permissoes()).includes("suspender")) {
    return { erro: MENSAGENS_CICLO.semPermissao };
  }
  const lista = await ctx.admin.listarContasCicloVida();
  if (!lista.ok) return { erro: lista.erro.mensagem };
  const conta = lista.valor.find((c) => c.contaId === contaId);
  if (conta?.situacao === "anonimizada") return { erro: MENSAGENS_TELA_CICLO.sincronizarNegado };
  const r =
    conta?.situacao === "suspensa"
      ? await bloquearAcessoNoAuth(contaId)
      : await liberarAcessoNoAuth(contaId);
  return r.ok
    ? { sucesso: MENSAGENS_TELA_CICLO.sincronizada, valores: { contaId: "" } }
    : { erro: MENSAGENS_TELA_CICLO.sincronizarNegado, valores: { contaId } };
}

export async function invalidarIndicacao(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["pedidoId", "motivo"]);
  const r = await ctx.admin.invalidarIndicacao({
    pedidoId: ler("pedidoId").trim(),
    motivo: ler("motivo"),
    confirmarSaldoNegativo: ler("confirmarSaldoNegativo") === "sim",
  });
  if (!r.ok) {
    if (r.erro.codigo === "SALDO_NEGATIVO") {
      return { erro: r.erro.mensagem, valores, pedirConfirmacao: true };
    }
    return deErro(r.erro, valores);
  }
  return {
    sucesso: r.valor.reversaoId
      ? MENSAGENS_TELA_CICLO.invalidada
      : MENSAGENS_TELA_CICLO.invalidadaSemCredito,
  };
}

export async function solicitarEncerramento(
  ctx: ContextoCicloVida,
  f: FormData,
): Promise<EstadoCicloVida> {
  const r = await ctx.conta.solicitarEncerramento({ confirmacao: lerDeFormData(f)("confirmacao") });
  if (!r.ok) {
    return r.erro.codigo === "CONFIRMACAO_INVALIDA"
      ? { erros: { confirmacao: r.erro.mensagem } }
      : { erro: r.erro.mensagem };
  }
  return { sucesso: MENSAGENS_TELA_CICLO.encerramentoSolicitado };
}

export async function cancelarEncerramento(ctx: ContextoCicloVida): Promise<EstadoCicloVida> {
  const r = await ctx.conta.cancelarEncerramento();
  return r.ok ? { sucesso: MENSAGENS_TELA_CICLO.encerramentoCancelado } : { erro: r.erro.mensagem };
}
