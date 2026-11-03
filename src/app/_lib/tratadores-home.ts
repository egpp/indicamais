import type { ContextoHomeAdmin } from "./contexto-home";
import { lerDeFormData } from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/** Formulário de edição de uma seção da home (IM-096). Só liga o formulário ao serviço: validação e auditoria são do módulo e do banco. */
export const CAMPOS_SECAO_HOME = [
  "chave",
  "titulo",
  "ativa",
  "ordem",
  "minimoItens",
  "limitePadrao",
  "motivo",
] as const;

export const MENSAGENS_TELA_HOME = { alterada: "Seção atualizada." } as const;

export async function alterarSecaoHome(ctx: ContextoHomeAdmin, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS_SECAO_HOME);
  const ler = lerDeFormData(f);
  const r = await ctx.home.alterarSecaoHome({
    chave: ler("chave"),
    titulo: ler("titulo"),
    ativa: ler("ativa"),
    ordem: ler("ordem"),
    minimoItens: ler("minimoItens"),
    limitePadrao: ler("limitePadrao"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_HOME.alterada, valores: { ...valores, motivo: "" } };
}
