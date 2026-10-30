import type { Aviso } from "@/modules/notificacoes";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";
import type { ContextoRelacionamento } from "./contexto-relacionamento";
import { lerDeFormData } from "./entrada-conteudo";
import type { EstadoRelacionamento } from "./estado-relacionamento";

/**
 * Tratadores da Fase 5 (IM-039 a IM-045, IM-047, IM-052). Só leem o formulário, chamam o serviço do módulo e
 * transformam o resultado em estado de tela. Nenhuma regra de negócio. Mensagens vêm dos módulos, nunca do banco.
 * Nenhuma mensagem promete pontos, benefício ou ganho por curtir (IM-042).
 */
export const MENSAGENS_TELA_RELACIONAMENTO = {
  curtiu: "Você curtiu este perfil.",
  descurtiu: "Curtida removida.",
  saiu: "Você saiu da base deste perfil.",
  marcada: "Aviso marcado como lido.",
  todasMarcadas: "Todos os avisos foram marcados como lidos.",
} as const;

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: { mensagem: string } };

function estadoDe<T>(r: Resultado<T>, sucesso: string): EstadoRelacionamento {
  return r.ok ? { sucesso } : { erro: r.erro.mensagem };
}

export async function curtirPerfil(
  ctx: ContextoRelacionamento,
  f: FormData,
): Promise<EstadoRelacionamento> {
  const r = await ctx.relacionamento.curtir({ perfilId: lerDeFormData(f)("perfilId") });
  return estadoDe(r, MENSAGENS_TELA_RELACIONAMENTO.curtiu);
}

export async function descurtirPerfil(
  ctx: ContextoRelacionamento,
  f: FormData,
): Promise<EstadoRelacionamento> {
  const r = await ctx.relacionamento.descurtir({ perfilId: lerDeFormData(f)("perfilId") });
  return estadoDe(r, MENSAGENS_TELA_RELACIONAMENTO.descurtiu);
}

export async function sairDaBasePerfil(
  ctx: ContextoRelacionamento,
  f: FormData,
): Promise<EstadoRelacionamento> {
  const r = await ctx.relacionamento.sairDaBase({ perfilId: lerDeFormData(f)("perfilId") });
  return estadoDe(r, MENSAGENS_TELA_RELACIONAMENTO.saiu);
}

export async function marcarAvisoLido(
  ctx: ContextoRelacionamento,
  f: FormData,
): Promise<EstadoRelacionamento> {
  const ler = lerDeFormData(f);
  const r = await ctx.notificacoes.marcarLida({ origem: ler("origem"), origemId: ler("origemId") });
  return estadoDe(r, MENSAGENS_TELA_RELACIONAMENTO.marcada);
}

export async function marcarTodosAvisosLidos(
  ctx: ContextoRelacionamento,
): Promise<EstadoRelacionamento> {
  const r = await ctx.notificacoes.marcarTodasLidas();
  return estadoDe(r, MENSAGENS_TELA_RELACIONAMENTO.todasMarcadas);
}

/**
 * Para onde o clique em um aviso leva (IM-052). O destino é sempre refeito no servidor a partir do aviso do banco,
 * nunca do que o navegador mandou. "Sua indicação gerou um contato" abre a página pública do destino; os demais
 * avisos são do responsável e abrem o painel do perfil ou item. Sem destino conhecido, volta aos avisos.
 */
export const CAMINHO_DESTINO_INDISPONIVEL = "/avisos?aviso=indisponivel";

export async function caminhoDoAviso(
  aviso: Aviso,
  slugDoPerfil: (id: string) => Promise<string | null>,
  itemDisponivel: (id: string) => Promise<boolean> = async () => true,
): Promise<string> {
  const d = aviso.destino;
  if (!d) return "/avisos";
  if (aviso.tipo === "indicacao_valida") {
    // O destino pode ter saído do ar: em vez de um 404 seco, volta aos avisos com uma mensagem amigável.
    if (d.tipo === "item") {
      return (await itemDisponivel(d.id))
        ? ROTAS_PUBLICAS.item(d.id)
        : CAMINHO_DESTINO_INDISPONIVEL;
    }
    const slug = await slugDoPerfil(d.id);
    return slug ? ROTAS_PUBLICAS.perfil(slug) : CAMINHO_DESTINO_INDISPONIVEL;
  }
  return d.tipo === "perfil" ? `/meus-perfis/${d.id}` : `/meus-itens/${d.id}`;
}

/** Abre um aviso: marca como lido (melhor esforço) e devolve o caminho. Aviso que não existe volta aos avisos. */
export async function abrirAviso(ctx: ContextoRelacionamento, f: FormData): Promise<string> {
  const ler = lerDeFormData(f);
  const origem = ler("origem");
  const origemId = ler("origemId");
  const lista = await ctx.notificacoes.meusAvisos();
  if (!lista.ok) return "/avisos";
  const aviso = lista.valor.find((a) => a.origem === origem && a.origemId === origemId);
  if (!aviso) return "/avisos";
  await ctx.notificacoes.marcarLida({ origem: aviso.origem, origemId: aviso.origemId });
  return caminhoDoAviso(
    aviso,
    async (id) => (await ctx.leitura.perfilPorId(id))?.slug ?? null,
    async (id) => (await ctx.leitura.itemPorId(id)) !== null,
  );
}
