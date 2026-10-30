import { MENSAGENS_PONTOS, type ErroPontos } from "@/modules/pontos";
import type { ContextoPontos } from "./contexto-pontos";
import { lerDeFormData } from "./entrada-conteudo";
import {
  CAMPOS_BENEFICIO,
  lerCamposBeneficio,
  lerDecisao,
  lerParametroPontos,
  lerReprocessar,
  lerResposta,
  lerReversao,
} from "./entrada-pontos";
import type { EstadoPontos } from "./estado-pontos";
import { valoresDe } from "./resposta";
import { CAMPOS_VISIVEIS_PONTOS } from "./validacao-pontos";

/**
 * Tratadores da Fase 4 (IM-030 a IM-036, IM-077 a IM-079). Só leem o formulário, chamam o serviço do módulo e
 * transformam o resultado em estado de tela. Nenhuma regra de negócio. Mensagens vêm do módulo, nunca do banco.
 */

export const MENSAGENS_TELA_PONTOS = {
  parametro: "Parâmetro atualizado.",
  reversao: "Crédito revertido.",
  reprocessado: "Pedido reprocessado.",
  beneficioCriado: "Benefício salvo como rascunho.",
  beneficioSalvo: "Benefício salvo.",
  enviado: "Benefício enviado para análise.",
  ligado: "Benefício ligado.",
  desligado: "Benefício desligado.",
  aprovado: "Benefício aprovado.",
  rejeitado: "Benefício rejeitado.",
  propostaCadastrada: "Proposta cadastrada. Ela aguarda o aceite do responsável.",
  propostaEditada: "Contraproposta registrada. Ela aguarda o aceite do responsável.",
  aceita: "Proposta aceita. O benefício está ativo.",
  recusada: "Proposta recusada.",
} as const;

type Resultado = { ok: true } | { ok: false; erro: ErroPontos };

/** Erros por campo só nos campos visíveis; o resto (ids, estado) vira aviso geral. */
function estadoDe(
  r: Resultado,
  sucesso: string,
  valores: Record<string, string>,
  manter: readonly string[] = [],
): EstadoPontos {
  if (r.ok) {
    return { sucesso, valores: Object.fromEntries(manter.map((k) => [k, valores[k] ?? ""])) };
  }
  const visiveis = Object.entries(r.erro.campos ?? {}).filter(([k]) =>
    (CAMPOS_VISIVEIS_PONTOS as readonly string[]).includes(k),
  );
  if (visiveis.length > 0) return { erros: Object.fromEntries(visiveis), valores };
  return {
    erro: r.erro.mensagem,
    valores,
    ...(r.erro.codigo === "SALDO_NEGATIVO" ? { pedirConfirmacao: true } : {}),
  };
}

async function soAdministrador(ctx: ContextoPontos): Promise<EstadoPontos | null> {
  return (await ctx.ehAdministrador()) ? null : { erro: MENSAGENS_PONTOS.semPermissao };
}

const CAMPOS_FORM_BENEFICIO = [...CAMPOS_BENEFICIO, "perfilId", "motivo"] as const;

// Administração ---------------------------------------------------------------------------------------------

export async function definirParametroPontos(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const valores = valoresDe(f, ["valor", "motivo"]);
  const r = await ctx.servico.definirParametro(lerParametroPontos(lerDeFormData(f)));
  return estadoDe(r, MENSAGENS_TELA_PONTOS.parametro, valores, ["valor"]);
}

export async function reverterCreditoAdmin(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const valores = valoresDe(f, ["categoria", "observacao"]);
  const r = await ctx.servico.reverterCredito(lerReversao(lerDeFormData(f)));
  return estadoDe(r, MENSAGENS_TELA_PONTOS.reversao, valores);
}

export async function reprocessarPedidoAdmin(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.servico.reprocessarPedido(lerReprocessar(lerDeFormData(f)));
  return estadoDe(r, MENSAGENS_TELA_PONTOS.reprocessado, valores);
}

export async function decidirBeneficioAdmin(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const entrada = lerDecisao(lerDeFormData(f));
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.servico.decidirBeneficio(entrada);
  return estadoDe(
    r,
    entrada.aprovar ? MENSAGENS_TELA_PONTOS.aprovado : MENSAGENS_TELA_PONTOS.rejeitado,
    valores,
  );
}

export async function cadastrarBeneficioAdmin(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_FORM_BENEFICIO);
  const r = await ctx.servico.adminCadastrarBeneficio({
    perfilId: ler("perfilId"),
    motivo: ler("motivo"),
    ...lerCamposBeneficio(ler),
  });
  return estadoDe(r, MENSAGENS_TELA_PONTOS.propostaCadastrada, valores, ["perfilId"]);
}

export async function editarPropostaAdmin(ctx: ContextoPontos, f: FormData): Promise<EstadoPontos> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_FORM_BENEFICIO);
  const r = await ctx.servico.adminEditarProposta({
    versaoId: ler("versaoId"),
    motivo: ler("motivo"),
    ...lerCamposBeneficio(ler),
  });
  return estadoDe(r, MENSAGENS_TELA_PONTOS.propostaEditada, valores);
}

// Responsável -----------------------------------------------------------------------------------------------

export async function criarBeneficioResponsavel(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_FORM_BENEFICIO);
  const r = await ctx.servico.criarBeneficio({
    perfilId: ler("perfilId"),
    ...lerCamposBeneficio(ler),
  });
  return estadoDe(r, MENSAGENS_TELA_PONTOS.beneficioCriado, valores);
}

export async function salvarBeneficioResponsavel(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_FORM_BENEFICIO);
  const r = await ctx.servico.salvarBeneficio({
    beneficioId: ler("beneficioId"),
    ...lerCamposBeneficio(ler),
  });
  return estadoDe(r, MENSAGENS_TELA_PONTOS.beneficioSalvo, valores, CAMPOS_FORM_BENEFICIO);
}

export async function enviarVersaoResponsavel(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const r = await ctx.servico.enviarVersao({ versaoId: lerDeFormData(f)("versaoId") });
  return estadoDe(r, MENSAGENS_TELA_PONTOS.enviado, {});
}

export async function ligarDesligarBeneficio(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const ler = lerDeFormData(f);
  const ativo = ler("ativo") === "sim";
  const r = await ctx.servico.definirBeneficioAtivo({ beneficioId: ler("beneficioId"), ativo });
  return estadoDe(r, ativo ? MENSAGENS_TELA_PONTOS.ligado : MENSAGENS_TELA_PONTOS.desligado, {});
}

export async function responderPropostaResponsavel(
  ctx: ContextoPontos,
  f: FormData,
): Promise<EstadoPontos> {
  const entrada = lerResposta(lerDeFormData(f));
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.servico.responderProposta(entrada);
  return estadoDe(
    r,
    entrada.aceitar ? MENSAGENS_TELA_PONTOS.aceita : MENSAGENS_TELA_PONTOS.recusada,
    valores,
  );
}
