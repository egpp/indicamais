import { MENSAGENS_ADMINISTRACAO } from "@/modules/administracao";
import type { Contexto } from "./contexto";
import { lerDeFormData } from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/**
 * Tratadores da administração mínima (D-006) e do pedido de nova categoria. As ações de administrador
 * conferem o papel aqui só para responder cedo; quem garante é o banco (RLS e funções), a cada chamada.
 */

export const MENSAGENS_TELA_ADM = {
  aprovado: "Aprovado.",
  rejeitado: "Rejeitado. O motivo ficará visível para o responsável.",
  categoriaCriada: "Categoria criada.",
  categoriaAlterada: "Categoria atualizada.",
  solicitacaoAtendida: "Pedido atendido.",
  solicitacaoRecusada: "Pedido recusado.",
  pedidoEnviado: "Pedido enviado. Avisaremos aqui quando houver resposta.",
} as const;

async function soAdministrador(ctx: Contexto): Promise<Resposta | null> {
  return (await ctx.administracao.ehAdministrador())
    ? null
    : { erro: MENSAGENS_ADMINISTRACAO.semPermissao };
}

export async function decidirRevisao(ctx: Contexto, f: FormData): Promise<Resposta> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const aprovar = ler("decisao") === "aprovar";
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.administracao.decidir({
    aprovar,
    alvo: ler("alvo"),
    versaoId: ler("versaoId"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { destino: `/administracao/revisao?decidido=${r.valor.decisao}` };
}

export async function solicitarCategoria(ctx: Contexto, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, ["nome", "justificativa"]);
  const r = await ctx.categorias.solicitar(valores);
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_ADM.pedidoEnviado, valores: { nome: "", justificativa: "" } };
}

export async function criarCategoria(ctx: Contexto, f: FormData): Promise<Resposta> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["nome", "ordem"]);
  const ordem = ler("ordem").trim();
  const r = await ctx.categorias.criarCategoria({
    nome: ler("nome"),
    ordem: ordem === "" ? undefined : Number(ordem),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_ADM.categoriaCriada, valores: { nome: "", ordem: "" } };
}

export async function alterarCategoria(ctx: Contexto, f: FormData): Promise<Resposta> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["nome", "ordem", "ativa", "motivo"]);
  const r = await ctx.categorias.alterarCategoria({
    id: ler("id"),
    nome: ler("nome"),
    ativa: ler("ativa") === "sim",
    ordem: Number(ler("ordem")),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_ADM.categoriaAlterada, valores: { ...valores, motivo: "" } };
}

export async function decidirSolicitacao(ctx: Contexto, f: FormData): Promise<Resposta> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const atendida = ler("decisao") === "atender";
  const valores = valoresDe(f, ["categoriaId", "motivo"]);
  if (atendida && ler("categoriaId").trim() === "") {
    return {
      erros: { categoriaId: "Escolha a categoria criada para atender este pedido." },
      valores,
    };
  }
  const r = await ctx.categorias.decidirSolicitacao({
    id: ler("id"),
    atendida,
    categoriaId: ler("categoriaId"),
    motivo: ler("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: atendida
      ? MENSAGENS_TELA_ADM.solicitacaoAtendida
      : MENSAGENS_TELA_ADM.solicitacaoRecusada,
  };
}
