import { pareceLinkOuRede } from "@/modules/perfis";
import { LIMITES } from "@/shared/config/limites";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";

/** Linha de public.administracao_patrocinador_publico (leitura pública). Colunas extras são ignoradas. */
export type LinhaPatrocinadorPublico = {
  id: string;
  identificacao: string | null;
  titulo: string | null;
  imagem_path: string | null;
  destino_tipo: string | null;
  destino_perfil_id: string | null;
  destino_perfil_slug: string | null;
  destino_texto: string | null;
  ordem: number | null;
};

/** Linha de public.administracao_patrocinador lida pelo administrador. */
export type LinhaPatrocinadorAdmin = {
  id: string;
  titulo: string;
  imagem_path: string;
  perfil_destino_id: string | null;
  texto_destino: string | null;
  ordem: number;
  ativo: boolean;
  inicio_em: string | null;
  fim_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** Destino do patrocínio: um perfil público OU um texto. Nunca uma URL externa (D-008). */
export type DestinoPatrocinador =
  { tipo: "perfil"; slug: string; link: string } | { tipo: "texto"; texto: string };

/** Item do carrossel da página inicial. `identificacao` é SEMPRE "Patrocinado" e a tela deve exibi-la. */
export type PatrocinadorPublico = {
  id: string;
  identificacao: "Patrocinado";
  titulo: string;
  /** Caminho opaco no bucket; a URL assinada é gerada no servidor. */
  imagemPath: string;
  destino: DestinoPatrocinador;
  ordem: number;
};

const aparar = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** null = linha inutilizável (sem título/imagem/destino válido): some do carrossel em vez de quebrar. */
export function paraPatrocinadorPublico(l: LinhaPatrocinadorPublico): PatrocinadorPublico | null {
  const titulo = aparar(l.titulo);
  const imagemPath = aparar(l.imagem_path);
  if (!titulo || !imagemPath || typeof l.id !== "string") return null;
  let destino: DestinoPatrocinador;
  if (l.destino_tipo === "perfil") {
    const slug = aparar(l.destino_perfil_slug);
    if (!slug) return null;
    destino = { tipo: "perfil", slug, link: ROTAS_PUBLICAS.perfil(slug) };
  } else if (l.destino_tipo === "texto") {
    const texto = aparar(l.destino_texto);
    // Defesa em profundidade: o carrossel nunca exibe texto que pareça link externo.
    if (!texto || pareceLinkOuRede(texto)) return null;
    destino = { tipo: "texto", texto };
  } else {
    return null;
  }
  return {
    id: l.id,
    identificacao: "Patrocinado",
    titulo,
    imagemPath,
    destino,
    ordem: Number.isFinite(Number(l.ordem)) ? Number(l.ordem) : 0,
  };
}

/** Ordem do administrador (`ordem`, depois título para estabilidade), limitada a 20. */
export function montarCarrossel(linhas: LinhaPatrocinadorPublico[]): PatrocinadorPublico[] {
  return linhas
    .map(paraPatrocinadorPublico)
    .filter((p): p is PatrocinadorPublico => p !== null)
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, LIMITES.patrocinador.maximoNoCarrossel);
}

export type SituacaoPatrocinador = "inativo" | "agendado" | "no_ar" | "encerrado";

/** Situação pelo calendário (não verifica se o perfil de destino segue disponível: o banco confere). */
export function situacaoDoPatrocinador(
  l: Pick<LinhaPatrocinadorAdmin, "ativo" | "inicio_em" | "fim_em">,
  agora: Date,
): SituacaoPatrocinador {
  if (!l.ativo) return "inativo";
  const t = agora.getTime();
  if (l.inicio_em && Date.parse(l.inicio_em) > t) return "agendado";
  if (l.fim_em && Date.parse(l.fim_em) <= t) return "encerrado";
  return "no_ar";
}

export type PatrocinadorAdmin = {
  id: string;
  titulo: string;
  imagemPath: string;
  perfilDestinoId: string | null;
  textoDestino: string | null;
  ordem: number;
  ativo: boolean;
  inicioEm: string | null;
  fimEm: string | null;
  situacao: SituacaoPatrocinador;
  criadoEm: string;
  atualizadoEm: string;
};

export function paraPatrocinadorAdmin(l: LinhaPatrocinadorAdmin, agora: Date): PatrocinadorAdmin {
  return {
    id: l.id,
    titulo: l.titulo,
    imagemPath: l.imagem_path,
    perfilDestinoId: l.perfil_destino_id,
    textoDestino: l.texto_destino,
    ordem: l.ordem,
    ativo: l.ativo,
    inicioEm: l.inicio_em,
    fimEm: l.fim_em,
    situacao: situacaoDoPatrocinador(l, agora),
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}
