/**
 * Caminhos das páginas públicas, em um lugar só. PROVISÓRIO: a Fase 3 define as rotas reais
 * (dúvida registrada ao gestor). Os slugs reservados já cobrem "perfil", "anuncio" e "item".
 */
export const ROTAS_PUBLICAS = {
  perfil: (slug: string) => `/perfil/${encodeURIComponent(slug)}`,
  item: (id: string) => `/item/${encodeURIComponent(id)}`,
} as const;
