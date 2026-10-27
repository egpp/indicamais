import type { Contexto } from "./contexto";
import {
  CAMPOS_PERFIL,
  lerCamposPerfil,
  lerDeFormData,
  lerImagensPerfil,
  lerNovoPerfil,
} from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/**
 * Tratadores dos formulários de perfil: leem o formulário, chamam o serviço do módulo e devolvem o estado.
 * Sem regra de negócio e sem texto de banco (as mensagens vêm do módulo).
 */

export const MENSAGENS_TELA_PERFIL = {
  salvo:
    "Alterações salvas no rascunho. Elas ainda NÃO foram enviadas: clique em Enviar para aprovação.",
  novaVersao:
    "Edição salva como rascunho. Ela ainda NÃO foi enviada: clique em Enviar para aprovação. A versão aprovada continua no ar até a nova ser aprovada.",
  imagensSalvas: "Imagens salvas.",
  enviado: "Enviado para aprovação. O resultado aparece em Minhas revisões.",
  publicado: "Perfil publicado.",
  despublicado: "Perfil despublicado. Ele saiu do ar agora.",
  enderecoSalvo: "Endereço da página atualizado.",
} as const;

const id = (f: FormData) => lerDeFormData(f)("id");

export async function criarPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS_PERFIL);
  const r = await ctx.perfis.criarRascunho(lerNovoPerfil(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return { destino: `/meus-perfis/${r.valor.id}?aviso=criado` };
}

export async function editarPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const valores = valoresDe(f, CAMPOS_PERFIL);
  const r = await ctx.perfis.editar(id(f), lerCamposPerfil(lerDeFormData(f)));
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: r.valor.criouNovaVersao
      ? MENSAGENS_TELA_PERFIL.novaVersao
      : MENSAGENS_TELA_PERFIL.salvo,
    valores,
  };
}

export async function salvarImagensPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.perfis.editar(id(f), lerImagensPerfil(f));
  if (!r.ok) return deErro(r.erro);
  return {
    sucesso: r.valor.criouNovaVersao
      ? MENSAGENS_TELA_PERFIL.novaVersao
      : MENSAGENS_TELA_PERFIL.imagensSalvas,
  };
}

export async function alterarEnderecoPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const slug = lerDeFormData(f)("slug");
  const r = await ctx.perfis.alterarSlug(id(f), slug);
  if (!r.ok) return deErro(r.erro, { slug });
  return { sucesso: MENSAGENS_TELA_PERFIL.enderecoSalvo, valores: { slug: r.valor.slug } };
}

export async function enviarPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.perfis.enviarParaAprovacao(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_PERFIL.enviado } : deErro(r.erro);
}

export async function publicarPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.perfis.publicar(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_PERFIL.publicado } : deErro(r.erro);
}

export async function despublicarPerfil(ctx: Contexto, f: FormData): Promise<Resposta> {
  const r = await ctx.perfis.despublicar(id(f));
  return r.ok ? { sucesso: MENSAGENS_TELA_PERFIL.despublicado } : deErro(r.erro);
}
