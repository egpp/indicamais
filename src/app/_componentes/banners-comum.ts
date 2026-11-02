import type { DestinoSecaoBanner } from "@/modules/perfis";

/** Seções da própria página que um banner pode apontar (IM-092, IM-093). Nada de link externo (IM-012). */
export const ROTULOS_DESTINO_BANNER: Record<DestinoSecaoBanner, string> = {
  inicio: "Início",
  sobre: "Sobre",
  produtos_servicos: "Produtos e serviços",
  beneficios: "Benefícios",
  localizacao: "Localização",
  contato: "Contato",
};

export const rotuloDestinoBanner = (d: DestinoSecaoBanner | null): string =>
  d ? ROTULOS_DESTINO_BANNER[d] : "Sem destino";
