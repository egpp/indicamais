import type { Permissao } from "@/modules/administracao";

/**
 * Estrutura do menu lateral do painel (D-015; IM-005, IM-014). Só dados e regras de exibição: a decisão de quem
 * pode ver cada tela continua no servidor (cada rota devolve 404 a quem não tem permissão). Aqui o menu apenas
 * não oferece o que a pessoa não pode usar.
 */
export type ItemMenu = { href: string; texto: string };
export type GrupoMenu = {
  id: "conteudo" | "aparencia" | "relacionamento" | "indicacoes" | "conta" | "administracao";
  titulo: string;
  itens: ItemMenu[];
};

/** O que a pessoa pode usar na administração (D-014): administrador geral e/ou permissões individuais. */
export type AcessoAdministracao = { geral: boolean; permissoes: readonly Permissao[] };

/** Itens da administração, cada um só para quem pode usá-lo (mesma regra das rotas). */
export function itensAdministracao({ geral, permissoes }: AcessoAdministracao): ItemMenu[] {
  const itens: (ItemMenu | false)[] = [
    geral && { href: "/administracao/revisao", texto: "Fila de revisão" },
    permissoes.includes("analisar_denuncias") && {
      href: "/administracao/denuncias",
      texto: "Denúncias",
    },
    permissoes.includes("suspender") && { href: "/administracao/contas", texto: "Contas" },
    permissoes.includes("invalidar_indicacoes") && {
      href: "/administracao/indicacoes",
      texto: "Invalidar indicações",
    },
    geral && { href: "/administracao/permissoes", texto: "Permissões" },
    geral && { href: "/administracao/pontos", texto: "Pontos (administração)" },
    geral && { href: "/administracao/beneficios", texto: "Benefícios (administração)" },
    geral && { href: "/administracao/parametros", texto: "Parâmetros" },
    geral && { href: "/administracao/patrocinadores", texto: "Patrocinadores" },
    geral && { href: "/administracao/categorias", texto: "Categorias" },
    geral && { href: "/administracao/pedidos", texto: "Pedidos (administração)" },
    geral && { href: "/administracao/negocios", texto: "Perfis e itens" },
    geral && { href: "/administracao/estilos", texto: "Estilos de página" },
  ];
  return itens.filter((i): i is ItemMenu => i !== false);
}

export function gruposDoMenu(acesso: AcessoAdministracao): GrupoMenu[] {
  const grupos: GrupoMenu[] = [
    {
      id: "conteudo",
      titulo: "Meu conteúdo",
      itens: [
        { href: "/meus-perfis", texto: "Meus perfis" },
        { href: "/meus-itens", texto: "Meus itens" },
        { href: "/meus-anuncios", texto: "Meus anúncios" },
        { href: "/minhas-revisoes", texto: "Minhas revisões" },
      ],
    },
    {
      id: "aparencia",
      titulo: "Aparência",
      itens: [
        { href: "/aparencia", texto: "Estilo da página" },
        { href: "/aparencia/banners", texto: "Banners da página" },
      ],
    },
    {
      id: "relacionamento",
      titulo: "Relacionamento",
      itens: [
        { href: "/pedidos-de-contato", texto: "Pedidos de contato" },
        { href: "/minhas-participacoes", texto: "Minhas participações" },
      ],
    },
    {
      id: "indicacoes",
      titulo: "Indicações e pontos",
      itens: [
        { href: "/minhas-indicacoes", texto: "Minhas indicações" },
        { href: "/avisos/quem-me-indicou", texto: "Quem me indicou" },
        { href: "/pontos", texto: "Meus pontos" },
        { href: "/avisos", texto: "Avisos" },
      ],
    },
    {
      id: "conta",
      titulo: "Minha conta",
      itens: [
        { href: "/minha-conta", texto: "Minha conta" },
        { href: "/politica-de-privacidade", texto: "Política de privacidade" },
      ],
    },
  ];
  const adm = itensAdministracao(acesso);
  if (adm.length > 0) grupos.push({ id: "administracao", titulo: "Administração", itens: adm });
  return grupos;
}

/** Rota que cada valor de `atual` do PainelPagina representa (usado até o navegador informar o endereço real). */
export const HREF_POR_ATUAL = {
  perfis: "/meus-perfis",
  aparencia: "/aparencia",
  itens: "/meus-itens",
  anuncios: "/meus-anuncios",
  pedidos: "/pedidos-de-contato",
  indicacoes: "/minhas-indicacoes",
  pontos: "/pontos",
  avisos: "/avisos",
  quem: "/avisos/quem-me-indicou",
  participacoes: "/minhas-participacoes",
  revisoes: "/minhas-revisoes",
  conta: "/minha-conta",
  administracao: "/administracao/revisao",
} as const;

export type AtualMenu = keyof typeof HREF_POR_ATUAL;

/** Item ativo: o de endereço igual ou o mais longo que é prefixo do caminho atual. */
export function hrefAtivo(caminho: string, grupos: readonly GrupoMenu[]): string | null {
  let melhor: string | null = null;
  // /meus-perfis/<id>/aparencia pertence ao grupo Aparência, não a Meus perfis.
  if (/^\/meus-perfis\/[^/]+\/aparencia(\/|$)/.test(caminho)) return "/aparencia";
  if (/^\/meus-perfis\/[^/]+\/banners(\/|$)/.test(caminho)) return "/aparencia/banners";
  for (const g of grupos) {
    for (const i of g.itens) {
      const casa = caminho === i.href || caminho.startsWith(`${i.href}/`);
      if (casa && (melhor === null || i.href.length > melhor.length)) melhor = i.href;
    }
  }
  return melhor;
}

/** Grupo que contém o item ativo (abre sozinho). */
export function grupoDoHref(
  href: string | null,
  grupos: readonly GrupoMenu[],
): GrupoMenu["id"] | null {
  if (!href) return null;
  return grupos.find((g) => g.itens.some((i) => i.href === href))?.id ?? null;
}
