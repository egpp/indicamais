import type { ServicoAparencia } from "@/modules/perfis";
import { lerDeFormData } from "./entrada-conteudo";
import { deErro, valoresDe, type Resposta } from "./resposta";

/**
 * Tratadores da aparência da página (D-016; IM-091, IM-093, IM-094): leem o formulário, chamam o serviço do módulo
 * perfis e devolvem o estado da tela. Sem regra de negócio e sem texto de banco (as mensagens vêm do módulo).
 */
export const MENSAGENS_TELA_APARENCIA = {
  estiloSalvo: "Estilo salvo. A página já aparece assim para os visitantes.",
  estiloHabilitado: "Estilo liberado para os responsáveis.",
  estiloDesabilitado:
    "Estilo recolhido. Páginas que o usam passam a aparecer no estilo Minimalista até ele voltar.",
  bannersSalvos:
    "Banners salvos no rascunho. Eles ainda NÃO foram enviados: envie o site para aprovação.",
  aceito: "Banner aceito. Ele já pode aparecer na sua página.",
  recusado: "Banner recusado. O administrador verá o motivo.",
  exibindo: "Banner volta a aparecer na página.",
  oculto: "Banner oculto da página.",
  adicionado: "Banner enviado ao responsável. Ele só aparece na página depois do aceite.",
  removido: "Banner retirado.",
  entradaInvalida: "Confira os dados informados e tente de novo.",
} as const;

const ler = (f: FormData) => lerDeFormData(f);

export async function salvarEstilo(servico: ServicoAparencia, f: FormData): Promise<Resposta> {
  const l = ler(f);
  const r = await servico.definirEstilo({ perfilId: l("perfilId"), estilo: l("estilo") });
  return r.ok
    ? { sucesso: MENSAGENS_TELA_APARENCIA.estiloSalvo, valores: { estilo: l("estilo") } }
    : deErro(r.erro, { estilo: l("estilo") });
}

export async function habilitarEstilo(servico: ServicoAparencia, f: FormData): Promise<Resposta> {
  const l = ler(f);
  const habilitado = l("habilitado") === "sim";
  const valores = valoresDe(f, ["motivo"]);
  const r = await servico.definirEstiloHabilitado({
    estilo: l("estilo"),
    habilitado,
    motivo: l("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso: habilitado
      ? MENSAGENS_TELA_APARENCIA.estiloHabilitado
      : MENSAGENS_TELA_APARENCIA.estiloDesabilitado,
  };
}

/** `banners` chega como JSON (a lista inteira na ordem da tela); o módulo valida item a item. */
export async function salvarBanners(servico: ServicoAparencia, f: FormData): Promise<Resposta> {
  const l = ler(f);
  let lista: unknown;
  try {
    lista = JSON.parse(l("banners") || "[]");
  } catch {
    return { erro: MENSAGENS_TELA_APARENCIA.entradaInvalida };
  }
  const r = await servico.gravarBanners(l("perfilId"), lista);
  return r.ok ? { sucesso: MENSAGENS_TELA_APARENCIA.bannersSalvos } : deErro(r.erro);
}

export async function responderBanner(servico: ServicoAparencia, f: FormData): Promise<Resposta> {
  const l = ler(f);
  const aceitar = l("decisao") === "aceitar";
  const valores = valoresDe(f, ["motivo"]);
  const r = await servico.responderBanner({
    bannerId: l("bannerId"),
    aceitar,
    motivo: aceitar ? null : l("motivo"),
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: aceitar ? MENSAGENS_TELA_APARENCIA.aceito : MENSAGENS_TELA_APARENCIA.recusado };
}

export async function definirBannerAtivo(
  servico: ServicoAparencia,
  f: FormData,
): Promise<Resposta> {
  const l = ler(f);
  const ativo = l("ativo") === "sim";
  const r = await servico.definirBannerAtivo({ bannerId: l("bannerId"), ativo });
  if (!r.ok) return deErro(r.erro);
  return { sucesso: ativo ? MENSAGENS_TELA_APARENCIA.exibindo : MENSAGENS_TELA_APARENCIA.oculto };
}

export async function adicionarBannerAdmin(
  servico: ServicoAparencia,
  f: FormData,
): Promise<Resposta> {
  const l = ler(f);
  const valores = valoresDe(f, ["textoAlternativo", "motivo", "destinoSecao"]);
  const r = await servico.adicionarBannerAdmin({
    perfilId: l("perfilId"),
    imagemPath: l("imagemPath"),
    textoAlternativo: l("textoAlternativo"),
    motivo: l("motivo"),
    destinoSecao: l("destinoSecao") || null,
  });
  if (!r.ok) return deErro(r.erro, valores);
  return { sucesso: MENSAGENS_TELA_APARENCIA.adicionado };
}

export async function removerBannerAdmin(
  servico: ServicoAparencia,
  f: FormData,
): Promise<Resposta> {
  const l = ler(f);
  const valores = valoresDe(f, ["motivo"]);
  const r = await servico.removerBannerAdmin({ bannerId: l("bannerId"), motivo: l("motivo") });
  return r.ok ? { sucesso: MENSAGENS_TELA_APARENCIA.removido } : deErro(r.erro, valores);
}
