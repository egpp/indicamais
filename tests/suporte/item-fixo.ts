import type { SupabaseClient } from "@supabase/supabase-js";

/** Limite da cota de imagens por conta (catalogo_imagens_da_conta < 100 na política de insert do Storage). */
export const COTA_LIMITE_GUARDA = 90;

/**
 * Guarda da suíte de integração: falha cedo, com mensagem clara, se a cota de imagens do dono de teste está quase cheia
 * (em vez de um erro de RLS do Storage no meio do teste). Devolve a cota atual.
 */
export async function exigirCotaDisponivel(dono: SupabaseClient): Promise<number> {
  const { data, error } = await dono.rpc("catalogo_imagens_da_conta");
  if (error)
    throw new Error(`não foi possível ler a cota de imagens do dono de teste (${error.code})`);
  const usado = Number(data);
  if (usado >= COTA_LIMITE_GUARDA) {
    throw new Error(
      `cota de imagens do dono de teste quase cheia (${usado} de 100): rodar limpeza antes da suíte de integração`,
    );
  }
  return usado;
}

export type ItemFixo = {
  itemId: string;
  /** versão em rascunho, pronta para editar e enviar */
  versaoId: string;
  /** caminho da capa a reaproveitar; `null` na primeira vez (o teste envia o arquivo uma única vez) */
  fotoPath: string | null;
};

type CriarArgs = Record<string, unknown> & { p_nome: string; p_tipo: string; p_perfil_id: string };

/**
 * Entrega 1 item fixo por nome (reaproveitado entre rodadas): se já existe, devolve uma NOVA versão em rascunho copiada
 * da aprovada, reaproveitando o caminho da capa (não envia arquivo novo, então a cota não cresce). Só cria item na
 * primeira vez. Restos de rodadas que falharam são normalizados: item despublicado e versão pendente rejeitada.
 * Usa só as sessões do dono e do admin (anon key + contas E2E_*); nunca service_role.
 * Para imóvel, a Loja do perfil precisa estar liberada antes da chamada.
 */
export async function obterItemFixo(
  dono: SupabaseClient,
  admin: SupabaseClient,
  criar: CriarArgs,
): Promise<ItemFixo> {
  const { data: achadas } = await dono
    .from("catalogo_item_versao")
    .select("item_id")
    .eq("nome", criar.p_nome)
    .limit(1);
  const itemId = (achadas?.[0]?.item_id as string | undefined) ?? null;

  if (!itemId) {
    const r = await dono.rpc("catalogo_criar_item", criar as never);
    if (r.error) throw new Error(`criar item fixo: ${r.error.code}`);
    const linha = (r.data as { o_item_id: string; o_versao_id: string }[])[0]!;
    return { itemId: linha.o_item_id, versaoId: linha.o_versao_id, fotoPath: null };
  }

  // normaliza restos de uma rodada anterior interrompida
  await dono.from("catalogo_item").update({ publicado: false }).eq("id", itemId);
  const { data: pendente } = await dono
    .from("catalogo_item_versao")
    .select("id")
    .eq("item_id", itemId)
    .eq("situacao", "pendente")
    .maybeSingle();
  if (pendente) {
    await admin.rpc("catalogo_decidir_item_versao", {
      p_versao_id: pendente.id as string,
      p_aprovar: false,
      p_motivo: "Teste de integração: resto de rodada interrompida",
    });
  }

  const { data: item } = await dono
    .from("catalogo_item")
    .select("versao_aprovada_id")
    .eq("id", itemId)
    .single();
  const aprovadaId = item?.versao_aprovada_id as string | null | undefined;
  const { data: rasc } = await dono
    .from("catalogo_item_versao")
    .select("id, foto_path")
    .eq("item_id", itemId)
    .eq("situacao", "rascunho")
    .maybeSingle();
  if (!aprovadaId) {
    // item fixo nunca aprovado (rodada interrompida antes da aprovação): reaproveita o rascunho existente
    if (!rasc) throw new Error("item fixo sem versão aprovada nem rascunho");
    return {
      itemId,
      versaoId: rasc.id as string,
      fotoPath: (rasc.foto_path as string | null) ?? null,
    };
  }
  const { data: aprovada } = await dono
    .from("catalogo_item_versao")
    .select("*")
    .eq("id", aprovadaId)
    .single();
  if (!aprovada) throw new Error("versão aprovada do item fixo não legível");
  const copia: Record<string, unknown> = { ...aprovada };
  for (const k of ["id", "situacao", "criado_em", "enviada_em"]) delete copia[k];
  copia.fotos_extras_paths = [];

  if (rasc) {
    const { item_id: _i, ...semItem } = copia;
    void _i;
    const u = await dono
      .from("catalogo_item_versao")
      .update(semItem as never)
      .eq("id", rasc.id as string);
    if (u.error) throw new Error(`reaproveitar rascunho: ${u.error.code}`);
    return {
      itemId,
      versaoId: rasc.id as string,
      fotoPath: (aprovada.foto_path as string) ?? null,
    };
  }
  const nova = await dono
    .from("catalogo_item_versao")
    .insert(copia as never)
    .select("id")
    .single();
  if (nova.error || !nova.data) throw new Error(`nova versão do item fixo: ${nova.error?.code}`);
  return {
    itemId,
    versaoId: nova.data.id as string,
    fotoPath: (aprovada.foto_path as string) ?? null,
  };
}
