/**
 * PONTO ÚNICO de decisão da "ação de compra" (D-022, D-023; IM-097, IM-101). Todo botão de comprar, pedir, adicionar
 * ou "conhecer este plano" da página do negócio pergunta aqui o que fazer; ninguém monta o destino por conta própria.
 * Hoje a venda NÃO é intermediada (IM-090): a ação leva ao contato com o dono (IM-013) ou acrescenta o item à lista
 * de interesse, que vira mensagem de contato. Quando o pagamento existir (módulo pagamentos, F), entra um novo modo
 * aqui e o componente `AcaoCompra` o trata, sem refatorar os cartões nem as seções. Nada de pagamento agora.
 */
export type AcaoCompraResolvida =
  { modo: "contato"; rotulo: string; href: string } | { modo: "lista"; rotulo: string };

export type ContextoAcaoCompra = {
  tipoItem: "produto" | "servico" | "imovel";
  /** Plano do negócio (vitrine): sempre leva ao contato. */
  plano?: boolean;
};

/**
 * A lista de interesse vale para todos os estilos: o estilo muda só a aparência, nunca o conteúdo (IM-091, IM-094),
 * ainda que os modelos 6, 11, 15, 17, 18 e 20 sejam os que a desenham.
 */
export const ANCORA_CONTATO = "#contato-site";

export function resolverAcaoCompra(c: ContextoAcaoCompra): AcaoCompraResolvida {
  if (c.plano) return { modo: "contato", rotulo: "Conhecer este plano", href: ANCORA_CONTATO };
  if (c.tipoItem === "imovel") {
    return { modo: "contato", rotulo: "Tenho interesse", href: ANCORA_CONTATO };
  }
  return { modo: "lista", rotulo: "Adicionar à lista" };
}
