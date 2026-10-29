import type { ContextoPatrocinadores } from "./contexto-patrocinadores";
import { lerDeFormData } from "./entrada-conteudo";
import {
  CAMPOS_PATROCINADOR,
  lerAlterarPatrocinador,
  lerCriarPatrocinador,
  lerDefinirAtivo,
} from "./entrada-patrocinadores";
import { deErro, valoresDe, type Resposta } from "./resposta";

/**
 * Tratadores dos formulários de patrocinadores (IM-020, D-008). Só ligam o formulário ao serviço do módulo
 * administracao: validação, papel de administrador, auditoria e motivo são do módulo e do banco.
 */

export const MENSAGENS_TELA_PATROCINADOR = {
  criado: "Patrocinador criado.",
  alterado: "Patrocinador atualizado.",
  ativado: "Patrocinador ativado.",
  desativado: "Patrocinador desativado.",
} as const;

const CAMPOS = [...CAMPOS_PATROCINADOR, "id", "imagemPath"] as const;

export async function criarPatrocinador(
  ctx: ContextoPatrocinadores,
  f: FormData,
): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS);
  const r = await ctx.patrocinadores.criarPatrocinador(lerCriarPatrocinador(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return { destino: "/administracao/patrocinadores?aviso=criado" };
}

export async function alterarPatrocinador(
  ctx: ContextoPatrocinadores,
  f: FormData,
): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS);
  const r = await ctx.patrocinadores.alterarPatrocinador(lerAlterarPatrocinador(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_PATROCINADOR.alterado, valores: { ...valores, motivo: "" } };
}

export async function definirPatrocinadorAtivo(
  ctx: ContextoPatrocinadores,
  f: FormData,
): Promise<Resposta> {
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.patrocinadores.definirPatrocinadorAtivo(lerDefinirAtivo(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: r.valor.ativo
      ? MENSAGENS_TELA_PATROCINADOR.ativado
      : MENSAGENS_TELA_PATROCINADOR.desativado,
    valores: { motivo: "" },
  };
}
