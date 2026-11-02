import type { BannerAdmin, BannerPublico } from "@/modules/perfis";
import { LIMITE_BANNERS } from "@/modules/perfis";

/**
 * Separa os banners do perfil para a tela do responsável (D-016; IM-093). Só organiza a lista que o módulo já
 * entregou: o conjunto próprio é o da versão em edição (ou, sem edição, o da aprovada); os do administrador se
 * dividem em "aguardando seu aceite" e "aceitos" (que ele pode ocultar). O banco aplica as regras de verdade.
 */
export type BannersSeparados = {
  proprios: BannerAdmin[];
  aguardando: BannerAdmin[];
  aceitos: BannerAdmin[];
  /** Quantas imagens próprias ainda cabem (6 menos as do administrador que contam no limite). */
  limiteProprio: number;
};

const porOrdem = (a: BannerAdmin, b: BannerAdmin) => a.ordem - b.ordem;

export function separarBanners(
  todos: readonly BannerAdmin[],
  versaoAbertaId: string | null,
  versaoAprovadaId: string | null,
): BannersSeparados {
  const versaoVigente = versaoAbertaId ?? versaoAprovadaId;
  const proprios = todos
    .filter(
      (b) => b.origem === "responsavel" && versaoVigente !== null && b.versaoId === versaoVigente,
    )
    .sort(porOrdem);
  const aguardando = todos
    .filter((b) => b.origem === "administrador" && b.situacao === "aguardando_aceite")
    .sort(porOrdem);
  const aceitos = todos
    .filter((b) => b.origem === "administrador" && b.situacao === "aceito")
    .sort(porOrdem);
  return {
    proprios,
    aguardando,
    aceitos,
    limiteProprio: Math.max(0, LIMITE_BANNERS - aguardando.length - aceitos.length),
  };
}

/** O que a prévia do responsável mostra: os próprios e os aceitos do administrador que estão ativos, na ordem. */
export function bannersDaPrevia(sep: BannersSeparados): BannerPublico[] {
  return [...sep.proprios, ...sep.aceitos]
    .filter((b) => b.ativo)
    .sort(porOrdem)
    .map((b) => ({
      id: b.id,
      perfilId: b.perfilId,
      imagemPath: b.imagemPath,
      textoAlternativo: b.textoAlternativo,
      destinoSecao: b.destinoSecao,
      ordem: b.ordem,
    }));
}
