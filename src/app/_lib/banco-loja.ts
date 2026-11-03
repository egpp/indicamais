import type { ClienteBancoLojaAdmin, LinhaConsultaNegocio } from "@/modules/administracao";
import type {
  ClienteBancoLoja,
  LinhaImovelListado,
  LinhaLojaItemPublico,
} from "@/modules/catalogo";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import { COLUNAS, consultarAdmin, type ClienteSupabaseFase2 } from "./bancos-supabase";

/**
 * Adaptadores supabase-js da Loja (IM-097, IM-098, IM-099, D-020). Sempre com a sessão em uso (anônima nas páginas
 * públicas; do dono ou do administrador nas áreas logadas); nunca service_role. Colunas nomeadas. Erros viram
 * `ErroBanco` só com o código (o texto do banco não passa).
 */

const ERRO_DESCONHECIDO: ErroBanco = { code: "XX000" };
const comoErro = (e: { code?: string } | null): ErroBanco | null => (e ? { code: e.code } : null);

const COLUNAS_LOJA_ITEM =
  "id, perfil_id, perfil_slug, tipo, nome, descricao, foto_path, fotos_extras_paths, categoria_principal_id, categoria_secundaria_1_id, categoria_secundaria_2_id, preco_modo, preco_centavos, cidade, uf, bairro, imovel_tipo, finalidade, area_m2, quartos, banheiros, vagas, condominio_centavos, iptu_centavos, aceita_financiamento, criado_em";

/** Leitura da Loja: visão loja_item_publico, rpc loja_listar_imoveis e loja_liberacao (RLS decide o que a sessão vê). */
export function criarBancoLoja(supabase: ClienteSupabaseFase2): ClienteBancoLoja {
  return {
    async lerLiberacoes(perfilIds) {
      try {
        const { data, error } = await supabase
          .from("loja_liberacao")
          .select("perfil_id, liberada")
          .in("perfil_id", perfilIds);
        return {
          dados: (data ?? []).map((l) => ({ perfil_id: l.perfil_id, liberada: l.liberada })),
          erro: comoErro(error),
        };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async listarItensDoPerfil(perfilId) {
      try {
        const { data, error } = await supabase
          .from("loja_item_publico")
          .select(COLUNAS_LOJA_ITEM)
          .eq("perfil_id", perfilId)
          .order("criado_em", { ascending: false })
          .limit(50);
        return { dados: (data ?? []) as unknown as LinhaLojaItemPublico[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async buscarItemPorId(id) {
      try {
        const { data, error } = await supabase
          .from("loja_item_publico")
          .select(COLUNAS_LOJA_ITEM)
          .eq("id", id)
          .maybeSingle();
        return {
          dados: (data ?? null) as unknown as LinhaLojaItemPublico | null,
          erro: comoErro(error),
        };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async listarImoveis(p) {
      try {
        const { data, error } = await supabase.rpc("loja_listar_imoveis", p);
        return { dados: (data ?? []) as unknown as LinhaImovelListado[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
  };
}

/**
 * Administrador geral: perfis pela visão administracao_consulta_negocios (alvo_tipo = 'perfil'), estado da Loja em
 * loja_liberacao (política de leitura do administrador) e rpc loja_definir_liberacao. Sem migração nova.
 */
export function criarBancoLojaAdmin(supabase: ClienteSupabaseFase2): ClienteBancoLojaAdmin {
  return {
    ehAdministrador: () => consultarAdmin(supabase),
    async consultarPerfis(c) {
      try {
        let q = supabase
          .from("administracao_consulta_negocios")
          .select(COLUNAS.consultaNegocios)
          .eq("alvo_tipo", "perfil");
        if (c.buscaLike) q = q.ilike("nome", `%${c.buscaLike}%`);
        if (c.ids) q = q.in("alvo_id", c.ids);
        const { data, error } = await q
          .order("atualizado_em", { ascending: false })
          .order("alvo_id", { ascending: true })
          .range(c.de, c.ate);
        return { dados: (data ?? []) as unknown as LinhaConsultaNegocio[], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async listarLiberacoes(ids) {
      try {
        let q = supabase.from("loja_liberacao").select("perfil_id, liberada, atualizado_em");
        if (ids) q = q.in("perfil_id", ids);
        const { data, error } = await q;
        return { dados: data ?? [], erro: comoErro(error) };
      } catch {
        return { dados: null, erro: ERRO_DESCONHECIDO };
      }
    },
    async definirLiberacao(p) {
      try {
        const { error } = await supabase.rpc("loja_definir_liberacao", p);
        return { erro: comoErro(error) };
      } catch {
        return { erro: ERRO_DESCONHECIDO };
      }
    },
  };
}
