import type { ServicoLocalizacao } from "@/modules/perfis";
import type { Contexto } from "./contexto";
import { lerDeFormData } from "./entrada-conteudo";
import { deErro, type Resposta } from "./resposta";
import { lerCoordenadas } from "./validacao-localizacao";

/**
 * Tratadores do mapa (D-016; IM-018, IM-092): leem o formulário e chamam o serviço de localização do módulo
 * perfis. Sem regra de negócio e sem texto de banco. A coordenada vale na versão aberta (ou, sem ela, na
 * aprovada); o mapa só aparece na página depois que a versão for aprovada (decide o banco).
 */
export const MENSAGENS_TELA_MAPA = {
  localizado:
    "Endereço localizado no mapa. O mapa só aparece na página depois que a versão do perfil for aprovada.",
  naoLocalizado:
    "Não encontramos este endereço no mapa. Confira endereço, cidade e UF, ou informe as coordenadas abaixo.",
  semEndereco: "Preencha endereço, cidade e UF do perfil para localizar no mapa.",
  informado:
    "Coordenadas salvas. O mapa só aparece na página depois que a versão do perfil for aprovada.",
  foraDoBrasil: " Atenção: estas coordenadas ficam fora do Brasil. Confira se estão certas.",
  removido: "Coordenadas removidas. A página fica sem mapa.",
  ligado: "Mapa ligado. Ele aparece na página assim que houver coordenadas na versão aprovada.",
  desligado: "Mapa desligado. A página volta a mostrar só o endereço.",
} as const;

async function versaoAlvo(ctx: Contexto, perfilId: string) {
  const r = await ctx.perfis.obter(perfilId);
  if (!r.ok)
    return { erro: r.erro ?? { mensagem: "Não foi possível concluir. Tente de novo." } } as const;
  const v = r.valor;
  const c = v.conteudoEdicao;
  return {
    ok: true,
    versaoId: v.versaoAbertaId ?? v.versaoAprovadaId,
    temEndereco: Boolean(c.endereco?.trim() && c.cidade?.trim() && c.uf?.trim()),
  } as const;
}

export async function localizarNoMapa(
  ctx: Contexto,
  loc: ServicoLocalizacao,
  f: FormData,
): Promise<Resposta> {
  const alvo = await versaoAlvo(ctx, lerDeFormData(f)("id"));
  if (!alvo.ok) return deErro(alvo.erro);
  if (!alvo.versaoId || !alvo.temEndereco) return { erro: MENSAGENS_TELA_MAPA.semEndereco };
  const r = await loc.localizarVersao(alvo.versaoId);
  if (!r.ok) return deErro(r.erro);
  return r.valor.localizado
    ? { sucesso: MENSAGENS_TELA_MAPA.localizado }
    : { erro: MENSAGENS_TELA_MAPA.naoLocalizado };
}

export async function informarCoordenadasMapa(
  ctx: Contexto,
  loc: ServicoLocalizacao,
  f: FormData,
): Promise<Resposta> {
  const ler = lerDeFormData(f);
  const valores = { latitude: ler("latitude"), longitude: ler("longitude") };
  const lidas = lerCoordenadas(valores);
  if (!lidas.ok) return { erros: lidas.erros, valores };
  const alvo = await versaoAlvo(ctx, ler("id"));
  if (!alvo.ok) return deErro(alvo.erro, valores);
  if (!alvo.versaoId || !alvo.temEndereco) {
    return { erro: MENSAGENS_TELA_MAPA.semEndereco, valores };
  }
  const r = await loc.informarCoordenadas(
    alvo.versaoId,
    lidas.valor.latitude,
    lidas.valor.longitude,
  );
  if (!r.ok) return deErro(r.erro, valores);
  return {
    sucesso:
      MENSAGENS_TELA_MAPA.informado +
      (r.valor.avisoForaDoBrasil ? MENSAGENS_TELA_MAPA.foraDoBrasil : ""),
  };
}

export async function removerCoordenadasMapa(
  ctx: Contexto,
  loc: ServicoLocalizacao,
  f: FormData,
): Promise<Resposta> {
  const alvo = await versaoAlvo(ctx, lerDeFormData(f)("id"));
  if (!alvo.ok) return deErro(alvo.erro);
  if (!alvo.versaoId) return { sucesso: MENSAGENS_TELA_MAPA.removido };
  const r = await loc.limparCoordenadas(alvo.versaoId);
  return r.ok ? { sucesso: MENSAGENS_TELA_MAPA.removido } : deErro(r.erro);
}

export async function definirMostrarMapaTela(
  loc: ServicoLocalizacao,
  f: FormData,
): Promise<Resposta> {
  const ler = lerDeFormData(f);
  const mostrar = ler("mostrar") === "true";
  const r = await loc.definirMostrarMapa(ler("id"), mostrar);
  if (!r.ok) return deErro(r.erro);
  return { sucesso: mostrar ? MENSAGENS_TELA_MAPA.ligado : MENSAGENS_TELA_MAPA.desligado };
}

/**
 * Localização automática depois de salvar/enviar a versão (D-016). Nunca quebra o salvar: qualquer falha
 * (geocodificador fora do ar, endereço sem resultado, erro do banco) é engolida e o mapa só não aparece.
 */
export async function localizarSeguro(
  ctx: Contexto,
  loc: ServicoLocalizacao,
  perfilId: string,
): Promise<void> {
  try {
    const alvo = await versaoAlvo(ctx, perfilId);
    if (!alvo.ok || !alvo.versaoId || !alvo.temEndereco) return;
    await loc.localizarVersao(alvo.versaoId);
  } catch {
    /* silencioso: o endereço nunca vai para log */
  }
}

/** Impressão do endereço do perfil, para saber se mudou entre dois momentos. */
export async function impressaoEndereco(ctx: Contexto, perfilId: string): Promise<string> {
  try {
    const r = await ctx.perfis.obter(perfilId);
    if (!r.ok) return "";
    const c = r.valor.conteudoEdicao;
    return [c.endereco, c.cidade, c.uf].map((x) => (x ?? "").trim().toLowerCase()).join("|");
  } catch {
    return "";
  }
}
