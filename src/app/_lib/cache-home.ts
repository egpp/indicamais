import { unstable_cache, updateTag } from "next/cache";
import { chaveCacheHome, criarServicoHome, validarLocalizacaoHome } from "@/modules/busca";
import type { SecaoHome } from "@/modules/busca";
import { criarClientePublico } from "@/shared/supabase/publico";
import { criarBancoHome } from "./banco-home";
import { criarCacheTemporal } from "./cache-temporal";

/**
 * Cache das seções da home (IM-095, D-018): atualização em intervalos, não a cada visita.
 *
 * O que entra no cache são SÓ as seções públicas (título + cards com caminho de imagem), chaveadas por cidade+UF
 * normalizados ("sem-cidade" quando não há). Nada depende de quem está logado: a cidade do perfil da pessoa só escolhe a
 * chave. As URLs assinadas das imagens NÃO ficam no cache (são curtas e geradas por requisição, fora daqui).
 * O loader usa o cliente ANÔNIMO e não lê cookies nem headers, como exige o unstable_cache.
 *
 * Duas camadas:
 *  1) unstable_cache (revalidate 5 min, tag `home-secoes`): compartilhada entre isolates SE o OpenNext tiver cache
 *     incremental configurado (R2/KV, ver open-next.config.ts). Sem ele o OpenNext usa cache nulo e esta camada apenas
 *     executa a função (seguro, sem vazamento, só sem economia).
 *  2) Memória por isolate (60 s): garante algum alívio mesmo sem cache incremental.
 * Atraso máximo de uma edição do administrador em outro isolate: o TTL da memória (a tag e a memória local são
 * limpas já no isolate que salvou).
 */
export const TAG_HOME_SECOES = "home-secoes";
export const REVALIDAR_HOME_SEGUNDOS = 300;
export const TTL_MEMORIA_HOME_MS = 60_000;

const memoria = criarCacheTemporal<SecaoHome[]>({ ttlMs: TTL_MEMORIA_HOME_MS });

async function carregar(cidade: string | null, uf: string | null): Promise<SecaoHome[]> {
  const servico = criarServicoHome(criarBancoHome(criarClientePublico()));
  const r = await servico.obterSecoesDaHome(cidade && uf ? { cidade, uf } : null);
  // Erro NÃO é guardado: lançar impede o unstable_cache de gravar o resultado.
  if (!r.ok) throw new Error("falha-secoes-home");
  return r.valor;
}

const camadaNext = unstable_cache(
  (cidade: string | null, uf: string | null) => carregar(cidade, uf),
  ["home-secoes-v1"],
  { revalidate: REVALIDAR_HOME_SEGUNDOS, tags: [TAG_HOME_SECOES] },
);

/**
 * Seções prontas da home para a localização dada (validada aqui: UF inválida vira "sem cidade"). Em falha devolve
 * lista vazia: a home continua sem os carrosséis em vez de quebrar.
 */
export async function obterSecoesDaHomeEmCache(entrada: unknown): Promise<SecaoHome[]> {
  const loc = validarLocalizacaoHome(entrada);
  try {
    return await memoria.obter(chaveCacheHome(loc), () =>
      camadaNext(loc?.cidade ?? null, loc?.uf ?? null),
    );
  } catch {
    return [];
  }
}

/** Chamar numa Server Action logo após salvar a edição das seções: esvazia a memória local e expira a tag. */
export function revalidarSecoesDaHome(): void {
  memoria.invalidar();
  try {
    updateTag(TAG_HOME_SECOES);
  } catch {
    // Fora de uma Server Action o updateTag não existe; a memória já foi limpa e o TTL cuida do resto.
  }
}
