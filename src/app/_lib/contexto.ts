import {
  criarServicoAdministracao,
  type ClienteBancoAdministracao,
  type ServicoAdministracao,
} from "@/modules/administracao";
import {
  criarServicoCategorias,
  criarServicoItens,
  type ClienteBancoCategorias,
  type ClienteBancoItens,
  type LinhaCategoria,
  type LinhaItemVersao,
  type ServicoCategorias,
  type ServicoItens,
  type TipoItem,
} from "@/modules/catalogo";
import {
  criarServicoPerfis,
  type ClienteBancoPerfis,
  type LinhaVersaoPerfil,
  type ServicoPerfis,
} from "@/modules/perfis";
import type { RespostaBanco } from "@/shared/conteudo/resultado";

/**
 * Leitura de uma versão pendente por quem revisa (administrador). Os módulos só expõem "meus" perfis e itens;
 * o administrador precisa ver o conteúdo de outra conta para decidir. É leitura: o banco (RLS) só entrega a
 * administradores. A revisão exibe só o formato público (sem WhatsApp, responsável ou e-mail; IM-029).
 */
export interface BancoRevisaoConteudo {
  buscarVersaoPerfil(
    versaoId: string,
  ): Promise<RespostaBanco<{ perfil: { id: string; slug: string }; versao: LinhaVersaoPerfil }>>;
  buscarVersaoItem(versaoId: string): Promise<
    RespostaBanco<{
      item: { id: string; perfil_id: string | null; tipo: TipoItem };
      versao: LinhaItemVersao;
    }>
  >;
  /** Todas as categorias, inclusive inativas (o administrador as vê para reativar). */
  listarTodasCategorias(): Promise<RespostaBanco<LinhaCategoria[]>>;
}

export type DependenciasContexto = {
  contaId: string;
  bancoPerfis: ClienteBancoPerfis;
  bancoItens: ClienteBancoItens;
  bancoCategorias: ClienteBancoCategorias;
  bancoAdministracao: ClienteBancoAdministracao;
  revisao: BancoRevisaoConteudo;
  /** A conta logada é administradora? Só decide a navegação; o banco confere de novo em cada ação. */
  ehAdministrador: () => Promise<boolean>;
  /** URL assinada (curta) por caminho do Storage. Nunca devolve metadado do objeto (owner). */
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

export type Contexto = {
  contaId: string;
  perfis: ServicoPerfis;
  itens: ServicoItens;
  categorias: ServicoCategorias;
  administracao: ServicoAdministracao;
  revisao: BancoRevisaoConteudo;
  ehAdministrador: () => Promise<boolean>;
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

/** Monta os serviços dos módulos sobre os bancos injetados (reais em produção, em memória nos testes). */
export function criarContexto(d: DependenciasContexto): Contexto {
  let admin: Promise<boolean> | null = null;
  return {
    contaId: d.contaId,
    perfis: criarServicoPerfis(d.bancoPerfis),
    itens: criarServicoItens(d.bancoItens),
    categorias: criarServicoCategorias(d.bancoCategorias),
    administracao: criarServicoAdministracao(d.bancoAdministracao),
    revisao: d.revisao,
    ehAdministrador: () => (admin ??= d.ehAdministrador().catch(() => false)),
    assinarImagens: async (c) => {
      try {
        return await d.assinarImagens(c);
      } catch {
        return {};
      }
    },
  };
}
