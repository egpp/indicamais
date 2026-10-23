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
  type ServicoCategorias,
  type ServicoItens,
} from "@/modules/catalogo";
import { criarServicoPerfis, type ClienteBancoPerfis, type ServicoPerfis } from "@/modules/perfis";

export type DependenciasContexto = {
  contaId: string;
  bancoPerfis: ClienteBancoPerfis;
  bancoItens: ClienteBancoItens;
  bancoCategorias: ClienteBancoCategorias;
  bancoAdministracao: ClienteBancoAdministracao;
  /** URL assinada (curta) por caminho do Storage. Nunca devolve metadado do objeto (owner). */
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

export type Contexto = {
  contaId: string;
  perfis: ServicoPerfis;
  itens: ServicoItens;
  categorias: ServicoCategorias;
  administracao: ServicoAdministracao;
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

/** Monta os serviços dos módulos sobre os bancos injetados (reais em produção, em memória nos testes). */
export function criarContexto(d: DependenciasContexto): Contexto {
  return {
    contaId: d.contaId,
    perfis: criarServicoPerfis(d.bancoPerfis),
    itens: criarServicoItens(d.bancoItens),
    categorias: criarServicoCategorias(d.bancoCategorias),
    administracao: criarServicoAdministracao(d.bancoAdministracao),
    assinarImagens: async (c) => {
      try {
        return await d.assinarImagens(c);
      } catch {
        return {};
      }
    },
  };
}
