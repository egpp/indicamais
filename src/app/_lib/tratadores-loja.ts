import { MENSAGENS_LOJA_ADMIN } from "@/modules/administracao";
import type { ContextoLojaAdmin } from "./contexto-loja";
import { lerDeFormData } from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/** Liberação da Loja por perfil (administrador geral, IM-097, IM-099, D-020). Só liga o formulário ao serviço: validação e auditoria são do módulo e do banco. */
export const CAMPOS_LOJA_LIBERACAO = ["perfilId", "liberada", "motivo"] as const;

export async function definirLiberacaoLoja(ctx: ContextoLojaAdmin, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS_LOJA_LIBERACAO);
  const ler = lerDeFormData(f);
  const r = await ctx.loja.definirLiberacao({
    perfilId: ler("perfilId"),
    liberada: ler("liberada"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: r.valor.liberada ? MENSAGENS_LOJA_ADMIN.liberada : MENSAGENS_LOJA_ADMIN.retirada,
    valores: { ...valores, motivo: "" },
  };
}
