import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "indicamais-imagens";

/**
 * Limpeza de imagens de teste no DESENVOLVIMENTO, sem service_role e sem tocar em código de produção.
 *
 * O dono não apaga imagem em uso por versão aprovada (catalogo_imagem_em_uso). Para liberar a cota de 100 imagens, este
 * auxiliar cria uma nova versão do item que mantém UMA só imagem (a capa; o envio exige capa), envia, o admin aprova (a
 * versão antiga deixa de estar em uso) e o dono apaga as demais. Não envia arquivo novo. A Loja do perfil precisa estar liberada se o item for imóvel; chame antes
 * de restaurar o estado inicial da Loja. Devolve `null` se limpou; senão, o passo que falhou (código do erro, sem dados sensíveis).
 */
export async function limparImagensDoItem(
  dono: SupabaseClient,
  admin: SupabaseClient,
  itemId: string,
): Promise<string | null> {
  try {
    const { data: itemLinha } = await dono
      .from("catalogo_item")
      .select("versao_aprovada_id")
      .eq("id", itemId)
      .single();
    const aprovadaId = itemLinha?.versao_aprovada_id as string | null | undefined;
    if (!aprovadaId) return "sem versão aprovada";
    const { data: antiga } = await dono
      .from("catalogo_item_versao")
      .select("*")
      .eq("id", aprovadaId)
      .single();
    if (!antiga) return "versão não lida";
    const caminhos = [
      ...(antiga.foto_path ? [antiga.foto_path as string] : []),
      ...((antiga.fotos_extras_paths as string[] | null) ?? []),
    ];
    if (caminhos.length <= 1) return null; // só a capa: nada a liberar (o envio exige foto de capa)
    // o envio exige foto de capa: a nova versão mantém UMA imagem (a capa, ou a 1ª extra) e as demais são apagadas.
    // Não envia arquivo novo (funciona mesmo com a cota cheia). Resíduo inevitável: 1 imagem por item aprovado.
    const manter = caminhos[0]!;
    const apagar = caminhos.slice(1);

    const copia: Record<string, unknown> = { ...antiga };
    for (const k of ["id", "situacao", "criado_em", "enviada_em"]) delete copia[k];
    copia.foto_path = manter;
    copia.fotos_extras_paths = [];
    // se já existe rascunho (índice único de um rascunho por item), reaproveita-o
    const { data: rasc } = await dono
      .from("catalogo_item_versao")
      .select("id")
      .eq("item_id", itemId)
      .eq("situacao", "rascunho")
      .maybeSingle();
    let novaId: string;
    if (rasc) {
      const { item_id: _ignorado, ...semItem } = copia;
      void _ignorado;
      const atual = await dono
        .from("catalogo_item_versao")
        .update(semItem as never)
        .eq("id", rasc.id as string);
      if (atual.error) return `atualizar rascunho: ${atual.error.code}`;
      novaId = rasc.id as string;
    } else {
      const nova = await dono
        .from("catalogo_item_versao")
        .insert(copia as never)
        .select("id")
        .single();
      if (nova.error || !nova.data) return `inserir: ${nova.error?.code}`;
      novaId = nova.data.id as string;
    }
    const env = await dono.rpc("catalogo_enviar_item_versao", { p_versao_id: novaId });
    if (env.error) return `enviar: ${env.error.code}`;
    const ap = await admin.rpc("catalogo_decidir_item_versao", {
      p_versao_id: novaId,
      p_aprovar: true,
    });
    if (ap.error) return `aprovar: ${ap.error.code}`;
    const rem = await dono.storage.from(BUCKET).remove(apagar);
    return !rem.error && (rem.data ?? []).length === apagar.length
      ? null
      : `remover: ${rem.error?.message ?? (rem.data ?? []).length}`;
  } catch {
    return "exceção";
  }
}

/**
 * Para specs de tela: acha os itens do dono cujo nome começa com `prefixo` (nome do item criado pelo próprio teste),
 * liga a Loja do primeiro perfil do dono se preciso, limpa as imagens de cada item e devolve a Loja ao estado anterior.
 * Usa só anon key + contas E2E_*; nunca service_role. Devolve o número de itens limpos (melhor esforço).
 */
export async function limparItensDeTestePorNome(prefixo: string): Promise<number> {
  const { createClient } = await import("@supabase/supabase-js");
  const e = process.env;
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY || !prefixo) return 0;
  if (!e.E2E_DONO_EMAIL || !e.E2E_DONO_SENHA || !e.E2E_ADMIN_EMAIL || !e.E2E_ADMIN_SENHA) return 0;
  const entrar = async (email: string, senha: string) => {
    const c = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await c.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error("login de teste falhou");
    return c;
  };
  try {
    const dono = await entrar(e.E2E_DONO_EMAIL, e.E2E_DONO_SENHA);
    const admin = await entrar(e.E2E_ADMIN_EMAIL, e.E2E_ADMIN_SENHA);
    const { data: vers } = await dono
      .from("catalogo_item_versao")
      .select("item_id")
      .like("nome", `${prefixo}%`);
    const ids = [...new Set((vers ?? []).map((v) => v.item_id as string))];
    if (ids.length === 0) return 0;
    const { data: it0 } = await dono
      .from("catalogo_item")
      .select("perfil_id")
      .eq("id", ids[0]!)
      .single();
    const perfilId = it0?.perfil_id as string | undefined;
    if (!perfilId) return 0;
    const itens = ids.map((id) => ({ id }));
    const antes = await dono.from("loja_liberacao").select("liberada").eq("perfil_id", perfilId);
    const inicial = Boolean(antes.data?.[0]?.liberada);
    const definir = (liberada: boolean) =>
      admin.rpc("loja_definir_liberacao", {
        p_perfil_id: perfilId,
        p_liberada: liberada,
        p_motivo: "Limpeza de imagens de teste (E2E)",
      });
    if (!inicial) await definir(true);
    let n = 0;
    for (const it of itens) {
      if ((await limparImagensDoItem(dono, admin, it.id as string)) === null) n += 1;
    }
    if (!inicial) await definir(false);
    return n;
  } catch {
    return 0;
  }
}
