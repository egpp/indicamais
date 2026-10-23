import type { SupabaseClient } from "@supabase/supabase-js";
import { formatoDeCaminhoValido } from "@/shared/conteudo/imagens";

/** Bucket privado único (migração 20261024140000). */
export const BUCKET_IMAGENS = "indicamais-imagens";
/** URL assinada curta: a página é renderizada a cada visita, então 1 hora basta. */
const VALIDADE_SEGUNDOS = 3600;

type ClienteStorage = Pick<SupabaseClient, "storage">;

/**
 * Gera URLs assinadas para exibir imagens. Usa a SESSÃO do usuário (as políticas do Storage decidem se pode
 * ler: dono, administrador ou imagem pública). Devolve só caminho -> URL: o metadado do objeto (owner,
 * owner_id) nunca passa daqui e portanto nunca chega ao navegador (IM-029, IM-086).
 */
export function criarAssinadorImagens(supabase: ClienteStorage) {
  return async function assinar(caminhos: string[]): Promise<Record<string, string>> {
    const unicos = [...new Set(caminhos)].filter((c) => formatoDeCaminhoValido(c));
    if (unicos.length === 0) return {};
    const { data, error } = await supabase.storage
      .from(BUCKET_IMAGENS)
      .createSignedUrls(unicos, VALIDADE_SEGUNDOS);
    if (error || !data) return {};
    const saida: Record<string, string> = {};
    for (const d of data) {
      if (d.path && d.signedUrl && !d.error) saida[d.path] = d.signedUrl;
    }
    return saida;
  };
}
