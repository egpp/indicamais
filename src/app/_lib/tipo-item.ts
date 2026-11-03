import { obterServicoConsultaNegocios } from "./contexto-negocios";

export const ROTULO_TIPO_ITEM = {
  produto: "Produto",
  servico: "Serviço",
  imovel: "Imóvel",
} as const;

/** Rótulo do tipo do item; sem informação, o texto genérico anterior. */
export function rotuloTipoItem(tipo: string | null | undefined): string {
  if (tipo && tipo in ROTULO_TIPO_ITEM) {
    return ROTULO_TIPO_ITEM[tipo as keyof typeof ROTULO_TIPO_ITEM];
  }
  // Já é um rótulo vindo da consulta de negócios.
  if (tipo && (Object.values(ROTULO_TIPO_ITEM) as string[]).includes(tipo)) return tipo;
  return "Produto ou serviço";
}

/**
 * Administrador: tipo (rótulo) de cada item, pela consulta de negócios que já existe (visão só de administrador,
 * sem dado privado). Falha = mapa vazio (a tela cai no rótulo genérico). Limite de 10 páginas (200 itens).
 */
export async function tiposDeItensParaAdmin(voltarPara: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  try {
    const servico = await obterServicoConsultaNegocios(voltarPara);
    for (let pagina = 1; pagina <= 10; pagina++) {
      const r = await servico.consultar({ tipo: "item", pagina });
      if (!r.ok) break;
      for (const n of r.valor.itens) mapa.set(n.chave.replace(/^item:/, ""), n.tipoRotulo);
      if (!r.valor.temProxima) break;
    }
  } catch {
    /* rótulo genérico */
  }
  return mapa;
}
