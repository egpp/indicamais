import { MENSAGENS_INDICACOES, type ErroIndicacoes } from "@/modules/indicacoes";
import type { ContextoIndicacoes } from "./contexto-indicacoes";
import { lerDeFormData } from "./entrada-conteudo";
import type { EstadoContato, EstadoLink } from "./estado-indicacoes";
import { valoresDe } from "./resposta";

/**
 * Tratadores da Fase 3 (IM-024 a IM-029, IM-034). Só leem o formulário, chamam o serviço do módulo e
 * transformam o resultado em estado de tela. Nenhuma regra de negócio. Mensagens vêm do módulo, nunca do banco.
 */

export type Destino =
  | { tipo: "perfil"; id: string; slug: string; nome: string }
  | { tipo: "item"; id: string; nome: string };

/**
 * Resolve o destino NO SERVIDOR a partir das visões públicas (só o que está aprovado, publicado e disponível):
 * nome, slug e id não vêm do navegador como verdade. Perfil: por slug (página) ou por id (lista de links).
 */
export async function resolverDestino(
  ctx: ContextoIndicacoes,
  f: FormData,
): Promise<Destino | null> {
  const ler = lerDeFormData(f);
  const tipo = ler("tipo");
  if (tipo === "item") {
    const d = await ctx.leitura.itemPorId(ler("id").trim());
    return d ? { tipo: "item", id: d.item.id, nome: d.item.nome ?? "" } : null;
  }
  if (tipo !== "perfil") return null;
  const slug = ler("slug").trim();
  const p = slug
    ? (await ctx.leitura.perfilPorSlug(slug))?.perfil
    : await ctx.leitura.perfilPorId(ler("id").trim());
  return p ? { tipo: "perfil", id: p.id, slug: p.slug, nome: p.nome ?? "" } : null;
}

async function destinoOuNulo(ctx: ContextoIndicacoes, f: FormData): Promise<Destino | null> {
  try {
    return await resolverDestino(ctx, f);
  } catch {
    return null;
  }
}

// Contato do visitante (IM-026, IM-028) ---------------------------------------------------------------------

export const CAMPOS_CONTATO = ["nome", "whatsapp", "email", "mensagem"] as const;
const CAMPOS_EXIBIDOS = new Set<string>(CAMPOS_CONTATO);

export const MENSAGENS_TELA_CONTATO = {
  enviado: "Pedido enviado. O responsável foi avisado no painel dele.",
} as const;

/** Erros por campo só nos campos visíveis do formulário; o resto (destino, chave) vira aviso geral. */
function errosDoContato(erro: ErroIndicacoes, valores: Record<string, string>): EstadoContato {
  const visiveis = Object.entries(erro.campos ?? {}).filter(([k]) => CAMPOS_EXIBIDOS.has(k));
  if (visiveis.length > 0) return { erros: Object.fromEntries(visiveis), valores };
  return { erro: erro.mensagem, valores };
}

export async function enviarContatoVisitante(
  ctx: ContextoIndicacoes,
  f: FormData,
): Promise<EstadoContato> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_CONTATO);
  const destino = await destinoOuNulo(ctx, f);
  if (!destino) return { erro: MENSAGENS_INDICACOES.destinoIndisponivel, valores };
  const r = await ctx.servico.enviarContato({
    ...(destino.tipo === "perfil" ? { perfilId: destino.id } : { itemId: destino.id }),
    nomeDestino: destino.nome,
    nome: ler("nome"),
    whatsapp: ler("whatsapp"),
    email: ler("email"),
    mensagem: ler("mensagem"),
    // IM-025: o código só vale para ESTE destino (a página e o formulário são do mesmo destino).
    codigo: ler("ind"),
    chave: ler("chave"),
  });
  if (!r.ok) return errosDoContato(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_CONTATO.enviado, urlWhatsapp: r.valor.urlWhatsappResponsavel };
}

// Indique (IM-024) ------------------------------------------------------------------------------------------

export async function gerarLinkDeIndicacao(
  ctx: ContextoIndicacoes,
  f: FormData,
): Promise<EstadoLink> {
  if (!ctx.logado) return { erro: MENSAGENS_INDICACOES.naoAutenticado, passo: "entrar" };
  const destino = await destinoOuNulo(ctx, f);
  if (!destino) return { erro: MENSAGENS_INDICACOES.destinoIndisponivel };
  const r = await ctx.servico.gerarLink(destino);
  if (!r.ok) {
    switch (r.erro.codigo) {
      case "NAO_AUTENTICADO":
        return { erro: r.erro.mensagem, passo: "entrar" };
      case "SEM_WHATSAPP":
        return { erro: r.erro.mensagem, passo: "whatsapp" };
      case "AUTOINDICACAO":
        return { erro: r.erro.mensagem, passo: "autoindicacao" };
      default:
        return { erro: r.erro.mensagem };
    }
  }
  const { codigo, url, texto, urlWhatsapp } = r.valor;
  return { link: { codigo, url, texto, urlWhatsapp } };
}

/** Registro do compartilhamento: informativo, nunca atrapalha o usuário (não pontua). */
export async function registrarCompartilhamentoDeLink(
  ctx: ContextoIndicacoes,
  codigo: string,
  canal: string,
): Promise<boolean> {
  if (!ctx.logado) return false;
  const r = await ctx.servico.registrarCompartilhamento({ codigo, canal });
  return r.ok;
}

// Responsável (IM-028) --------------------------------------------------------------------------------------

export const MENSAGENS_TELA_PEDIDOS = {
  reenvioSolicitado: "Novo envio solicitado.",
  reenvioAdmin: "Reenvio solicitado.",
  alertaTratado: "Alerta marcado como tratado.",
  parametroAlterado: "Parâmetro atualizado.",
} as const;

export async function pedirReenvio(ctx: ContextoIndicacoes, f: FormData): Promise<EstadoLink> {
  const r = await ctx.servico.solicitarReenvio({ pedidoId: lerDeFormData(f)("pedidoId") });
  return r.ok ? { sucesso: MENSAGENS_TELA_PEDIDOS.reenvioSolicitado } : { erro: r.erro.mensagem };
}

// Administração (IM-028, IM-034) ----------------------------------------------------------------------------

async function soAdministrador(ctx: ContextoIndicacoes): Promise<EstadoLink | null> {
  return (await ctx.ehAdministrador()) ? null : { erro: MENSAGENS_INDICACOES.semPermissao };
}

function comMotivo(
  r: { ok: true } | { ok: false; erro: ErroIndicacoes },
  sucesso: string,
  valores: Record<string, string>,
): EstadoLink {
  if (r.ok) return { sucesso, valores: { ...valores, motivo: "" } };
  const motivo = r.erro.campos?.motivo;
  return motivo ? { erros: { motivo }, valores } : { erro: r.erro.mensagem, valores };
}

export async function reenviarComoAdmin(ctx: ContextoIndicacoes, f: FormData): Promise<EstadoLink> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.servico.reenviarComoAdmin({
    pedidoId: ler("pedidoId"),
    motivo: ler("motivo"),
  });
  return comMotivo(r, MENSAGENS_TELA_PEDIDOS.reenvioAdmin, valores);
}

export async function tratarAlertaAdmin(ctx: ContextoIndicacoes, f: FormData): Promise<EstadoLink> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await ctx.servico.tratarAlerta({ pedidoId: ler("pedidoId"), motivo: ler("motivo") });
  return comMotivo(r, MENSAGENS_TELA_PEDIDOS.alertaTratado, valores);
}

export async function definirParametroAdmin(
  ctx: ContextoIndicacoes,
  f: FormData,
): Promise<EstadoLink> {
  const bloqueio = await soAdministrador(ctx);
  if (bloqueio) return bloqueio;
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, ["valor", "motivo"]);
  const bruto = ler("valor").trim();
  const r = await ctx.servico.definirParametro({
    chave: ler("chave"),
    // Texto ilegível vira NaN: o schema do módulo responde com "Informe um número inteiro."
    valor: bruto === "" ? Number.NaN : Number(bruto),
    motivo: ler("motivo"),
  });
  if (r.ok) {
    return {
      sucesso: MENSAGENS_TELA_PEDIDOS.parametroAlterado,
      valores: { valor: valores.valor ?? "", motivo: "" },
    };
  }
  const erros = Object.fromEntries(
    Object.entries(r.erro.campos ?? {}).filter(([k]) => k === "valor" || k === "motivo"),
  );
  return Object.keys(erros).length > 0 ? { erros, valores } : { erro: r.erro.mensagem, valores };
}
