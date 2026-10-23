import { LIMITES } from "@/shared/config/limites";
import { SLUG_FORMATO, slugComSufixo, slugificar } from "@/shared/formatacao/slug";

/**
 * Slug do perfil (IM-011): minúsculas, sem acentos, a-z0-9 e hífen, único (o banco garante),
 * e nunca igual a uma rota do sistema. O slug vira endereço público e fica congelado
 * depois da primeira aprovação (gatilho do banco).
 */

/** Nomes que conflitam com rotas atuais ou previstas. Em minúsculas, já no formato de slug. */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  // rotas existentes
  "entrar",
  "cadastro",
  "minha-conta",
  "auth",
  "api",
  "recuperar-senha",
  "redefinir-senha",
  "reenviar-confirmacao",
  // administração e conta
  "admin",
  "administrador",
  "administracao",
  "painel",
  "dashboard",
  "conta",
  "contas",
  "login",
  "logout",
  "sair",
  "cadastrar",
  "registro",
  "senha",
  "configuracoes",
  "ajuda",
  "suporte",
  "sobre",
  "termos",
  "privacidade",
  "contato",
  // conteúdo
  "categorias",
  "categoria",
  "perfil",
  "perfis",
  "anuncio",
  "anuncios",
  "produto",
  "produtos",
  "servico",
  "servicos",
  "item",
  "itens",
  "catalogo",
  "busca",
  "buscar",
  "explorar",
  "novo",
  "nova",
  "editar",
  "previa",
  // módulos de negócio, atuais e futuros
  "indicar",
  "indicacao",
  "indicacoes",
  "pontos",
  "resgates",
  "comissoes",
  "relacionamento",
  "notificacoes",
  "planos",
  "social",
  "remarketing",
  "pagamentos",
  // infraestrutura
  "_next",
  "static",
  "public",
  "assets",
  "favicon",
  "robots",
  "sitemap",
  "www",
  "app",
  "home",
  "inicio",
  "indicamais",
  "null",
  "undefined",
]);

export type ResultadoSlug =
  { ok: true; slug: string } | { ok: false; codigo: "FORMATO" | "RESERVADO"; mensagem: string };

export function slugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.has(slug.trim().toLowerCase());
}

/** Valida um slug digitado. Não normaliza em silêncio: ou está certo ou volta erro. */
export function validarSlug(entrada: string): ResultadoSlug {
  const slug = (entrada ?? "").trim();
  const { slugMin, slugMax } = LIMITES.perfil;
  if (slug.length < slugMin || slug.length > slugMax || !SLUG_FORMATO.test(slug)) {
    return {
      ok: false,
      codigo: "FORMATO",
      mensagem: `O endereço deve ter de ${slugMin} a ${slugMax} caracteres, só letras minúsculas sem acento, números e hífen.`,
    };
  }
  if (slugReservado(slug)) {
    return {
      ok: false,
      codigo: "RESERVADO",
      mensagem: "Este endereço é reservado pelo sistema. Escolha outro.",
    };
  }
  return { ok: true, slug };
}

/** Slug sugerido a partir do nome; null quando o nome não rende ao menos 3 caracteres. */
export function gerarSlugDeNome(nome: string): string | null {
  const s = slugificar(nome, LIMITES.perfil.slugMax);
  return s.length >= LIMITES.perfil.slugMin ? s : null;
}

/**
 * Candidatos em ordem: "loja", "loja-2", "loja-3"... Pula os reservados. Usado quando o slug é
 * gerado (o banco decide a unicidade: 23505 -> próximo candidato).
 */
export function candidatosDeSlug(base: string, quantidade = 6): string[] {
  const lista: string[] = [];
  for (let n = 1; lista.length < quantidade && n <= quantidade + 10; n++) {
    const c = n === 1 ? base : slugComSufixo(base, n, LIMITES.perfil.slugMax);
    if (!slugReservado(c) && validarSlug(c).ok) lista.push(c);
  }
  return lista;
}
