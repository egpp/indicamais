import type { SupabaseClient } from "@supabase/supabase-js";
import type { DependenciasContexto } from "./contexto";
import { criarAssinadorImagens } from "./imagens-servidor";

/**
 * ETAPA 2 (pendente): adaptadores supabase-js dos contratos ClienteBancoPerfis, ClienteBancoItens,
 * ClienteBancoCategorias, ClienteBancoAdministracao e BancoRevisaoConteudo. Dependem dos tipos gerados do
 * banco (perfis_perfil, catalogo_item, visões e RPCs da Fase 2), que ainda não existem em
 * src/shared/db/database.types.ts. Até lá, qualquer tela que precise de dados falha de forma explícita.
 */
export function criarBancosSupabase(
  supabase: Pick<SupabaseClient, "storage">,
  contaId: string,
): DependenciasContexto {
  void contaId;
  void criarAssinadorImagens(supabase);
  throw new Error("Adaptadores de banco da Fase 2 pendentes (Etapa 2): faltam os tipos gerados.");
}
