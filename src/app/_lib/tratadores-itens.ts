import type { Contexto } from "./contexto";
import {
  CAMPOS_ITEM,
  MENSAGEM_ESCOLHA_PERFIL,
  lerCamposItem,
  lerDeFormData,
  lerNovoItem,
  perfilObrigatorioFaltando,
} from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/** Tratadores dos formulários de item (produto ou serviço) e de anúncio particular (IM-014, IM-015). */

export const MENSAGENS_TELA_ITEM = {
  salvo:
    "Alterações salvas no rascunho. Elas ainda NÃO foram enviadas: clique em Enviar para aprovação.",
  novaVersao:
    "Edição salva como rascunho. Ela ainda NÃO foi enviada: clique em Enviar para aprovação. A versão aprovada continua no ar até a nova ser aprovada.",
  fotoSalva: "Foto salva.",
  enviado: "Enviado para aprovação. O resultado aparece em Minhas revisões.",
  publicado: "Publicado.",
  despublicado: "Despublicado. Saiu do ar agora.",
} as const;

const id = (f: FormData) => lerDeFormData(f)("id");

export async function criarItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f, CAMPOS_ITEM);
  if (perfilObrigatorioFaltando(ler)) {
    return { erros: { perfilId: MENSAGEM_ESCOLHA_PERFIL }, valores };
  }
  const r = await ctx.itens.criarRascunho(lerNovoItem(ler));
  if (!r.ok) return deErro(r.erro, valores);
  return { destino: `/meus-itens/${r.valor.id}?aviso=criado` };
}

export async function editarItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS_ITEM);
  const r = await ctx.itens.editar(id(f), lerCamposItem(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: r.valor.criouNovaVersao ? MENSAGENS_TELA_ITEM.novaVersao : MENSAGENS_TELA_ITEM.salvo,
    valores,
  };
}

export async function salvarFotoItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.itens.editar(id(f), { fotoPath: lerDeFormData(f)("fotoPath") });
  if (!r.ok) return deErro(r.erro);
  return {
    sucesso: r.valor.criouNovaVersao
      ? MENSAGENS_TELA_ITEM.novaVersao
      : MENSAGENS_TELA_ITEM.fotoSalva,
  };
}

export async function enviarItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.itens.enviarParaAprovacao(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_ITEM.enviado } : deErro(r.erro);
}

export async function publicarItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.itens.publicar(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_ITEM.publicado } : deErro(r.erro);
}

export async function despublicarItem(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.itens.despublicar(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_ITEM.despublicado } : deErro(r.erro);
}
