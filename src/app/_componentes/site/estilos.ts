/**
 * Estilos de página dos negócios (D-016; IM-091). UM arquivo concentra os 20 ids, os rótulos e o que está liberado.
 * Os 20 estilos estão com desenho pronto (`site-estilos.css`: 1 a 5; `site-estilos-novos.css`: 6 a 20). Para um estilo
 * futuro sem desenho, passe `liberado = false` em `T(...)`. Quais estilos cada responsável pode escolher é decidido
 * no banco (`perfis_estilo_pagina.habilitado`), pela tela do administrador.
 * A escolha do responsável ainda não é gravada (virá com o banco): hoje o estilo vem da prévia (?estilo=) ou é o padrão.
 */
export const ESTILO_PADRAO = "minimalista" as const;

export const IDS_ESTILOS = [
  "minimalista",
  "saude_bem_estar",
  "beleza_estetica",
  "gastronomia",
  "cafe_padaria",
  "construcao_reformas",
  "automotivo",
  "juridico_contabil",
  "educacao_cursos",
  "pet",
  "moda_lojas",
  "fitness_esportes",
  "imobiliario",
  "tecnologia_assistencia",
  "casa_decoracao",
  "eventos_fotografia",
  "servicos_rapidos",
  "agro_campo",
  "turismo_hospedagem",
  "premium",
] as const;

export type EstiloId = (typeof IDS_ESTILOS)[number];

export type TemaEstilo = {
  id: EstiloId;
  rotulo: string;
  descricao: string;
  /** Só os liberados mudam a aparência; os demais (hoje nenhum) caem no padrão e aparecem como "em breve". */
  liberado: boolean;
};

const T = (id: EstiloId, rotulo: string, descricao: string, liberado = true): TemaEstilo => ({
  id,
  rotulo,
  descricao,
  liberado,
});

export const TEMAS: Record<EstiloId, TemaEstilo> = {
  minimalista: T(
    "minimalista",
    "Minimalista",
    "Limpo, claro e direto. Serve para qualquer negócio.",
    true,
  ),
  saude_bem_estar: T("saude_bem_estar", "Saúde e Bem-estar", "Tons calmos e cantos suaves.", true),
  beleza_estetica: T("beleza_estetica", "Beleza e Estética", "Elegante, com rosa e dourado.", true),
  gastronomia: T(
    "gastronomia",
    "Gastronomia",
    "Quente e acolhedor, com tipografia clássica.",
    true,
  ),
  cafe_padaria: T("cafe_padaria", "Café e Padaria", "Aconchegante e artesanal."),
  construcao_reformas: T(
    "construcao_reformas",
    "Construção e Reformas",
    "Forte, técnico e sólido.",
    true,
  ),
  automotivo: T("automotivo", "Automotivo", "Velocidade e robustez."),
  juridico_contabil: T("juridico_contabil", "Jurídico e Contábil", "Sóbrio e confiável."),
  educacao_cursos: T("educacao_cursos", "Educação e Cursos", "Claro e didático."),
  pet: T("pet", "Pet", "Alegre e amigável."),
  moda_lojas: T("moda_lojas", "Moda e Lojas", "Vitrine moderna."),
  fitness_esportes: T("fitness_esportes", "Fitness e Esportes", "Energia e movimento."),
  imobiliario: T("imobiliario", "Imobiliário", "Sofisticado e espaçoso."),
  tecnologia_assistencia: T(
    "tecnologia_assistencia",
    "Tecnologia e Assistência",
    "Digital e objetivo.",
  ),
  casa_decoracao: T("casa_decoracao", "Casa e Decoração", "Aconchego e bom gosto."),
  eventos_fotografia: T("eventos_fotografia", "Eventos e Fotografia", "Imagens em destaque."),
  servicos_rapidos: T("servicos_rapidos", "Serviços Rápidos", "Prático e de ação imediata."),
  agro_campo: T("agro_campo", "Agro e Campo", "Natural e robusto."),
  turismo_hospedagem: T("turismo_hospedagem", "Turismo e Hospedagem", "Leve e convidativo."),
  premium: T("premium", "Premium", "Escuro e refinado."),
};

export const LISTA_TEMAS: readonly TemaEstilo[] = IDS_ESTILOS.map((id) => TEMAS[id]);

const ehEstiloId = (v: unknown): v is EstiloId =>
  typeof v === "string" && (IDS_ESTILOS as readonly string[]).includes(v);

/**
 * Valor vindo de fora (URL) -> estilo a aplicar. Desconhecido, vazio, "em breve" ou lista de valores cai no
 * padrão minimalista: a página nunca quebra por causa do parâmetro.
 */
export function resolverEstilo(valor: unknown): EstiloId {
  if (!ehEstiloId(valor)) return ESTILO_PADRAO;
  return TEMAS[valor].liberado ? valor : ESTILO_PADRAO;
}

/** Para a tela de Aparência: o parâmetro só vale se for um estilo liberado (senão null, sem prévia). */
export function estiloLiberadoOuNulo(valor: unknown): EstiloId | null {
  return ehEstiloId(valor) && TEMAS[valor].liberado ? valor : null;
}
